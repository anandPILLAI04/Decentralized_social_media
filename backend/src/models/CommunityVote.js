const mongoose = require('mongoose');

/**
 * Community Vote Schema
 * Enhanced voting system for governance cases
 */
const communityVoteSchema = new mongoose.Schema({
  // Voting identification
  voteId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  
  // Governance case reference
  governanceCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GovernanceCase',
    required: true,
    index: true
  },
  caseId: {
    type: String,
    required: true,
    index: true
  },
  
  // Voter information
  voter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  voterAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  voterUsername: {
    type: String,
    required: true
  },
  
  // Voting power calculation
  votingPower: {
    base: { type: Number, default: 1 }, // Base voting power (1 per user)
    reputation: { type: Number, default: 0 }, // Based on community standing
    stake: { type: Number, default: 0 }, // Token-based weight
    expertise: { type: Number, default: 0 }, // Domain expertise bonus
    total: { type: Number, required: true }
  },
  
  // Vote decision
  decision: {
    type: String,
    enum: ['APPROVE', 'REJECT'],
    required: true,
    index: true
  },
  confidence: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  
  // Detailed reasoning
  reasoning: {
    type: String,
    required: true,
    maxlength: 1000
  },
  category: {
    type: String,
    enum: ['POLICY_BASED', 'EVIDENCE_BASED', 'COMMUNITY_STANDARDS', 'TECHNICAL', 'OTHER'],
    required: true
  },
  
  // Evidence and justification
  supportingEvidence: [{
    type: {
      type: String,
      enum: ['EXISTING_PRECEDENT', 'COMMUNITY_GUIDELINE', 'TECHNICAL_ANALYSIS', 'USER_BEHAVIOR_PATTERN', 'OTHER']
    },
    description: String,
    reference: String // Case ID, guideline section, etc.
  }],
  
  // Conditional voting
  conditions: [{
    condition: String,
    priority: {
      type: String,
      enum: ['MUST_HAVE', 'NICE_TO_HAVE', 'SUGGESTION']
    }
  }],
  
  // Vote modification tracking
  modified: {
    type: Boolean,
    default: false
  },
  modificationHistory: [{
    previousDecision: String,
    previousReasoning: String,
    modifiedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }],
  
  // Quality metrics
  helpfulnessScore: {
    type: Number,
    default: 0,
    min: 0
  },
  flaggedAsInappropriate: {
    type: Boolean,
    default: false
  },
  verifiedByExpert: {
    type: Boolean,
    default: false
  },
  
  // Interaction tracking
  endorsements: [{
    endorser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    endorserAddress: String,
    reason: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  submissionMethod: {
    type: String,
    enum: ['WEB_UI', 'MOBILE_APP', 'API', 'BLOCKCHAIN'],
    default: 'WEB_UI'
  },
  ipfsHash: String, // For immutable vote storage
  blockchainTxHash: String, // If recorded on-chain
  
  // Privacy and transparency
  publicVote: {
    type: Boolean,
    default: true
  },
  anonymousReasoning: {
    type: Boolean,
    default: false
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
communityVoteSchema.index({ governanceCase: 1, voter: 1 }, { unique: true }); // One vote per user per case
communityVoteSchema.index({ voterAddress: 1, createdAt: -1 });
communityVoteSchema.index({ decision: 1, confidence: 1 });
communityVoteSchema.index({ 'votingPower.total': -1 });

// Virtual fields
communityVoteSchema.virtual('isModified').get(function() {
  return this.modificationHistory && this.modificationHistory.length > 0;
});

communityVoteSchema.virtual('trustScore').get(function() {
  let score = this.confidence / 5; // Base from confidence
  
  if (this.verifiedByExpert) score += 0.2;
  if (this.reasoning && this.reasoning.length > 100) score += 0.1;
  if (this.supportingEvidence && this.supportingEvidence.length > 0) score += 0.1;
  if (this.endorsements && this.endorsements.length > 0) score += 0.1;
  if (this.flaggedAsInappropriate) score -= 0.3;
  
  return Math.min(1, Math.max(0, score));
});

// Methods
communityVoteSchema.methods.generateVoteId = function() {
  const timestamp = Date.now().toString(36);
  const voterShort = this.voterAddress.slice(-6);
  const random = Math.random().toString(36).substr(2, 3);
  return `VOTE_${timestamp}_${voterShort}_${random}`.toUpperCase();
};

communityVoteSchema.methods.calculateVotingPower = function(userProfile) {
  // Base power (everyone gets 1)
  this.votingPower.base = 1;
  
  // Reputation bonus (0-2 points based on community standing)
  if (userProfile.reputation) {
    this.votingPower.reputation = Math.min(2, userProfile.reputation / 50);
  }
  
  // Stake bonus (token holdings)
  if (userProfile.tokenBalance) {
    this.votingPower.stake = Math.min(3, userProfile.tokenBalance / 1000);
  }
  
  // Expertise bonus (for specific case types)
  if (userProfile.expertise && userProfile.expertise.includes(this.category)) {
    this.votingPower.expertise = 0.5;
  }
  
  // Total calculation
  this.votingPower.total = this.votingPower.base + 
                           this.votingPower.reputation + 
                           this.votingPower.stake + 
                           this.votingPower.expertise;
  
  return this.votingPower.total;
};

communityVoteSchema.methods.canModify = function() {
  const hoursSinceCreation = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceCreation < 24 && !this.verifiedByExpert;
};

communityVoteSchema.methods.addEndorsement = function(endorserUser, reason) {
  if (!this.endorsements.find(e => e.endorser.toString() === endorserUser._id.toString())) {
    this.endorsements.push({
      endorser: endorserUser._id,
      endorserAddress: endorserUser.walletAddress,
      reason: reason || 'Well-reasoned vote'
    });
    this.helpfulnessScore += 1;
  }
};

// Pre-save middleware
communityVoteSchema.pre('save', function(next) {
  if (!this.voteId) {
    this.voteId = this.generateVoteId();
  }
  
  // Ensure voting power is calculated
  if (!this.votingPower.total || this.votingPower.total === 0) {
    this.votingPower.total = this.votingPower.base || 1;
  }
  
  next();
});

// Static methods
communityVoteSchema.statics.getVotingStats = async function(governanceCaseId) {
  return await this.aggregate([
    { $match: { governanceCase: new mongoose.Types.ObjectId(governanceCaseId) } },
    {
      $group: {
        _id: '$decision',
        count: { $sum: 1 },
        totalWeight: { $sum: '$votingPower.total' },
        avgConfidence: { $avg: '$confidence' },
        votes: { $push: '$$ROOT' }
      }
    }
  ]);
};

communityVoteSchema.statics.getTopVoters = async function(timeframe = '30d') {
  const daysAgo = new Date(Date.now() - parseInt(timeframe) * 24 * 60 * 60 * 1000);
  
  return await this.aggregate([
    { $match: { createdAt: { $gte: daysAgo } } },
    {
      $group: {
        _id: '$voter',
        totalVotes: { $sum: 1 },
        totalWeight: { $sum: '$votingPower.total' },
        avgConfidence: { $avg: '$confidence' },
        helpfulnessScore: { $avg: '$helpfulnessScore' }
      }
    },
    { $sort: { helpfulnessScore: -1, totalWeight: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'voterInfo'
      }
    }
  ]);
};

module.exports = mongoose.model('CommunityVote', communityVoteSchema);