const mongoose = require('mongoose');

/**
 * AI Moderation Result Schema
 * Tracks all AI analysis results for auditing and learning
 */
const aiModerationSchema = new mongoose.Schema({
  // Content identification
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true
  },
  contentType: {
    type: String,
    enum: ['post', 'comment', 'user_bio', 'user_name'],
    required: true
  },
  contentText: {
    type: String,
    required: true,
    maxlength: 5000
  },
  contentImageUrl: {
    type: String,
    default: null
  },

  // User context
  authorAddress: {
    type: String,
    required: true,
    index: true
  },
  userHistory: {
    recentPostCount: { type: Number, default: 0 },
    accountAge: { type: Number, default: 0 }, // days
    previousFlags: { type: Number, default: 0 }
  },

  // AI Analysis Results
  analysis: {
    // Overall decision
    action: {
      type: String,
      enum: ['approve', 'flag', 'block', 'review'],
      required: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true
    },
    approved: {
      type: Boolean,
      required: true
    },
    flagged: {
      type: Boolean,
      default: false
    },

    // Method breakdown
    methods: {
      rulesBased: {
        used: { type: Boolean, default: false },
        result: { type: String },
        issues: [String],
        confidence: Number
      },
      perspective: {
        used: { type: Boolean, default: false },
        scores: {
          toxicity: Number,
          severeToxicity: Number,
          identityAttack: Number,
          insult: Number,
          profanity: Number,
          threat: Number
        },
        confidence: Number
      },
      openai: {
        used: { type: Boolean, default: false },
        categories: mongoose.Schema.Types.Mixed,
        flagged: Boolean,
        confidence: Number
      },
      image: {
        used: { type: Boolean, default: false },
        result: mongoose.Schema.Types.Mixed,
        confidence: Number
      }
    },

    // Final reasoning
    primaryReason: {
      type: String,
      maxlength: 500
    },
    allReasons: [String],
    
    // Performance metrics
    processingTime: {
      type: Number, // milliseconds
      required: true
    },
    apiCosts: {
      perspective: { type: Number, default: 0 },
      openai: { type: Number, default: 0 }
    }
  },

  // Post-analysis tracking
  outcome: {
    // Final decision after human review (if any)
    finalAction: {
      type: String,
      enum: ['approved', 'rejected', 'edited', 'pending'],
      default: null
    },
    reviewedBy: {
      type: String, // wallet address of reviewer
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    communityVote: {
      proposalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Proposal',
        default: null
      },
      result: {
        type: String,
        enum: ['approve', 'reject', 'pending'],
        default: null
      },
      voteCount: {
        approve: { type: Number, default: 0 },
        reject: { type: Number, default: 0 }
      }
    }
  },

  // Learning & improvement
  feedback: {
    userAppeal: {
      submitted: { type: Boolean, default: false },
      reason: { type: String, maxlength: 1000 },
      submittedAt: Date
    },
    adminOverride: {
      overridden: { type: Boolean, default: false },
      newDecision: String,
      reason: String,
      adminAddress: String,
      overriddenAt: Date
    },
    accuracy: {
      // Populated later for ML training
      wasCorrect: { type: Boolean, default: null },
      falsePositive: { type: Boolean, default: null },
      falseNegative: { type: Boolean, default: null }
    }
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
aiModerationSchema.index({ authorAddress: 1, createdAt: -1 });
aiModerationSchema.index({ 'analysis.action': 1, createdAt: -1 });
aiModerationSchema.index({ 'analysis.flagged': 1, createdAt: -1 });
aiModerationSchema.index({ 'outcome.finalAction': 1 });

// Update the updatedAt field on save
aiModerationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
aiModerationSchema.methods.toSummary = function() {
  return {
    id: this._id,
    action: this.analysis.action,
    confidence: this.analysis.confidence,
    flagged: this.analysis.flagged,
    method: this.analysis.methods,
    createdAt: this.createdAt,
    outcome: this.outcome.finalAction
  };
};

// Static methods
aiModerationSchema.statics.getRecentFlags = function(authorAddress, hours = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    authorAddress,
    'analysis.flagged': true,
    createdAt: { $gte: cutoff }
  }).sort({ createdAt: -1 });
};

aiModerationSchema.statics.getAccuracyStats = function(days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.aggregate([
    { $match: { createdAt: { $gte: cutoff } } },
    {
      $group: {
        _id: '$analysis.action',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$analysis.confidence' },
        correctPredictions: {
          $sum: {
            $cond: [{ $eq: ['$feedback.accuracy.wasCorrect', true] }, 1, 0]
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('AIModeration', aiModerationSchema);