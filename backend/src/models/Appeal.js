const mongoose = require('mongoose');

const appealSchema = new mongoose.Schema({
  // Appeal identification
  appealId: {
    type: String,
    required: true,
    unique: true,
    default: () => `appeal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },

  // Content being appealed
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'contentType'
  },
  contentType: {
    type: String,
    required: true,
    enum: ['Post', 'Comment']
  },

  // Original moderation details
  originalModerationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AIModeration',
    required: true
  },
  moderationFlagId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ModerationFlag',
    required: false
  },

  // Appeal details
  appealerAddress: {
    type: String,
    required: true,
    match: /^0x[a-fA-F0-9]{40}$/
  },
  appealReason: {
    type: String,
    required: true,
    enum: [
      'false_positive',
      'context_misunderstood', 
      'cultural_difference',
      'sarcasm_humor',
      'educational_content',
      'artistic_expression',
      'historical_reference',
      'technical_error',
      'other'
    ]
  },
  appealDescription: {
    type: String,
    required: true,
    maxlength: 1000
  },

  // Supporting evidence
  evidence: [{
    type: {
      type: String,
      enum: ['link', 'explanation', 'context', 'reference']
    },
    content: String,
    url: String
  }],

  // Appeal status and workflow
  status: {
    type: String,
    enum: [
      'pending',           // Just submitted
      'under_review',      // Being reviewed by moderators
      'community_vote',    // Sent to governance system
      'approved',          // Appeal accepted
      'rejected',          // Appeal denied
      'withdrawn'          // Appealer withdrew
    ],
    default: 'pending'
  },

  // Review process
  reviewedBy: {
    moderatorAddress: String,
    reviewDate: Date,
    reviewNotes: String,
    recommendation: {
      type: String,
      enum: ['approve', 'reject', 'escalate_to_community']
    }
  },

  // Community governance integration
  governanceProposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proposal'
  },
  communityVoteRequired: {
    type: Boolean,
    default: false
  },

  // Resolution
  resolution: {
    decision: {
      type: String,
      enum: ['upheld', 'overturned', 'partial']
    },
    decisionDate: Date,
    decisionBy: {
      type: String,
      enum: ['moderator', 'community', 'algorithm']
    },
    reasoning: String,
    actionTaken: {
      contentRestored: Boolean,
      flagRemoved: Boolean,
      userNotified: Boolean,
      moderationSystemAdjusted: Boolean
    }
  },

  // Timestamps
  submittedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date,

  // Analytics and learning
  processingTime: Number, // Minutes from submission to resolution
  escalationReason: String,
  outcomeCategory: {
    type: String,
    enum: ['justified_appeal', 'frivolous_appeal', 'system_improvement', 'edge_case']
  },

  // Notifications sent
  notificationsSent: [{
    type: {
      type: String,
      enum: ['appeal_received', 'under_review', 'community_vote_started', 'resolution']
    },
    sentAt: Date,
    recipient: String
  }]
});

// Indexes for efficient querying
appealSchema.index({ appealerAddress: 1, status: 1 });
appealSchema.index({ contentId: 1, contentType: 1 });
appealSchema.index({ status: 1, submittedAt: -1 });
appealSchema.index({ governanceProposalId: 1 });

// Methods
appealSchema.methods.escalateToGovernance = async function() {
  this.status = 'community_vote';
  this.communityVoteRequired = true;
  this.lastUpdated = new Date();
  return await this.save();
};

appealSchema.methods.resolve = async function(decision, decisionBy, reasoning, actionTaken) {
  this.resolution = {
    decision,
    decisionDate: new Date(),
    decisionBy,
    reasoning,
    actionTaken: actionTaken || {}
  };
  this.status = decision === 'overturned' ? 'approved' : 'rejected';
  this.resolvedAt = new Date();
  this.lastUpdated = new Date();
  
  // Calculate processing time
  this.processingTime = Math.round(
    (this.resolvedAt - this.submittedAt) / (1000 * 60)
  );
  
  return await this.save();
};

// Static methods
appealSchema.statics.getPendingAppeals = function() {
  return this.find({ 
    status: { $in: ['pending', 'under_review'] } 
  }).sort({ submittedAt: 1 });
};

appealSchema.statics.getAppealsByUser = function(userAddress) {
  return this.find({ appealerAddress: userAddress })
    .sort({ submittedAt: -1 })
    .populate('originalModerationId')
    .populate('governanceProposalId');
};

appealSchema.statics.getAppealsRequiringGovernance = function() {
  return this.find({ 
    status: 'community_vote',
    communityVoteRequired: true,
    governanceProposalId: { $exists: false }
  });
};

// Pre-save middleware
appealSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

const Appeal = mongoose.model('Appeal', appealSchema);

module.exports = Appeal;