const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: [
      // Social notifications
      'like', 'comment', 'follow', 'nft_mint', 'reply',
      // Moderation & Appeals
      'content_flagged', 'appeal_received', 'appeal_resolved', 'moderation_action', 
      'moderation_decision',
      // Escalation Ladder Notifications
      'moderation_warning', 'moderation_temp_ban', 'moderation_permanent_ban',
      // Governance notifications
      'governance_case_created', 'governance_voting_started', 'governance_voting_reminder',
      'governance_case_resolved', 'governance_case_executed', 'governance_appeal_filed',
      'governance_evidence_added', 'governance_case_escalated', 'governance_participation_reward',
      'governance_deadline_approaching', 'governance_status_update', 'governance_community_update'
    ]
  },
  recipient: { type: String, required: true, index: true }, // wallet address
  sender: {
    address: { type: String },
    username: { type: String },
    avatar: { type: String }
  },
  content: { 
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  // Governance-specific fields
  governanceCase: {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'GovernanceCase' },
    caseType: { type: String },
    urgency: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] }
  },
  // Notification metadata
  priority: {
    type: String,
    enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
    default: 'NORMAL'
  },
  category: {
    type: String,
    enum: ['SOCIAL', 'GOVERNANCE', 'SYSTEM', 'SECURITY'],
    default: 'SOCIAL'
  },
  // Delivery tracking
  delivery: {
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'DELIVERED', 'FAILED'],
      default: 'PENDING'
    },
    attempts: { type: Number, default: 0 },
    lastAttempt: { type: Date },
    deliveredAt: { type: Date },
    method: {
      type: String,
      enum: ['IN_APP', 'EMAIL', 'PUSH', 'WEBHOOK'],
      default: 'IN_APP'
    }
  },
  read: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },
  // User preferences override
  userPreferences: {
    canEmail: { type: Boolean, default: true },
    canPush: { type: Boolean, default: true },
    frequency: { type: String, enum: ['IMMEDIATE', 'HOURLY', 'DAILY'], default: 'IMMEDIATE' }
  },
  // Expiration for temporary notifications
  expiresAt: { type: Date },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
NotificationSchema.index({ recipient: 1, read: 1, timestamp: -1 });
NotificationSchema.index({ recipient: 1, category: 1, timestamp: -1 });
NotificationSchema.index({ 'governanceCase.caseId': 1, type: 1 });
NotificationSchema.index({ 'delivery.status': 1, timestamp: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance methods
NotificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

NotificationSchema.methods.updateDeliveryStatus = function(status, method = 'IN_APP') {
  this.delivery.status = status;
  this.delivery.method = method;
  this.delivery.attempts += 1;
  this.delivery.lastAttempt = new Date();
  
  if (status === 'DELIVERED') {
    this.delivery.deliveredAt = new Date();
  }
  
  return this.save();
};

NotificationSchema.methods.canSend = function() {
  // Check if notification has expired
  if (this.expiresAt && new Date() > this.expiresAt) {
    return false;
  }
  
  // Check delivery status
  if (this.delivery.status === 'DELIVERED') {
    return false;
  }
  
  // Check retry limits
  if (this.delivery.attempts >= 3 && this.delivery.status === 'FAILED') {
    return false;
  }
  
  return true;
};

// Static methods
NotificationSchema.statics.getUnreadCount = function(walletAddress) {
  return this.countDocuments({
    recipient: walletAddress,
    read: false
  });
};

NotificationSchema.statics.getUserNotifications = function(walletAddress, options = {}) {
  const {
    page = 1,
    limit = 20,
    category,
    type,
    unreadOnly = false
  } = options;
  
  const filter = { recipient: walletAddress };
  
  if (category) {
    filter.category = category;
  }
  
  if (type) {
    filter.type = type;
  }
  
  if (unreadOnly) {
    filter.read = false;
  }
  
  return this.find(filter)
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('governanceCase.caseId', 'title caseId status type urgency')
    .lean();
};

NotificationSchema.statics.createGovernanceNotification = function(data) {
  return this.create({
    type: data.type,
    recipient: data.recipient,
    content: data.content,
    category: 'GOVERNANCE',
    priority: data.priority || 'NORMAL',
    governanceCase: data.governanceCase,
    sender: data.sender,
    userPreferences: data.userPreferences,
    expiresAt: data.expiresAt
  });
};

module.exports = mongoose.model('Notification', NotificationSchema);
