const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  shortDescription: {
    type: String,
    maxlength: 300
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coOrganizers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  venue: {
    name: {
      type: String,
      required: true
    },
    address: String,
    capacity: Number,
    type: {
      type: String,
      enum: ['physical', 'virtual', 'hybrid'],
      default: 'physical'
    },
    meetingLink: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  schedule: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    duration: Number,
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    }
  },
  registration: {
    isRequired: {
      type: Boolean,
      default: true
    },
    maxCapacity: {
      type: Number,
      default: 100
    },
    currentCount: {
      type: Number,
      default: 0
    },
    approvalRequired: {
      type: Boolean,
      default: false
    },
    deadline: Date,
    fee: {
      amount: {
        type: Number,
        default: 0
      },
      currency: {
        type: String,
        default: 'INR'
      }
    },
    allowedRoles: [{
      type: String,
      enum: ['student', 'faculty', 'organizer', 'admin', 'authority', 'hod', 'principal', 'registrar'],
      default: ['student', 'faculty']
    }],
    allowedDepartments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    }],
    allowedYears: [{
      type: Number,
      min: 1,
      max: 4
    }]
  },
  images: [{
    url: String,
    caption: String,
    isPrimary: Boolean
  }],
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  tags: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'published', 'cancelled', 'completed'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'department', 'year'],
    default: 'public'
  },
  features: {
    allowComments: {
      type: Boolean,
      default: true
    },
    allowRatings: {
      type: Boolean,
      default: true
    },
    sendReminders: {
      type: Boolean,
      default: true
    },
    generateCertificates: {
      type: Boolean,
      default: false
    },
    recordAttendance: {
      type: Boolean,
      default: true
    }
  },
  requirements: {
    prerequisites: [String],
    materials: [String],
    equipment: [String]
  },
  contact: {
    email: String,
    phone: String,
    website: String
  },
  social: {
    facebook: String,
    twitter: String,
    instagram: String,
    linkedin: String
  },
  analytics: {
    views: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    }
  },
  approval: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrence: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    },
    interval: Number,
    endDate: Date,
    days: [Number]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

eventSchema.virtual('registrations', {
  ref: 'Registration',
  localField: '_id',
  foreignField: 'event'
});

eventSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'event'
});

eventSchema.virtual('ratings', {
  ref: 'Rating',
  localField: '_id',
  foreignField: 'event'
});

eventSchema.virtual('averageRating').get(function() {
  if (this.ratings && this.ratings.length > 0) {
    const sum = this.ratings.reduce((acc, rating) => acc + rating.score, 0);
    return (sum / this.ratings.length).toFixed(1);
  }
  return 0;
});

eventSchema.virtual('isUpcoming').get(function() {
  return new Date() < this.schedule.startDate;
});

eventSchema.virtual('isOngoing').get(function() {
  const now = new Date();
  return now >= this.schedule.startDate && now <= this.schedule.endDate;
});

eventSchema.virtual('isPast').get(function() {
  return new Date() > this.schedule.endDate;
});

eventSchema.virtual('availableSlots').get(function() {
  return Math.max(0, this.registration.maxCapacity - this.registration.currentCount);
});

eventSchema.virtual('isFull').get(function() {
  return this.registration.currentCount >= this.registration.maxCapacity;
});

eventSchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  return this.save();
};

eventSchema.methods.canUserRegister = function(user) {
  if (this.registration.allowedRoles.length > 0 && !this.registration.allowedRoles.includes(user.role)) {
    return false;
  }
  
  if (this.registration.allowedDepartments.length > 0 && !this.registration.allowedDepartments.includes(user.department)) {
    return false;
  }
  
  if (this.registration.allowedYears.length > 0 && !this.registration.allowedYears.includes(user.year)) {
    return false;
  }
  
  return true;
};

eventSchema.index({ title: 'text', description: 'text', tags: 'text' });
eventSchema.index({ 'schedule.startDate': 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ organizer: 1 });
eventSchema.index({ department: 1 });
eventSchema.index({ visibility: 1 });
eventSchema.index({ 'approval.status': 1 });

module.exports = mongoose.model('Event', eventSchema);