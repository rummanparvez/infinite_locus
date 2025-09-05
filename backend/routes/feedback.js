const express = require('express');
const Feedback = require('../models/Feedback');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const { auth, checkPermission } = require('../middleware/auth');
const { validateObjectId, validatePagination } = require('../middleware/validation');

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const { eventId, type, rating, comments, questions, isAnonymous } = req.body;

    if (!eventId || !rating?.overall) {
      return res.status(400).json({
        success: false,
        message: 'Event ID and overall rating are required'
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const registration = await Registration.findOne({
      user: req.user._id,
      event: eventId,
      status: { $in: ['attended', 'approved'] }
    });

    if (!registration) {
      return res.status(400).json({
        success: false,
        message: 'You can only provide feedback for events you have registered for'
      });
    }

    const existingFeedback = await Feedback.findOne({
      user: req.user._id,
      event: eventId
    });

    let feedback;
    if (existingFeedback) {
      existingFeedback.type = type || existingFeedback.type;
      existingFeedback.rating = rating;
      existingFeedback.comments = comments || existingFeedback.comments;
      existingFeedback.questions = questions || existingFeedback.questions;
      existingFeedback.isAnonymous = isAnonymous !== undefined ? isAnonymous : existingFeedback.isAnonymous;
      feedback = await existingFeedback.save();
    } else {
      feedback = new Feedback({
        event: eventId,
        user: req.user._id,
        type: type || 'event',
        rating,
        comments,
        questions,
        isAnonymous: isAnonymous || false
      });
      await feedback.save();
    }

    if (!isAnonymous) {
      await feedback.populate('user', 'firstName lastName avatar');
    }

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
      data: { feedback }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
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

    const canViewFeedback = event.organizer.toString() === req.user._id.toString() ||
                           event.coOrganizers.includes(req.user._id) ||
                           req.user.hasPermission('view_analytics') ||
                           req.user.role === 'admin';

    if (!canViewFeedback) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view feedback'
      });
    }

    const { page = 1, limit = 20, type } = req.query;
    const skip = (page - 1) * limit;

    const filter = { event: req.params.eventId };
    if (type) filter.type = type;

    const feedback = await Feedback.find(filter)
      .populate('user', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Feedback.countDocuments(filter);
    const summary = await Feedback.getEventFeedbackSummary(req.params.eventId);

    const anonymizedFeedback = feedback.map(fb => {
      if (fb.isAnonymous) {
        const fbObj = fb.toObject();
        delete fbObj.user;
        return fbObj;
      }
      return fb;
    });

    res.json({
      success: true,
      data: {
        feedback: anonymizedFeedback,
        summary,
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
      message: 'Failed to fetch event feedback',
      error: error.message
    });
  }
});

router.get('/', auth, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, eventId, status } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (eventId) filter.event = eventId;
    if (status) filter.status = status;

    if (req.user.role === 'student') {
      filter.user = req.user._id;
    }

    const feedback = await Feedback.find(filter)
      .populate('event', 'title schedule')
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Feedback.countDocuments(filter);

    res.json({
      success: true,
      data: {
        feedback,
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
      message: 'Failed to fetch feedback',
      error: error.message
    });
  }
});

router.put('/:id/respond', auth, checkPermission('approve_events'), validateObjectId('id'), async (req, res) => {
  try {
    const { response } = req.body;

    if (!response) {
      return res.status(400).json({
        success: false,
        message: 'Response is required'
      });
    }

    const feedback = await Feedback.findById(req.params.id).populate('event');
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    const canRespond = feedback.event.organizer.toString() === req.user._id.toString() ||
                      feedback.event.coOrganizers.includes(req.user._id) ||
                      req.user.hasPermission('approve_events') ||
                      req.user.role === 'admin';

    if (!canRespond) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to respond to this feedback'
      });
    }

    feedback.response = response;
    feedback.status = 'acknowledged';
    feedback.reviewedBy = req.user._id;
    feedback.reviewedAt = new Date();

    await feedback.save();

    res.json({
      success: true,
      message: 'Response added successfully',
      data: { feedback }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to respond to feedback',
      error: error.message
    });
  }
});

router.get('/stats', auth, checkPermission('view_analytics'), async (req, res) => {
  try {
    const { eventId, startDate, endDate } = req.query;

    const filter = {};
    if (eventId) filter.event = eventId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const totalFeedback = await Feedback.countDocuments(filter);
    
    const ratingStats = await Feedback.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          averageOverall: { $avg: '$rating.overall' },
          averageContent: { $avg: '$rating.content' },
          averageOrganization: { $avg: '$rating.organization' },
          averageVenue: { $avg: '$rating.venue' },
          averageSpeakers: { $avg: '$rating.speakers' }
        }
      }
    ]);

    const ratingDistribution = await Feedback.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$rating.overall',
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const feedbackByType = await Feedback.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          averageRating: { $avg: '$rating.overall' }
        }
      }
    ]);

    const responseStats = await Feedback.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          total: totalFeedback,
          averageRatings: ratingStats[0] || {
            averageOverall: 0,
            averageContent: 0,
            averageOrganization: 0,
            averageVenue: 0,
            averageSpeakers: 0
          }
        },
        distribution: {
          byRating: ratingDistribution,
          byType: feedbackByType,
          byStatus: responseStats
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback statistics',
      error: error.message
    });
  }
});

router.delete('/:id', auth, validateObjectId('id'), async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    const canDelete = feedback.user.toString() === req.user._id.toString() ||
                     req.user.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this feedback'
      });
    }

    await Feedback.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Feedback deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete feedback',
      error: error.message
    });
  }
});

module.exports = router;