const mongoose = require('mongoose');

/**
 * Community Member Schema
 * Enhanced user profile for governance participation
 */
const communityMemberSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,  // Allow null for wallet-only accounts
    index: true
  },
  walletAddress: {
    type: String,
    required: true,
    lowercase: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    index: true
  },
  
  // Governance participation
  governanceProfile: {
    // Participation metrics
    totalVotes: { type: Number, default: 0 },
    totalProposals: { type: Number, default: 0 },
    totalReports: { type: Number, default: 0 },
    participationScore: { type: Number, default: 0 },
    
    // Quality metrics
    helpfulVotes: { type: Number, default: 0 },
    verifiedVotes: { type: Number, default: 0 },
    accuracyRating: { type: Number, default: 0 }, // 0-100
    
    // Reputation system
    reputationScore: { type: Number, default: 0 },
    expertiseAreas: [{
      category: String,
      level: { type: Number, min: 1, max: 5 },
      earnedAt: { type: Date, default: Date.now },
      verifiedBy: String
    }],
    
    // Community standing
    trustLevel: {
      type: String,
      enum: ['NEWCOMER', 'MEMBER', 'TRUSTED', 'EXPERT', 'MODERATOR'],
      default: 'NEWCOMER'
    },
    badges: [{
      name: String,
      description: String,
      earnedAt: { type: Date, default: Date.now },
      iconUrl: String
    }],
    
    // Voting power components (enhanced system)
    totalVotingPower: { type: Number, default: 50 }, // Total calculated voting power
    powerLevel: {
      type: String,
      enum: ['NEWCOMER', 'PARTICIPANT', 'REGULAR_MEMBER', 'ACTIVE_MEMBER', 'SENIOR_MEMBER', 'GOVERNANCE_EXPERT'],
      default: 'NEWCOMER'
    },
    lastPowerCalculation: { type: Date, default: Date.now },
    powerBreakdown: {
      base: {
        raw: { type: Number, default: 50 },
        weighted: { type: Number, default: 10 },
        percentage: { type: Number, default: 20 }
      },
      transactions: {
        raw: { type: Number, default: 0 },
        weighted: { type: Number, default: 0 },
        percentage: { type: Number, default: 30 },
        details: {
          totalTransactions: { type: Number, default: 0 },
          recentTransactions: { type: Number, default: 0 },
          score: { type: Number, default: 0 }
        }
      },
      accountAge: {
        raw: { type: Number, default: 0 },
        weighted: { type: Number, default: 0 },
        percentage: { type: Number, default: 25 },
        details: {
          estimatedAge: { type: Number, default: 0 },
          score: { type: Number, default: 0 }
        }
      },
      participation: {
        raw: { type: Number, default: 0 },
        weighted: { type: Number, default: 0 },
        percentage: { type: Number, default: 25 },
        details: {
          totalVotes: { type: Number, default: 0 },
          totalProposals: { type: Number, default: 0 },
          accuracyRating: { type: Number, default: 0 }
        }
      }
    },
    
    // Legacy voting power (kept for compatibility)
    basePower: { type: Number, default: 1 },
    reputationBonus: { type: Number, default: 0 },
    stakeBonus: { type: Number, default: 0 },
    expertiseBonus: { type: Number, default: 0 }
  },
  
  // Engagement history
  participationHistory: {
    firstVote: Date,
    lastVote: Date,
    longestStreak: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    avgVotingFrequency: { type: Number, default: 0 }, // votes per week
    
    // Case type preferences
    preferredCaseTypes: [{
      type: { type: String },
      count: { type: Number, default: 0 },
      successRate: { type: Number, default: 0 }
    }],
    
    // Monthly activity
    monthlyActivity: [{
      month: String, // YYYY-MM
      votes: Number,
      proposals: Number,
      reports: Number,
      helpfulnessScore: Number
    }]
  },
  
  // Community contribution
  contributions: {
    // Content creation
    helpfulComments: { type: Number, default: 0 },
    qualityReports: { type: Number, default: 0 },
    educationalPosts: { type: Number, default: 0 },
    
    // Moderation assistance
    flaggedContent: { type: Number, default: 0 },
    reviewedCases: { type: Number, default: 0 },
    mentoredUsers: { type: Number, default: 0 },
    
    // Knowledge sharing
    wikiBuryedits: { type: Number, default: 0 },
    tutorialsCreated: { type: Number, default: 0 },
    questionsAnswered: { type: Number, default: 0 }
  },
  
  // Behavioral tracking
  behavior: {
    // Voting patterns
    avgVoteConfidence: { type: Number, default: 0 },
    voteConsistency: { type: Number, default: 0 }, // How consistent with community
    evidenceUsage: { type: Number, default: 0 }, // How often they cite evidence
    
    // Interaction quality
    constructiveComments: { type: Number, default: 0 },
    diplomaticResolution: { type: Number, default: 0 },
    respectfulDisagreement: { type: Number, default: 0 },
    
    // Red flags
    suspiciousVoting: { type: Number, default: 0 },
    coordinated: { type: Boolean, default: false },
    extremePositions: { type: Number, default: 0 },
    
    // Community violations
    warnings: [{
      type: String,
      description: String,
      issuedAt: Date,
      issuedBy: String,
      resolved: { type: Boolean, default: false }
    }],
    restrictions: [{
      type: { type: String, enum: ['VOTING_SUSPENDED', 'PROPOSAL_BLOCKED', 'LIMITED_POWER'] },
      reason: String,
      startDate: Date,
      endDate: Date,
      active: { type: Boolean, default: true }
    }]
  },
  
  // Specializations and interests
  interests: {
    contentModerationExpert: { type: Boolean, default: false },
    technicalSpecialist: { type: Boolean, default: false },
    communityBuilder: { type: Boolean, default: false },
    legalAdvisor: { type: Boolean, default: false },
    
    topicAreas: [String], // ['crypto', 'art', 'technology', 'politics', etc.]
    languagesSpoken: [String],
    timezoneActive: String
  },
  
  // Settings and preferences
  settings: {
    notifications: {
      newCases: { type: Boolean, default: true },
      votingReminders: { type: Boolean, default: true },
      resultUpdates: { type: Boolean, default: true },
      expertiseAlerts: { type: Boolean, default: true }
    },
    
    privacy: {
      showVotingHistory: { type: Boolean, default: true },
      showExpertise: { type: Boolean, default: true },
      allowDirectContact: { type: Boolean, default: true }
    },
    
    autoSettings: {
      autoVoteOnSimpleCases: { type: Boolean, default: false },
      followExpertRecommendations: { type: Boolean, default: false },
      participateInUrgentCases: { type: Boolean, default: true }
    }
  },
  
  // Recognition and achievements
  achievements: {
    votingMilestones: [{
      milestone: String, // '100_votes', '500_votes', etc.
      achievedAt: Date,
      reward: String
    }],
    
    qualityRecognition: [{
      type: String, // 'most_helpful_voter', 'expert_of_month'
      period: String,
      details: String,
      achievedAt: Date
    }],
    
    leaderboardRankings: [{
      category: String,
      rank: Number,
      period: String,
      recordedAt: Date
    }]
  },
  
  // Social connections
  network: {
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommunityMember' }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommunityMember' }],
    
    collaborators: [{
      member: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityMember' },
      collaborationType: String,
      projects: [String],
      since: Date
    }],
    
    mentoring: {
      mentees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommunityMember' }],
      mentors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CommunityMember' }]
    }
  },
  
  // Status flags
  status: {
    active: { type: Boolean, default: true },
    verified: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
    
    lastSeen: { type: Date, default: Date.now },
    joinedGovernanceAt: { type: Date, default: Date.now }
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
communityMemberSchema.index({ 'governanceProfile.reputationScore': -1 });
communityMemberSchema.index({ 'governanceProfile.totalVotingPower': -1 });
communityMemberSchema.index({ 'governanceProfile.trustLevel': 1, 'status.active': 1 });
communityMemberSchema.index({ 'interests.topicAreas': 1 });

// Virtual fields
communityMemberSchema.virtual('isExpert').get(function() {
  return this.governanceProfile.trustLevel === 'EXPERT' || 
         this.governanceProfile.expertiseAreas.length > 0;
});

communityMemberSchema.virtual('participationRate').get(function() {
  const daysActive = Math.max(1, (Date.now() - this.status.joinedGovernanceAt) / (1000 * 60 * 60 * 24));
  return this.governanceProfile.totalVotes / daysActive;
});

communityMemberSchema.virtual('qualityScore').get(function() {
  if (this.governanceProfile.totalVotes === 0) return 0;
  
  const helpfulRatio = this.governanceProfile.helpfulVotes / this.governanceProfile.totalVotes;
  const accuracyScore = this.governanceProfile.accuracyRating / 100;
  const consistencyScore = this.behavior.voteConsistency / 100;
  
  return (helpfulRatio * 0.4 + accuracyScore * 0.4 + consistencyScore * 0.2) * 100;
});

// Methods
communityMemberSchema.methods.updateReputationScore = function() {
  let score = 0;
  
  // Base participation
  score += this.governanceProfile.totalVotes * 0.1;
  score += this.governanceProfile.totalProposals * 2;
  score += this.governanceProfile.totalReports * 0.5;
  
  // Quality multipliers
  score *= (1 + this.governanceProfile.accuracyRating / 200); // 0.5x to 1.5x
  score *= (1 + this.behavior.voteConsistency / 200);
  
  // Community contributions
  score += this.contributions.helpfulComments * 0.2;
  score += this.contributions.qualityReports * 1;
  score += this.contributions.reviewedCases * 0.5;
  
  // Penalties
  score -= this.behavior.suspiciousVoting * 5;
  score -= this.behavior.warnings.length * 10;
  
  this.governanceProfile.reputationScore = Math.max(0, score);
  return this.governanceProfile.reputationScore;
};

communityMemberSchema.methods.calculateVotingPower = function() {
  // Base power (1 for everyone)
  this.governanceProfile.basePower = 1;
  
  // Reputation bonus (0-2 based on reputation)
  this.governanceProfile.reputationBonus = Math.min(2, this.governanceProfile.reputationScore / 50);
  
  // Expertise bonus
  this.governanceProfile.expertiseBonus = this.governanceProfile.expertiseAreas.length * 0.3;
  
  // Total calculation
  this.governanceProfile.totalVotingPower = 
    this.governanceProfile.basePower +
    this.governanceProfile.reputationBonus +
    this.governanceProfile.stakeBonus +
    this.governanceProfile.expertiseBonus;
  
  return this.governanceProfile.totalVotingPower;
};

communityMemberSchema.methods.canVoteOnCase = function(governanceCase) {
  if (!this.status.active || this.status.suspended) return false;
  
  // Check restrictions
  const activeRestrictions = this.behavior.restrictions.filter(r => r.active && r.type === 'VOTING_SUSPENDED');
  if (activeRestrictions.length > 0) return false;
  
  // Minimum participation for sensitive cases
  if (governanceCase.sensitive && this.governanceProfile.totalVotes < 10) return false;
  
  return true;
};

communityMemberSchema.methods.addExpertise = function(category, level, verifier) {
  const existing = this.governanceProfile.expertiseAreas.find(e => e.category === category);
  if (existing) {
    existing.level = Math.max(existing.level, level);
    existing.verifiedBy = verifier;
  } else {
    this.governanceProfile.expertiseAreas.push({
      category,
      level,
      verifiedBy: verifier,
      earnedAt: new Date()
    });
  }
  
  this.calculateVotingPower();
};

communityMemberSchema.methods.recordVote = function(voteData) {
  this.governanceProfile.totalVotes += 1;
  this.participationHistory.lastVote = new Date();
  
  if (!this.participationHistory.firstVote) {
    this.participationHistory.firstVote = new Date();
  }
  
  // Initialize participationHistory arrays if they don't exist
  if (!this.participationHistory.monthlyActivity) {
    this.participationHistory.monthlyActivity = [];
  }
  if (!this.participationHistory.preferredCaseTypes) {
    this.participationHistory.preferredCaseTypes = [];
  }
  
  // Update monthly activity
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  let monthlyRecord = this.participationHistory.monthlyActivity.find(m => m.month === currentMonth);
  if (!monthlyRecord) {
    monthlyRecord = { month: currentMonth, votes: 0, proposals: 0, reports: 0, helpfulnessScore: 0 };
    this.participationHistory.monthlyActivity.push(monthlyRecord);
  }
  monthlyRecord.votes += 1;
  
  // Update case type preferences - ensure caseType is a valid string
  const caseType = voteData.caseType || 'UNKNOWN';
  if (typeof caseType === 'string') {
    let preferenceIndex = this.participationHistory.preferredCaseTypes.findIndex(p => p.type === caseType);
    if (preferenceIndex === -1) {
      // Add new preference
      this.participationHistory.preferredCaseTypes.push({
        type: caseType,
        count: 1,
        successRate: 0
      });
    } else {
      // Update existing preference
      this.participationHistory.preferredCaseTypes[preferenceIndex].count += 1;
    }
  }
};

// Static methods
communityMemberSchema.statics.getLeaderboard = async function(category = 'reputation', timeframe = 'all') {
  const matchStage = { 'status.active': true };
  
  if (timeframe !== 'all') {
    const daysAgo = parseInt(timeframe) || 30;
    matchStage.updatedAt = { $gte: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) };
  }
  
  const sortField = {
    'reputation': 'governanceProfile.reputationScore',
    'votes': 'governanceProfile.totalVotes',
    'accuracy': 'governanceProfile.accuracyRating',
    'voting_power': 'governanceProfile.totalVotingPower'
  }[category] || 'governanceProfile.reputationScore';
  
  return await this.aggregate([
    { $match: matchStage },
    { $sort: { [sortField]: -1 } },
    { $limit: 50 },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userInfo'
      }
    },
    {
      $project: {
        username: 1,
        walletAddress: 1,
        'governanceProfile.reputationScore': 1,
        'governanceProfile.totalVotes': 1,
        'governanceProfile.accuracyRating': 1,
        'governanceProfile.totalVotingPower': 1,
        'governanceProfile.trustLevel': 1,
        'userInfo.avatar': 1
      }
    }
  ]);
};

// Create partial index for user field - unique only when user is not null
communityMemberSchema.index(
  { user: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { user: { $ne: null } }
  }
);

module.exports = mongoose.model('CommunityMember', communityMemberSchema);