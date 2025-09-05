const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'attended', 'absent'],
    default: 'pending'
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectionReason: String,
  cancellationReason: String,
  attendanceMarked: {
    type: Boolean,
    default: false
  },
  attendanceTime: Date,
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    anonymous: {
      type: Boolean,
      default: false
    }
  },
  certificate: {
    generated: {
      type: Boolean,
      default: false
    },
    url: String,
    generatedAt: Date
  },
  payment: {
    required: {
      type: Boolean,
      default: false
    },
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    transactionId: String,
    paymentDate: Date
  },
  preferences: {
    receiveUpdates: {
      type: Boolean,
      default: true
    },
    dietary: String,
    accessibility: String,
    emergencyContact: {
      name: String,
      phone: String,
      relation: String
    }
  },
  checkIn: {
    time: Date,
    location: {
      latitude: Number,
      longitude: Number
    },
    method: {
      type: String,
      enum: ['qr', 'manual', 'nfc'],
      default: 'manual'
    }
  },
  checkOut: {
    time: Date,
    location: {
      latitude: Number,
      longitude: Number
    }
  },
  notes: String
}, {
  timestamps: true
});

registrationSchema.virtual('duration').get(function() {
  if (this.checkIn.time && this.checkOut.time) {
    return Math.floor((this.checkOut.time - this.checkIn.time) / (1000 * 60));
  }
  return 0;
});

registrationSchema.statics.getRegistrationStats = async function(eventId) {
  const stats = await this.aggregate([
    { $match: { event: mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    attended: 0,
    absent: 0,
    total: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

registrationSchema.methods.approve = function(approver) {
  this.status = 'approved';
  this.approvedBy = approver._id;
  this.approvedAt = new Date();
  return this.save();
};

registrationSchema.methods.reject = function(reason, approver) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.approvedBy = approver._id;
  this.approvedAt = new Date();
  return this.save();
};

registrationSchema.methods.markAttendance = function(present = true) {
  this.status = present ? 'attended' : 'absent';
  this.attendanceMarked = true;
  this.attendanceTime = new Date();
  
  if (present && !this.checkIn.time) {
    this.checkIn.time = new Date();
  }
  
  return this.save();
};

registrationSchema.index({ user: 1, event: 1 }, { unique: true });
registrationSchema.index({ event: 1 });
registrationSchema.index({ user: 1 });
registrationSchema.index({ status: 1 });
registrationSchema.index({ registrationDate: -1 });

module.exports = mongoose.model('Registration', registrationSchema);