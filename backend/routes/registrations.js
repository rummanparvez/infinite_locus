const express = require('express');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const { auth, authorize, checkPermission } = require('../middleware/auth');
const { validateRegistration, validateObjectId, validatePagination } = require('../middleware/validation');

const router = express.Router();

router.post('/', auth, validateRegistration, async (req, res) => {
  try {
    const { eventId, preferences } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Event is not available for registration'
      });
    }

    if (!event.canUserRegister(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You are not eligible to register for this event'
      });
    }

    const existingRegistration = await Registration.findOne({
      user: req.user._id,
      event: eventId
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this event'
      });
    }

    if (event.registration.deadline && new Date() > event.registration.deadline) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline has passed'
      });
    }

    const currentRegistrations = await Registration.countDocuments({
      event: eventId,
      status: { $in: ['approved', 'pending'] }
    });

    if (currentRegistrations >= event.registration.maxCapacity) {
      return res.status(400).json({
        success: false,
        message: 'Event is full'
      });
    }

    const registrationData = {
      user: req.user._id,
      event: eventId,
      status: event.registration.approvalRequired ? 'pending' : 'approved',
      preferences: preferences || {}
    };

    if (event.registration.fee.amount > 0) {
      registrationData.payment = {
        required: true,
        amount: event.registration.fee.amount,
        status: 'pending'
      };
    }

    const registration = new Registration(registrationData);
    await registration.save();

    await Event.findByIdAndUpdate(eventId, {
      $inc: { 'registration.currentCount': 1 }
    });

    await registration.populate([
      { path: 'user', select: 'firstName lastName email' },
      { path: 'event', select: 'title organizer' }
    ]);

    req.io.to(`event-${eventId}`).emit('new-registration', {
      registration: registration,
      eventId: eventId,
      currentCount: currentRegistrations + 1
    });

    if (event.registration.approvalRequired) {
      req.io.emit('registration-approval-needed', {
        registration: registration
      });
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { registration }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

router.get('/', auth, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, eventId, userId } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (eventId) filter.event = eventId;
    
    if (req.user.role === 'student') {
      filter.user = req.user._id;
    } else if (userId && (req.user.role === 'admin' || req.user.hasPermission('manage_users'))) {
      filter.user = userId;
    }

    const registrations = await Registration.find(filter)
      .populate('user', 'firstName lastName email studentId')
      .populate('event', 'title schedule venue organizer')
      .sort({ registrationDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Registration.countDocuments(filter);

    res.json({
      success: true,
      data: {
        registrations,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registrations',
      error: error.message
    });
  }
});

router.get('/event/:eventId', auth, validateObjectId('eventId'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const canViewRegistrations = event.organizer.toString() === req.user._id.toString() ||
                               event.coOrganizers.includes(req.user._id) ||
                               req.user.hasPermission('approve_events') ||
                               req.user.role === 'admin';

    if (!canViewRegistrations) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view registrations'
      });
    }

    const { status, search } = req.query;
    const filter = { event: req.params.eventId };
    
    if (status) filter.status = status;

    const registrations = await Registration.find(filter)
      .populate('user', 'firstName lastName email studentId department year section phone')
      .sort({ registrationDate: -1 });

    let filteredRegistrations = registrations;
    if (search) {
      filteredRegistrations = registrations.filter(reg => 
        reg.user.firstName.toLowerCase().includes(search.toLowerCase()) ||
        reg.user.lastName.toLowerCase().includes(search.toLowerCase()) ||
        reg.user.email.toLowerCase().includes(search.toLowerCase()) ||
        (reg.user.studentId && reg.user.studentId.toLowerCase().includes(search.toLowerCase()))
      );
    }

    const stats = await Registration.getRegistrationStats(req.params.eventId);

    res.json({
      success: true,
      data: {
        registrations: filteredRegistrations,
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event registrations',
      error: error.message
    });
  }
});

router.put('/:id/approve', auth, validateObjectId('id'), async (req, res) => {
  try {
    const { approved, reason } = req.body;
    
    const registration = await Registration.findById(req.params.id)
      .populate('event')
      .populate('user', 'firstName lastName email');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    const canApprove = registration.event.organizer.toString() === req.user._id.toString() ||
                      registration.event.coOrganizers.includes(req.user._id) ||
                      req.user.hasPermission('approve_events') ||
                      req.user.role === 'admin';

    if (!canApprove) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve registrations'
      });
    }

    if (registration.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Registration is not pending approval'
      });
    }

    if (approved) {
      await registration.approve(req.user);
    } else {
      await registration.reject(reason, req.user);
      
      await Event.findByIdAndUpdate(registration.event._id, {
        $inc: { 'registration.currentCount': -1 }
      });
    }

    req.io.to(`event-${registration.event._id}`).emit('registration-status-updated', {
      registration: registration,
      approved: approved
    });

    res.json({
      success: true,
      message: `Registration ${approved ? 'approved' : 'rejected'} successfully`,
      data: { registration }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process registration approval',
      error: error.message
    });
  }
});

router.put('/:id/attendance', auth, validateObjectId('id'), async (req, res) => {
  try {
    const { present, location } = req.body;
    
    const registration = await Registration.findById(req.params.id)
      .populate('event')
      .populate('user', 'firstName lastName');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    const canMarkAttendance = registration.event.organizer.toString() === req.user._id.toString() ||
                             registration.event.coOrganizers.includes(req.user._id) ||
                             req.user.hasPermission('approve_events') ||
                             req.user.role === 'admin';

    if (!canMarkAttendance) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark attendance'
      });
    }

    if (registration.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Can only mark attendance for approved registrations'
      });
    }

    await registration.markAttendance(present);
    
    if (present && location) {
      registration.checkIn.location = location;
      await registration.save();
    }

    req.io.to(`event-${registration.event._id}`).emit('attendance-marked', {
      registration: registration,
      present: present
    });

    res.json({
      success: true,
      message: `Attendance marked as ${present ? 'present' : 'absent'}`,
      data: { registration }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark attendance',
      error: error.message
    });
  }
});

router.delete('/:id', auth, validateObjectId('id'), async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id).populate('event');
    
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    const canCancel = registration.user.toString() === req.user._id.toString() ||
                     registration.event.organizer.toString() === req.user._id.toString() ||
                     req.user.role === 'admin';

    if (!canCancel) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this registration'
      });
    }

    const { reason } = req.body;
    
    registration.status = 'cancelled';
    registration.cancellationReason = reason;
    await registration.save();

    await Event.findByIdAndUpdate(registration.event._id, {
      $inc: { 'registration.currentCount': -1 }
    });

    req.io.to(`event-${registration.event._id}`).emit('registration-cancelled', {
      registration: registration
    });

    res.json({
      success: true,
      message: 'Registration cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cancel registration',
      error: error.message
    });
  }
});

router.post('/bulk-approve', auth, checkPermission('approve_events'), async (req, res) => {
  try {
    const { registrationIds, approved, reason } = req.body;

    if (!registrationIds || !Array.isArray(registrationIds)) {
      return res.status(400).json({
        success: false,
        message: 'Registration IDs array is required'
      });
    }

    const registrations = await Registration.find({
      _id: { $in: registrationIds },
      status: 'pending'
    }).populate('event').populate('user', 'firstName lastName email');

    const results = [];
    for (const registration of registrations) {
      try {
        if (approved) {
          await registration.approve(req.user);
        } else {
          await registration.reject(reason, req.user);
          await Event.findByIdAndUpdate(registration.event._id, {
            $inc: { 'registration.currentCount': -1 }
          });
        }
        results.push({ id: registration._id, success: true });
      } catch (error) {
        results.push({ id: registration._id, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Bulk ${approved ? 'approval' : 'rejection'} completed`,
      data: { results }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Bulk operation failed',
      error: error.message
    });
  }
});

module.exports = router;