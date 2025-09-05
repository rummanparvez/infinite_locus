const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
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
  score: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    maxlength: 1000
  },
  aspects: {
    organization: {
      type: Number,
      min: 1,
      max: 5
    },
    content: {
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
  isAnonymous: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  helpfulVotes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    helpful: Boolean
  }]
}, {
  timestamps: true
});

ratingSchema.virtual('helpfulCount').get(function() {
  return this.helpfulVotes ? this.helpfulVotes.filter(vote => vote.helpful).length : 0;
});

ratingSchema.statics.getEventStats = async function(eventId) {
  const stats = await this.aggregate([
    { $match: { event: mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$score' },
        totalRatings: { $sum: 1 },
        ratingDistribution: {
          $push: '$score'
        },
        averageOrganization: { $avg: '$aspects.organization' },
        averageContent: { $avg: '$aspects.content' },
        averageVenue: { $avg: '$aspects.venue' },
        averageSpeakers: { $avg: '$aspects.speakers' }
      }
    }
  ]);
  
  return stats[0] || {
    averageRating: 0,
    totalRatings: 0,
    ratingDistribution: [],
    averageOrganization: 0,
    averageContent: 0,
    averageVenue: 0,
    averageSpeakers: 0
  };
};

ratingSchema.index({ user: 1, event: 1 }, { unique: true });
ratingSchema.index({ event: 1 });
ratingSchema.index({ score: 1 });

module.exports = mongoose.model('Rating', ratingSchema);