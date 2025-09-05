const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['event', 'speaker', 'venue', 'organization', 'general'],
    default: 'event'
  },
  rating: {
    overall: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    content: {
      type: Number,
      min: 1,
      max: 5
    },
    organization: {
      type: Number,
      min: 1,
      max: 5
    },
    venue: {
      type: Number,
      min: 1,
      max: 5
    },
    speakers: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  comments: {
    liked: String,
    improvements: String,
    suggestions: String,
    additional: String
  },
  questions: [{
    question: String,
    answer: String,
    type: {
      type: String,
      enum: ['text', 'rating', 'choice', 'boolean']
    }
  }],
  isAnonymous: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['submitted', 'reviewed', 'acknowledged'],
    default: 'submitted'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  response: String
}, {
  timestamps: true
});

feedbackSchema.statics.getEventFeedbackSummary = async function(eventId) {
  const summary = await this.aggregate([
    { $match: { event: mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: null,
        totalFeedback: { $sum: 1 },
        averageOverall: { $avg: '$rating.overall' },
        averageContent: { $avg: '$rating.content' },
        averageOrganization: { $avg: '$rating.organization' },
        averageVenue: { $avg: '$rating.venue' },
        averageSpeakers: { $avg: '$rating.speakers' },
        ratingDistribution: {
          $push: '$rating.overall'
        }
      }
    }
  ]);
  
  return summary[0] || {
    totalFeedback: 0,
    averageOverall: 0,
    averageContent: 0,
    averageOrganization: 0,
    averageVenue: 0,
    averageSpeakers: 0,
    ratingDistribution: []
  };
};

feedbackSchema.index({ event: 1 });
feedbackSchema.index({ user: 1 });
feedbackSchema.index({ user: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', feedbackSchema);