const mongoose = require('mongoose');

/**
 * UserViolation Schema
 * Tracks user violations, reputation, and restrictions for moderation system
 */
const userViolationSchema = new mongoose.Schema({
  // User identification
  userAddress: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    default: null
  },

  // Reputation system
  reputation: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  
  // Violation history
  violations: [{
    // Violation details
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    contentType: {
      type: String,
      enum: ['post', 'comment'],
      required: true
    },
    violationType: {
      type: String,
      enum: ['hate_speech', 'spam', 'harassment', 'scam', 'toxic_language', 'threats'],
      required: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'extreme'],
      required: true
    },
    
    // AI analysis data
    aiConfidence: {
      type: Number,
      min: 0,
      max: 1,
      required: true
    },
    aiProvider: {
      type: String,
      enum: ['hugging-face', 'enhanced-rules', 'multi-tier'],
      required: true
    },
    aiReason: {
      type: String,
      required: true
    },
    
    // Content snapshot
    violatingContent: {
      type: String,
      required: true,
      maxlength: 1000
    },
    
    // Timestamps
    detectedAt: {
      type: Date,
      default: Date.now
    },
    
    // Actions taken
    actionTaken: {
      type: String,
      enum: ['warning', 'content_hidden', 'temp_restriction', 'temp_ban', 'suspension', 'ban'],
      required: true
    },
    actionDetails: {
      type: String,
      maxlength: 500
    },
    
    // Status
    status: {
      type: String,
      enum: ['active', 'appealed', 'overturned', 'expired'],
      default: 'active'
    }
  }],

  // Current restrictions
  restrictions: {
    // Posting restrictions
    canPost: {
      type: Boolean,
      default: true
    },
    canComment: {
      type: Boolean,
      default: true
    },
    
    // Restriction timing
    restrictedUntil: {
      type: Date,
      default: null
    },
    restrictionReason: {
      type: String,
      default: null
    },
    restrictionLevel: {
      type: String,
      enum: ['none', 'warning', 'temp_ban', 'temp_restriction', 'suspension', 'permanent_ban'],
      default: 'none'
    },
    
    // Temporary ban duration tracking
    tempBanHours: {
      type: Number,
      default: null
    }
  },

  // Appeal history
  appeals: [{
    violationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    reason: {
      type: String,
      required: true,
      maxlength: 1000
    },
    appealedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'approved', 'denied'],
      default: 'pending'
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewDecision: {
      type: String,
      maxlength: 500
    }
  }],

  // Statistics
  stats: {
    totalViolations: {
      type: Number,
      default: 0
    },
    violationsLast30Days: {
      type: Number,
      default: 0
    },
    lastViolationDate: {
      type: Date,
      default: null
    },
    warningsIssued: {
      type: Number,
      default: 0
    },
    restrictionsApplied: {
      type: Number,
      default: 0
    }
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
// userAddress index already declared via schema-level `index: true`
userViolationSchema.index({ 'restrictions.restrictedUntil': 1 });
userViolationSchema.index({ 'violations.detectedAt': -1 });

// Update the updatedAt timestamp on save
userViolationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
userViolationSchema.methods.isRestricted = function() {
  if (!this.restrictions.restrictedUntil) return false;
  return new Date() < this.restrictions.restrictedUntil;
};

userViolationSchema.methods.canPerformAction = function(actionType) {
  if (this.isRestricted()) {
    if (actionType === 'post' && !this.restrictions.canPost) return false;
    if (actionType === 'comment' && !this.restrictions.canComment) return false;
  }
  return true;
};

userViolationSchema.methods.addViolation = function(violationData) {
  this.violations.push(violationData);
  this.stats.totalViolations += 1;
  this.stats.lastViolationDate = new Date();
  
  // Update reputation
  const severityPenalty = {
    low: -10,
    medium: -20, 
    high: -30,
    extreme: -50
  };
  
  this.reputation = Math.max(0, this.reputation + severityPenalty[violationData.severity]);
  
  // Count recent violations (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  this.stats.violationsLast30Days = this.violations.filter(v => 
    v.detectedAt > thirtyDaysAgo && v.status === 'active'
  ).length;
};

userViolationSchema.methods.applyConsequences = function() {
  const activeViolations = this.violations.filter(v => v.status === 'active');
  const recentViolations = activeViolations.filter(v => 
    v.detectedAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  
  const violationCount = recentViolations.length;
  const hasExtreme = recentViolations.some(v => v.severity === 'extreme');
  
  // NEW ESCALATION LADDER SYSTEM
  // 1st mistake = warning + notification
  // 2nd mistake = temporary ban (24-48 hours)  
  // 3rd mistake = permanent ban
  
  // Determine consequence level based on escalation ladder
  if (violationCount >= 3) {
    // 3rd mistake = Permanent ban
    this.restrictions.restrictionLevel = 'permanent_ban';
    this.restrictions.canPost = false;
    this.restrictions.canComment = false;
    this.restrictions.restrictedUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year (essentially permanent)
    this.restrictions.restrictionReason = 'Third strike violation - permanent ban';
    this.stats.restrictionsApplied += 1;
  } else if (violationCount === 2) {
    // 2nd mistake = Temporary ban (24-48 hours, randomly between 24-48)
    const banHours = 24 + Math.floor(Math.random() * 25); // Random between 24-48 hours
    this.restrictions.restrictionLevel = 'temp_ban';
    this.restrictions.canPost = false;
    this.restrictions.canComment = false;
    this.restrictions.restrictedUntil = new Date(Date.now() + banHours * 60 * 60 * 1000);
    this.restrictions.restrictionReason = `Second strike violation - temporary ban (${banHours} hours)`;
    this.restrictions.tempBanHours = banHours; // Track duration for notifications
    this.stats.restrictionsApplied += 1;
  } else if (violationCount === 1) {
    // 1st mistake = Warning + notification (no functional restrictions)
    this.restrictions.restrictionLevel = 'warning';
    this.restrictions.canPost = true; // Still allowed to post
    this.restrictions.canComment = true; // Still allowed to comment
    this.restrictions.restrictedUntil = null; // No time restriction
    this.restrictions.restrictionReason = 'First strike warning - please review community guidelines';
    this.stats.warningsIssued += 1;
  } else {
    // No violations - clean slate
    this.restrictions.restrictionLevel = 'none';
    this.restrictions.canPost = true;
    this.restrictions.canComment = true;
    this.restrictions.restrictedUntil = null;
    this.restrictions.restrictionReason = null;
  }
  
  return this.restrictions.restrictionLevel;
};

// Static methods
userViolationSchema.statics.getOrCreateUserRecord = async function(userAddress, username = null) {
  let userRecord = await this.findOne({ userAddress });
  
  if (!userRecord) {
    userRecord = new this({
      userAddress,
      username
    });
    await userRecord.save();
  }
  
  return userRecord;
};

userViolationSchema.statics.getModerationStats = function(days = 30) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    { $match: { 'violations.detectedAt': { $gte: cutoff } } },
    { $unwind: '$violations' },
    { $match: { 'violations.detectedAt': { $gte: cutoff } } },
    {
      $group: {
        _id: {
          violationType: '$violations.violationType',
          severity: '$violations.severity'
        },
        count: { $sum: 1 },
        avgConfidence: { $avg: '$violations.aiConfidence' }
      }
    }
  ]);
};

userViolationSchema.statics.getRestrictedUsers = function() {
  return this.find({
    'restrictions.restrictedUntil': { $gt: new Date() }
  }).select('userAddress username restrictions');
};

const UserViolation = mongoose.model('UserViolation', userViolationSchema);

module.exports = UserViolation;