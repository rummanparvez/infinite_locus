const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error', 'event', 'registration', 'approval', 'reminder'],
    default: 'info'
  },
  recipients: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    read: {
      type: Boolean,
      default: false
    },
    readAt: Date
  }],
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  relatedEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  relatedRegistration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  scheduledFor: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  channels: [{
    type: String,
    enum: ['in-app', 'email', 'sms', 'push'],
    default: ['in-app']
  }],
  metadata: {
    actionUrl: String,
    actionText: String,
    imageUrl: String
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sent', 'failed'],
    default: 'draft'
  },
  analytics: {
    sent: {
      type: Number,
      default: 0
    },
    delivered: {
      type: Number,
      default: 0
    },
    read: {
      type: Number,
      default: 0
    },
    clicked: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

notificationSchema.methods.markAsRead = function(userId) {
  const recipient = this.recipients.find(r => r.user.toString() === userId.toString());
  if (recipient && !recipient.read) {
    recipient.read = true;
    recipient.readAt = new Date();
    this.analytics.read += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

notificationSchema.methods.addRecipients = function(userIds) {
  const newRecipients = userIds.map(userId => ({
    user: userId,
    read: false
  }));
  
  this.recipients.push(...newRecipients);
  this.analytics.sent = this.recipients.length;
  
  return this.save();
};

notificationSchema.statics.createForUsers = async function(userIds, notificationData) {
  const recipients = userIds.map(userId => ({
    user: userId,
    read: false
  }));
  
  const notification = new this({
    ...notificationData,
    recipients,
    status: 'sent'
  });
  
  notification.analytics.sent = recipients.length;
  return notification.save();
};

notificationSchema.statics.createForRoles = async function(roles, notificationData) {
  const User = mongoose.model('User');
  const users = await User.find({ role: { $in: roles }, isActive: true }).select('_id');
  const userIds = users.map(user => user._id);
  
  return this.createForUsers(userIds, notificationData);
};

notificationSchema.index({ 'recipients.user': 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);