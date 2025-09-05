const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  type: {
    type: String,
    enum: ['general', 'urgent', 'event', 'academic', 'administrative', 'emergency'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'critical'],
    default: 'normal'
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetAudience: {
    roles: [{
      type: String,
      enum: ['student', 'faculty', 'organizer', 'admin', 'authority', 'hod', 'principal', 'registrar']
    }],
    departments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    }],
    years: [Number],
    specific: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  schedule: {
    publishAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published', 'expired', 'archived'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'department', 'role'],
    default: 'public'
  },
  interactions: {
    views: {
      type: Number,
      default: 0
    },
    likes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    comments: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      content: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  tags: [String]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

announcementSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'published' && 
         now >= this.schedule.publishAt && 
         (!this.schedule.expiresAt || now <= this.schedule.expiresAt);
});

announcementSchema.virtual('likeCount').get(function() {
  return this.interactions.likes ? this.interactions.likes.length : 0;
});

announcementSchema.virtual('commentCount').get(function() {
  return this.interactions.comments ? this.interactions.comments.length : 0;
});

announcementSchema.methods.incrementViews = function() {
  this.interactions.views += 1;
  return this.save();
};

announcementSchema.index({ author: 1 });
announcementSchema.index({ status: 1 });
announcementSchema.index({ 'schedule.publishAt': 1 });
announcementSchema.index({ 'schedule.expiresAt': 1 });
announcementSchema.index({ priority: 1 });
announcementSchema.index({ isPinned: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);