const mongoose = require('mongoose');

const NotificationPreferencesSchema = new mongoose.Schema({
  userAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  
  // Global notification settings
  globalSettings: {
    enabled: { type: Boolean, default: true },
    frequency: {
      type: String,
      enum: ['IMMEDIATE', 'HOURLY', 'DAILY', 'WEEKLY'],
      default: 'IMMEDIATE'
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: '22:00' }, // 24-hour format
      endTime: { type: String, default: '08:00' },
      timezone: { type: String, default: 'UTC' }
    }
  },
  
  // Social notification preferences
  social: {
    likes: { type: Boolean, default: true },
    comments: { type: Boolean, default: true },
    follows: { type: Boolean, default: true },
    mentions: { type: Boolean, default: true },
    replies: { type: Boolean, default: true },
    nftMints: { type: Boolean, default: true }
  },
  
  // Governance notification preferences
  governance: {
    // Case-related notifications
    newCases: { type: Boolean, default: true },
    caseResolutions: { type: Boolean, default: true },
    caseExecutions: { type: Boolean, default: true },
    appealsFilied: { type: Boolean, default: true },
    evidenceAdded: { type: Boolean, default: true },
    caseEscalated: { type: Boolean, default: true },
    statusUpdates: { type: Boolean, default: true },
    
    // Voting notifications
    votingStarted: { type: Boolean, default: true },
    votingReminders: { type: Boolean, default: true },
    votingDeadlines: { type: Boolean, default: true },
    
    // Community notifications
    participationRewards: { type: Boolean, default: true },
    communityUpdates: { type: Boolean, default: true },
    
    // Urgency-based preferences
    urgencyFilters: {
      low: { type: Boolean, default: true },
      normal: { type: Boolean, default: true },
      high: { type: Boolean, default: true },
      critical: { type: Boolean, default: true }
    },
    
    // Case type preferences
    caseTypeFilters: {
      contentAppeals: { type: Boolean, default: true },
      userReports: { type: Boolean, default: true },
      communityProposals: { type: Boolean, default: true },
      policyViolations: { type: Boolean, default: true },
      moderationReviews: { type: Boolean, default: true }
    }
  },
  
  // Delivery method preferences
  deliveryMethods: {
    inApp: { type: Boolean, default: true },
    email: {
      enabled: { type: Boolean, default: false },
      address: { type: String },
      verified: { type: Boolean, default: false },
      verificationToken: { type: String },
      verificationExpires: { type: Date }
    },
    push: {
      enabled: { type: Boolean, default: false },
      endpoint: { type: String },
      keys: {
        p256dh: { type: String },
        auth: { type: String }
      }
    },
    webhook: {
      enabled: { type: Boolean, default: false },
      url: { type: String },
      secret: { type: String },
      events: [{ type: String }]
    }
  },
  
  // Digest preferences
  digest: {
    enabled: { type: Boolean, default: false },
    frequency: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY'],
      default: 'WEEKLY'
    },
    time: { type: String, default: '09:00' },
    timezone: { type: String, default: 'UTC' },
    includeCategories: {
      social: { type: Boolean, default: true },
      governance: { type: Boolean, default: true },
      system: { type: Boolean, default: false }
    }
  }
}, {
  timestamps: true
});

// Indexes
// userAddress index already declared via schema-level `unique: true`
NotificationPreferencesSchema.index({ 'deliveryMethods.email.address': 1 });
NotificationPreferencesSchema.index({ 'digest.enabled': 1, 'digest.frequency': 1 });

// Instance methods
NotificationPreferencesSchema.methods.shouldReceiveNotification = function(notification) {
  // Check if notifications are globally enabled
  if (!this.globalSettings.enabled) {
    return false;
  }
  
  // Check quiet hours
  if (this.globalSettings.quietHours.enabled) {
    const now = new Date();
    const currentTime = now.toTimeString().substr(0, 5);
    const { startTime, endTime } = this.globalSettings.quietHours;
    
    if (startTime > endTime) { // Overnight quiet hours
      if (currentTime >= startTime || currentTime <= endTime) {
        return false;
      }
    } else { // Same day quiet hours
      if (currentTime >= startTime && currentTime <= endTime) {
        return false;
      }
    }
  }
  
  // Check category-specific preferences
  if (notification.category === 'SOCIAL') {
    const socialType = notification.type;
    if (this.social[socialType] === false) {
      return false;
    }
  }
  
  if (notification.category === 'GOVERNANCE') {
    // Check governance preferences based on notification type
    const govType = notification.type.replace('governance_', '');
    
    // Map notification types to preference keys
    const typeMap = {
      'case_created': 'newCases',
      'case_resolved': 'caseResolutions',
      'case_executed': 'caseExecutions',
      'appeal_filed': 'appealsFilied',
      'evidence_added': 'evidenceAdded',
      'case_escalated': 'caseEscalated',
      'status_update': 'statusUpdates',
      'voting_started': 'votingStarted',
      'voting_reminder': 'votingReminders',
      'deadline_approaching': 'votingDeadlines',
      'participation_reward': 'participationRewards',
      'community_update': 'communityUpdates'
    };
    
    const prefKey = typeMap[govType];
    if (prefKey && this.governance[prefKey] === false) {
      return false;
    }
    
    // Check urgency filters
    if (notification.governanceCase?.urgency) {
      const urgency = notification.governanceCase.urgency.toLowerCase();
      if (this.governance.urgencyFilters[urgency] === false) {
        return false;
      }
    }
    
    // Check case type filters
    if (notification.governanceCase?.caseType) {
      const caseType = notification.governanceCase.caseType;
      const caseTypeMap = {
        'CONTENT_REPORT': 'contentReports',
        'USER_REPORT': 'userReports',
        'COMMUNITY_PROPOSAL': 'communityProposals',
        'POLICY_VIOLATION': 'policyViolations',
        'MODERATION_REVIEW': 'moderationReviews'
      };
      
      const filterKey = caseTypeMap[caseType];
      if (filterKey && this.governance.caseTypeFilters[filterKey] === false) {
        return false;
      }
    }
  }
  
  return true;
};

NotificationPreferencesSchema.methods.getEnabledDeliveryMethods = function() {
  const methods = [];
  
  if (this.deliveryMethods.inApp) {
    methods.push('IN_APP');
  }
  
  if (this.deliveryMethods.email.enabled && this.deliveryMethods.email.verified) {
    methods.push('EMAIL');
  }
  
  if (this.deliveryMethods.push.enabled && this.deliveryMethods.push.endpoint) {
    methods.push('PUSH');
  }
  
  if (this.deliveryMethods.webhook.enabled && this.deliveryMethods.webhook.url) {
    methods.push('WEBHOOK');
  }
  
  return methods;
};

// Static methods
NotificationPreferencesSchema.statics.getOrCreatePreferences = async function(userAddress) {
  let preferences = await this.findOne({ userAddress: userAddress.toLowerCase() });
  
  if (!preferences) {
    preferences = await this.create({
      userAddress: userAddress.toLowerCase()
    });
  }
  
  return preferences;
};

module.exports = mongoose.model('NotificationPreferences', NotificationPreferencesSchema);