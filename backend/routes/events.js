const express = require('express');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Comment = require('../models/Comment');
const Rating = require('../models/Rating');
const EventResult = require('../models/EventResult');
const { auth, authorize, checkPermission, optional } = require('../middleware/auth');
const { validateEvent, validateObjectId, validatePagination, validateSearch } = require('../middleware/validation');

const router = express.Router();

router.get('/', optional, validatePagination, validateSearch, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      department, 
      status = 'published', 
      search, 
      upcoming, 
      featured,
      organizer,
      startDate,
      endDate
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (department) filter.department = department;
    if (organizer) filter.organizer = organizer;
    
    if (upcoming === 'true') {
      filter['schedule.startDate'] = { $gte: new Date() };
    }
    
    if (startDate || endDate) {
      filter['schedule.startDate'] = {};
      if (startDate) filter['schedule.startDate'].$gte = new Date(startDate);
      if (endDate) filter['schedule.startDate'].$lte = new Date(endDate);
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const events = await Event.find(filter)
      .populate('organizer', 'firstName lastName avatar')
      .populate('category', 'name color icon')
      .populate('department', 'name code')
      .sort(search ? { score: { $meta: 'textScore' } } : { 'schedule.startDate': 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(filter);

    const eventsWithStats = await Promise.all(events.map(async (event) => {
      const registrationCount = await Registration.countDocuments({ 
        event: event._id, 
        status: { $in: ['approved', 'attended'] } 
      });
      
      return {
        ...event.toObject(),
        currentRegistrations: registrationCount,
        availableSlots: Math.max(0, event.registration.maxCapacity - registrationCount)
      };
    }));

    res.json({
      success: true,
      data: {
        events: eventsWithStats,
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
      message: 'Failed to fetch events',
      error: error.message
    });
  }
});

router.get('/my-events', auth, async (req, res) => {
  try {
    const { type = 'organized' } = req.query;
    
    let events;
    if (type === 'organized') {
      events = await Event.find({ 
        $or: [
          { organizer: req.user._id },
          { coOrganizers: req.user._id }
        ]
      })
      .populate('category', 'name color')
      .populate('department', 'name code')
      .sort({ createdAt: -1 });
    } else if (type === 'registered') {
      const registrations = await Registration.find({ user: req.user._id })
        .populate({
          path: 'event',
          populate: [
            { path: 'organizer', select: 'firstName lastName' },
            { path: 'category', select: 'name color' },
            { path: 'department', select: 'name code' }
          ]
        })
        .sort({ registrationDate: -1 });
      
      events = registrations.map(reg => ({
        ...reg.event.toObject(),
        registrationStatus: reg.status,
        registrationDate: reg.registrationDate
      }));
    }

    res.json({
      success: true,
      data: { events }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user events',
      error: error.message
    });
  }
});

router.get('/stats', auth, checkPermission('view_analytics'), async (req, res) => {
  try {
    const totalEvents = await Event.countDocuments();
    const publishedEvents = await Event.countDocuments({ status: 'published' });
    const pendingApproval = await Event.countDocuments({ 'approval.status': 'pending' });
    const upcomingEvents = await Event.countDocuments({ 
      status: 'published',
      'schedule.startDate': { $gte: new Date() }
    });

    const eventsByCategory = await Event.aggregate([
      { $match: { status: 'published' } },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      {
        $group: {
          _id: '$category',
          name: { $first: '$categoryInfo.name' },
          count: { $sum: 1 }
        }
      }
    ]);

    const eventsByDepartment = await Event.aggregate([
      { $match: { status: 'published', department: { $exists: true } } },
      {
        $lookup: {
          from: 'departments',
          localField: 'department',
          foreignField: '_id',
          as: 'departmentInfo'
        }
      },
      { $unwind: '$departmentInfo' },
      {
        $group: {
          _id: '$department',
          name: { $first: '$departmentInfo.name' },
          count: { $sum: 1 }
        }
      }
    ]);

    const monthlyEvents = await Event.aggregate([
      { $match: { status: 'published' } },
      {
        $group: {
          _id: {
            year: { $year: '$schedule.startDate' },
            month: { $month: '$schedule.startDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          total: totalEvents,
          published: publishedEvents,
          pending: pendingApproval,
          upcoming: upcomingEvents
        },
        byCategory: eventsByCategory,
        byDepartment: eventsByDepartment,
        monthly: monthlyEvents
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event statistics',
      error: error.message
    });
  }
});

router.get('/:id', optional, validateObjectId('id'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'firstName lastName avatar bio')
      .populate('coOrganizers', 'firstName lastName avatar')
      .populate('category', 'name description color icon')
      .populate('department', 'name code')
      .populate('approval.approvedBy', 'firstName lastName');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    await event.incrementViews();

    const registrationStats = await Registration.getRegistrationStats(event._id);
    const ratings = await Rating.find({ event: event._id })
      .populate('user', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(10);

    const comments = await Comment.find({ event: event._id, parent: null })
      .populate('author', 'firstName lastName avatar')
      .populate({
        path: 'replies',
        populate: { path: 'author', select: 'firstName lastName avatar' }
      })
      .sort({ createdAt: -1 })
      .limit(20);

    let userRegistration = null;
    if (req.user) {
      userRegistration = await Registration.findOne({
        user: req.user._id,
        event: event._id
      });
    }

    req.io.to(`event-${event._id}`).emit('event-view', {
      eventId: event._id,
      views: event.analytics.views
    });

    res.json({
      success: true,
      data: {
        event,
        registrationStats,
        ratings,
        comments,
        userRegistration
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event',
      error: error.message
    });
  }
});

router.post('/', auth, checkPermission('create_events'), validateEvent, async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      organizer: req.user._id
    };

    if (req.user.role !== 'admin' && req.user.role !== 'principal') {
      eventData.status = 'draft';
      eventData.approval = { status: 'pending' };
    }

    const event = new Event(eventData);
    await event.save();

    await event.populate([
      { path: 'organizer', select: 'firstName lastName' },
      { path: 'category', select: 'name color' },
      { path: 'department', select: 'name code' }
    ]);

    if (eventData.approval?.status === 'pending') {
      req.io.emit('event-approval-needed', {
        event: event,
        organizer: req.user
      });
    }

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { event }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create event',
      error: error.message
    });
  }
});

router.put('/:id', auth, validateObjectId('id'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const canEdit = event.organizer.toString() === req.user._id.toString() ||
                   event.coOrganizers.includes(req.user._id) ||
                   req.user.role === 'admin';

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this event'
      });
    }

    const allowedUpdates = [
      'title', 'description', 'shortDescription', 'venue', 'schedule',
      'registration', 'images', 'attachments', 'tags', 'requirements',
      'contact', 'social', 'features'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (event.status === 'published' && Object.keys(updates).length > 0) {
      updates.status = 'draft';
      updates.approval = { status: 'pending' };
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate([
      { path: 'organizer', select: 'firstName lastName' },
      { path: 'category', select: 'name color' },
      { path: 'department', select: 'name code' }
    ]);

    req.io.to(`event-${event._id}`).emit('event-updated', {
      event: updatedEvent
    });

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: { event: updatedEvent }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update event',
      error: error.message
    });
  }
});

router.post('/:id/approve', auth, checkPermission('approve_events'), validateObjectId('id'), async (req, res) => {
  try {
    const { approved, reason } = req.body;
    
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    if (event.approval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Event is not pending approval'
      });
    }

    event.approval.status = approved ? 'approved' : 'rejected';
    event.approval.approvedBy = req.user._id;
    event.approval.approvedAt = new Date();
    
    if (approved) {
      event.status = 'published';
    } else {
      event.approval.rejectionReason = reason;
    }

    await event.save();
    await event.populate('organizer', 'firstName lastName email');

    req.io.emit('event-approval-result', {
      event: event,
      approved: approved,
      approver: req.user
    });

    res.json({
      success: true,
      message: `Event ${approved ? 'approved' : 'rejected'} successfully`,
      data: { event }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process approval',
      error: error.message
    });
  }
});

router.delete('/:id', auth, validateObjectId('id'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const canDelete = event.organizer.toString() === req.user._id.toString() ||
                     req.user.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this event'
      });
    }

    if (event.status === 'published' && event.registration.currentCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete event with existing registrations'
      });
    }

    await Event.findByIdAndDelete(req.params.id);
    await Registration.deleteMany({ event: req.params.id });
    await Comment.deleteMany({ event: req.params.id });
    await Rating.deleteMany({ event: req.params.id });

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete event',
      error: error.message
    });
  }
});

router.post('/:id/comments', auth, validateObjectId('id'), async (req, res) => {
  try {
    const { content, parent } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const comment = new Comment({
      content: content.trim(),
      author: req.user._id,
      event: req.params.id,
      parent: parent || null
    });

    await comment.save();
    await comment.populate('author', 'firstName lastName avatar');

    req.io.to(`event-${req.params.id}`).emit('new-comment', {
      comment: comment
    });

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { comment }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message
    });
  }
});

router.post('/:id/rate', auth, validateObjectId('id'), async (req, res) => {
  try {
    const { score, review, aspects, isAnonymous } = req.body;
    
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating score must be between 1 and 5'
      });
    }

    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const registration = await Registration.findOne({
      user: req.user._id,
      event: req.params.id,
      status: 'attended'
    });

    if (!registration) {
      return res.status(400).json({
        success: false,
        message: 'You can only rate events you have attended'
      });
    }

    const existingRating = await Rating.findOne({
      user: req.user._id,
      event: req.params.id
    });

    let rating;
    if (existingRating) {
      existingRating.score = score;
      existingRating.review = review;
      existingRating.aspects = aspects;
      existingRating.isAnonymous = isAnonymous;
      rating = await existingRating.save();
    } else {
      rating = new Rating({
        user: req.user._id,
        event: req.params.id,
        score,
        review,
        aspects,
        isAnonymous
      });
      await rating.save();
    }

    if (!isAnonymous) {
      await rating.populate('user', 'firstName lastName avatar');
    }

    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: { rating }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: error.message
    });
  }
});

module.exports = router;