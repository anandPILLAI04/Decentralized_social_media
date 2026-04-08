const mongoose = require('mongoose');

/**
 * Moderation Flag Schema
 * Tracks flagged content awaiting community review
 */
const moderationFlagSchema = new mongoose.Schema({
  // Content reference
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  contentType: {
    type: String,
    enum: ['post', 'comment', 'user_profile'],
    required: true
  },
  contentSnapshot: {
    text: { type: String, required: true, maxlength: 5000 },
    imageUrl: { type: String },
    author: {
      address: { type: String, required: true },
      username: String,
      avatarCID: String
    },
    originalCreatedAt: { type: Date, required: true }
  },

  // Flag source
  flaggedBy: {
    source: {
      type: String,
      enum: ['ai_automatic', 'user_report', 'admin_manual'],
      required: true
    },
    aiModerationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIModeration',
      default: null
    },
    reporterAddress: {
      type: String, // wallet address of user who reported
      default: null
    },
    adminAddress: {
      type: String, // wallet address of admin
      default: null
    }
  },

  // Flag details
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  categories: [{
    type: String,
    enum: [
      'spam',
      'harassment', 
      'hate_speech',
      'violence',
      'adult_content',
      'misinformation',
      'copyright',
      'scam',
      'off_topic',
      'duplicate_content',
      'other'
    ]
  }],
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  evidence: {
    aiAnalysis: mongoose.Schema.Types.Mixed,
    userReports: [{
      reporterAddress: String,
      reason: String,
      reportedAt: Date
    }],
    similarContent: [{
      contentId: mongoose.Schema.Types.ObjectId,
      similarity: Number
    }]
  },

  // Current status
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'dismissed', 'appealed'],
    default: 'pending',
    index: true
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },

  // Review process
  review: {
    assignedTo: {
      type: String, // wallet address
      default: null
    },
    assignedAt: {
      type: Date,
      default: null
    },
    reviewStartedAt: {
      type: Date,
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewerNotes: {
      type: String,
      maxlength: 2000
    },
    
    // Community governance
    governanceProposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proposal',
      default: null
    },
    requiresCommunityVote: {
      type: Boolean,
      default: false
    }
  },

  // Resolution
  resolution: {
    decision: {
      type: String,
      enum: ['approve', 'reject', 'edit_required', 'warning_issued'],
      default: null
    },
    reason: {
      type: String,
      maxlength: 1000
    },
    actionTaken: [{
      action: {
        type: String,
        enum: ['content_removed', 'content_edited', 'user_warned', 'user_suspended', 'no_action']
      },
      details: String,
      takenAt: { type: Date, default: Date.now },
      takenBy: String // wallet address
    }],
    resolvedBy: {
      type: String, // wallet address or 'community_vote'
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },

  // Appeals process
  appeals: [{
    appealedBy: {
      type: String, // wallet address
      required: true
    },
    reason: {
      type: String,
      required: true,
      maxlength: 1000
    },
    additionalEvidence: String,
    appealedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'upheld', 'overturned'],
      default: 'pending'
    },
    reviewedAt: Date,
    reviewDecision: String
  }],

  // Metrics & learning
  metrics: {
    responseTime: Number, // minutes from flag to resolution
    communityEngagement: {
      views: { type: Number, default: 0 },
      votes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 }
    },
    accuracy: {
      // Was the flag justified?
      wasValid: { type: Boolean, default: null },
      confidence: { type: Number, min: 0, max: 1 },
      assessedBy: String, // wallet address
      assessedAt: Date
    }
  },

  // Auto-management
  autoResolveAt: {
    type: Date,
    default: function() {
      // Auto-resolve low priority flags after 7 days
      if (this.severity === 'low') {
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      }
      // Medium priority: 3 days
      if (this.severity === 'medium') {
        return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      }
      // High/Critical: manual resolution required
      return null;
    }
  },
  escalatedToAdmin: {
    type: Boolean,
    default: false
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
moderationFlagSchema.index({ status: 1, createdAt: -1 });
moderationFlagSchema.index({ 'flaggedBy.source': 1, createdAt: -1 });
moderationFlagSchema.index({ severity: 1, priority: -1 });
moderationFlagSchema.index({ autoResolveAt: 1 });
moderationFlagSchema.index({ 'contentSnapshot.author.address': 1 });

// Update the updatedAt field on save
moderationFlagSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate response time when resolved
  if (this.resolution.resolvedAt && !this.metrics.responseTime) {
    this.metrics.responseTime = Math.round(
      (this.resolution.resolvedAt - this.createdAt) / (1000 * 60)
    );
  }
  
  next();
});

// Instance methods
moderationFlagSchema.methods.toPublicSummary = function() {
  return {
    id: this._id,
    contentType: this.contentType,
    severity: this.severity,
    categories: this.categories,
    status: this.status,
    flaggedAt: this.createdAt,
    description: this.description,
    requiresVote: this.review.requiresCommunityVote,
    proposalId: this.review.governanceProposalId
  };
};

moderationFlagSchema.methods.canBeReviewedBy = function(userAddress) {
  // Content author cannot review their own flag
  if (this.contentSnapshot.author.address === userAddress) {
    return false;
  }
  
  // Must be pending or under review
  if (!['pending', 'under_review'].includes(this.status)) {
    return false;
  }
  
  // If assigned, only assignee can review
  if (this.review.assignedTo && this.review.assignedTo !== userAddress) {
    return false;
  }
  
  return true;
};

moderationFlagSchema.methods.assignReviewer = function(reviewerAddress) {
  this.review.assignedTo = reviewerAddress;
  this.review.assignedAt = new Date();
  this.status = 'under_review';
  return this.save();
};

// Static methods
moderationFlagSchema.statics.getPendingFlags = function(limit = 50) {
  return this.find({ 
    status: { $in: ['pending', 'under_review'] } 
  })
  .sort({ priority: -1, createdAt: 1 })
  .limit(limit);
};

moderationFlagSchema.statics.getFlagsByUser = function(userAddress, limit = 20) {
  return this.find({ 
    'contentSnapshot.author.address': userAddress 
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

moderationFlagSchema.statics.getModerationStats = function(days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { createdAt: { $gte: cutoff } } },
    {
      $group: {
        _id: {
          status: '$status',
          severity: '$severity'
        },
        count: { $sum: 1 },
        avgResponseTime: { $avg: '$metrics.responseTime' }
      }
    }
  ]);
};

// Auto-resolve expired flags
moderationFlagSchema.statics.autoResolveExpired = async function() {
  const expiredFlags = await this.find({
    autoResolveAt: { $lte: new Date() },
    status: { $in: ['pending', 'under_review'] }
  });

  for (const flag of expiredFlags) {
    flag.status = 'resolved';
    flag.resolution.decision = 'approve'; // Default to approval for expired low-priority flags
    flag.resolution.reason = 'Auto-resolved due to timeout';
    flag.resolution.resolvedBy = 'system';
    flag.resolution.resolvedAt = new Date();
    
    await flag.save();
  }

  return expiredFlags.length;
};

module.exports = mongoose.model('ModerationFlag', moderationFlagSchema);