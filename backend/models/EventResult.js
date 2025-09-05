const mongoose = require('mongoose');

const eventResultSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    unique: true
  },
  summary: {
    type: String,
    required: true,
    maxlength: 2000
  },
  highlights: [String],
  outcomes: [String],
  statistics: {
    totalRegistrations: {
      type: Number,
      default: 0
    },
    actualAttendees: {
      type: Number,
      default: 0
    },
    attendanceRate: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0
    },
    totalFeedback: {
      type: Number,
      default: 0
    }
  },
  winners: [{
    position: {
      type: Number,
      required: true
    },
    participant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    prize: String,
    achievement: String
  }],
  speakers: [{
    name: String,
    designation: String,
    organization: String,
    topic: String,
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  }],
  media: {
    photos: [{
      url: String,
      caption: String,
      photographer: String
    }],
    videos: [{
      url: String,
      title: String,
      duration: Number
    }],
    presentations: [{
      title: String,
      url: String,
      speaker: String
    }]
  },
  feedback: {
    positive: [String],
    improvements: [String],
    suggestions: [String]
  },
  financials: {
    budget: Number,
    actualCost: Number,
    revenue: Number,
    profit: Number,
    expenses: [{
      category: String,
      amount: Number,
      description: String
    }]
  },
  certificates: {
    generated: {
      type: Boolean,
      default: false
    },
    template: String,
    count: {
      type: Number,
      default: 0
    }
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date
}, {
  timestamps: true
});

eventResultSchema.methods.calculateStatistics = async function() {
  const Registration = mongoose.model('Registration');
  const Rating = mongoose.model('Rating');
  
  const registrations = await Registration.countDocuments({ event: this.event });
  const attendees = await Registration.countDocuments({ 
    event: this.event, 
    status: 'attended' 
  });
  
  const ratings = await Rating.find({ event: this.event });
  const averageRating = ratings.length > 0 
    ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length 
    : 0;
  
  this.statistics.totalRegistrations = registrations;
  this.statistics.actualAttendees = attendees;
  this.statistics.attendanceRate = registrations > 0 ? (attendees / registrations) * 100 : 0;
  this.statistics.averageRating = averageRating;
  this.statistics.totalFeedback = ratings.length;
  
  return this.save();
};

eventResultSchema.index({ event: 1 });
eventResultSchema.index({ publishedBy: 1 });
eventResultSchema.index({ isPublished: 1 });

module.exports = mongoose.model('EventResult', eventResultSchema);