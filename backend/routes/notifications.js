const express = require('express');
const Notification = require('../models/Notification');
const { auth, checkPermission } = require('../middleware/auth');
const { validateNotification, validateObjectId, validatePagination } = require('../middleware/validation');

const router = express.Router();

router.get('/', auth, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, priority, unread } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      'recipients.user': req.user._id,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: new Date() } }
      ]
    };

    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (unread === 'true') {
      filter['recipients.read'] = false;
    }

    const notifications = await Notification.find(filter)
      .populate('sender', 'firstName lastName avatar')
      .populate('relatedEvent', 'title schedule')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({
      'recipients.user': req.user._id,
      'recipients.read': false,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: new Date() } }
      ]
    });

    const userNotifications = notifications.map(notification => {
      const userRecipient = notification.recipients.find(
        r => r.user.toString() === req.user._id.toString()
      );
      
      return {
        ...notification.toObject(),
        read: userRecipient?.read || false,
        readAt: userRecipient?.readAt
      };
    });

    res.json({
      success: true,
      data: {
        notifications: userNotifications,
        unreadCount,
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
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

router.post('/', auth, checkPermission('send_notifications'), validateNotification, async (req, res) => {
  try {
    const { title, message, type, recipients, priority, scheduledFor, expiresAt, metadata, channels } = req.body;

    const notificationData = {
      title,
      message,
      type,
      priority,
      sender: req.user._id,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata,
      channels: channels || ['in-app']
    };

    let notification;
    if (Array.isArray(recipients)) {
      notification = await Notification.createForUsers(recipients, notificationData);
    } else if (recipients.roles) {
      notification = await Notification.createForRoles(recipients.roles, notificationData);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid recipients format'
      });
    }

    req.io.emit('new-notification', {
      notification: notification,
      recipients: notification.recipients.map(r => r.user)
    });

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      data: { notification }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message
    });
  }
});

router.put('/:id/read', auth, validateObjectId('id'), async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const recipient = notification.recipients.find(
      r => r.user.toString() === req.user._id.toString()
    );

    if (!recipient) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this notification'
      });
    }

    await notification.markAsRead(req.user._id);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

router.put('/mark-all-read', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { 
        'recipients.user': req.user._id,
        'recipients.read': false
      },
      {
        $set: {
          'recipients.$.read': true,
          'recipients.$.readAt': new Date()
        }
      }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
});

router.delete('/:id', auth, validateObjectId('id'), async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const canDelete = notification.sender?.toString() === req.user._id.toString() ||
                     req.user.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this notification'
      });
    }

    await Notification.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

router.get('/stats', auth, checkPermission('view_analytics'), async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalSent: { $sum: '$analytics.sent' },
          totalRead: { $sum: '$analytics.read' }
        }
      }
    ]);

    const priorityStats = await Notification.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    const recentActivity = await Notification.find()
      .populate('sender', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title type priority createdAt sender analytics');

    res.json({
      success: true,
      data: {
        byType: stats,
        byPriority: priorityStats,
        recentActivity
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification statistics',
      error: error.message
    });
  }
});

module.exports = router;