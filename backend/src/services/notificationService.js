const Notification = require('../models/Notification');
const GovernanceCase = require('../models/GovernanceCase');
const CommunityVote = require('../models/CommunityVote');
const Follow = require('../models/Follow');
const logger = require('../utils/logger');
const socketService = require('./socketService');

/**
 * Enhanced Notification Service with Governance Support
 * Handles all platform notifications including governance events
 */

class NotificationService {
  constructor() {
    this.NOTIFICATION_TYPES = {
      // Social notifications
      LIKE: 'like',
      COMMENT: 'comment',
      FOLLOW: 'follow',
      MENTION: 'mention',

      // Governance notifications (case-based)
      GOVERNANCE_CASE_CREATED: 'governance_case_created',
      GOVERNANCE_VOTE_CAST: 'governance_vote_cast',
      GOVERNANCE_CASE_RESOLVED: 'governance_case_resolved',
      GOVERNANCE_DEADLINE_APPROACHING: 'governance_deadline_approaching',

      // Moderation & Appeals
      CONTENT_FLAGGED: 'content_flagged',
      APPEAL_RECEIVED: 'appeal_received',
      APPEAL_RESOLVED: 'appeal_resolved',
      MODERATION_DECISION: 'moderation_decision',

      // Moderation Actions (Escalation Ladder)
      MODERATION_WARNING: 'moderation_warning',
      MODERATION_TEMP_BAN: 'moderation_temp_ban',
      MODERATION_PERMANENT_BAN: 'moderation_permanent_ban',

      // System notifications
      SYSTEM_UPDATE: 'system_update',
      MAINTENANCE: 'maintenance'
    };
  }

  /**
   * Create a notification
   */
  async createNotification({ type, recipient, sender = {}, content = {}, metadata = {} }) {
    try {
      if (!recipient) return null;

      // Avoid notifying self
      if (sender && sender.address && sender.address.toLowerCase() === recipient.toLowerCase()) {
        return null;
      }

      // Critical notifications (moderation actions) are ALWAYS sent regardless of preferences
      const criticalNotificationTypes = [
        'moderation_warning',
        'moderation_temp_ban',
        'moderation_permanent_ban',
        'governance_case_created'
      ];

      if (!criticalNotificationTypes.includes(type)) {
        // Only check preferences for non-critical notifications
        const shouldNotify = await this.checkNotificationPreferences(recipient, type);
        if (!shouldNotify) return null;
      }

      const notification = new Notification({
        type,
        recipient: recipient.toLowerCase(),
        sender: {
          address: sender.address || '',
          username: sender.username || '',
          avatar: sender.avatar || ''
        },
        content: {
          ...content,
          title: content.title || this.getDefaultTitle(type),
          message: content.message || this.getDefaultMessage(type, content)
        },
        metadata,
        read: false,
        timestamp: new Date()
      });

      await notification.save();

      // Push notification in real-time via WebSocket
      socketService.notifyUser(recipient, 'notification:new', {
        id: notification._id,
        type,
        content: notification.content,
        sender: notification.sender,
        createdAt: notification.timestamp
      });

      logger.info(`Notification created: ${type} for ${recipient}`);
      return notification;

    } catch (error) {
      logger.error('Error creating notification:', error);
      return null;
    }
  }

  /**
   * Governance case notification methods
   */
  async notifyCaseCreated(governanceCase) {
    try {
      const activeVoters = await this.getActiveGovernanceParticipants();

      await Promise.all(
        activeVoters.map(async (voter) => {
          await this.createNotification({
            type: this.NOTIFICATION_TYPES.GOVERNANCE_CASE_CREATED,
            recipient: voter.address,
            sender: {
              address: governanceCase.reporterAddress
            },
            content: {
              title: 'New Governance Case',
              message: `"${governanceCase.title}" is now open for community review`,
              caseId: governanceCase.caseId,
              caseTitle: governanceCase.title,
              caseType: governanceCase.type
            },
            metadata: {
              caseId: governanceCase.caseId
            }
          });
        })
      );

      logger.info(`Governance case creation notifications sent: ${activeVoters.length} recipients`);

    } catch (error) {
      logger.error('Error sending case creation notifications:', error);
    }
  }

  async notifyCaseVoteCast(vote, governanceCase) {
    try {
      await this.createNotification({
        type: this.NOTIFICATION_TYPES.GOVERNANCE_VOTE_CAST,
        recipient: governanceCase.reporterAddress,
        sender: {
          address: vote.voterAddress
        },
        content: {
          title: 'Vote Cast on Your Case',
          message: `Someone voted on "${governanceCase.title}"`,
          caseId: governanceCase.caseId,
          voteChoice: vote.decision
        },
        metadata: {
          caseId: governanceCase.caseId,
          voteWeight: vote.weight || 1
        }
      });

    } catch (error) {
      logger.error('Error sending vote cast notification:', error);
    }
  }

  async notifyCaseResolved(governanceCase, resolution) {
    try {
      const voters = await CommunityVote.find({ caseId: governanceCase.caseId }).distinct('voterAddress');
      const recipients = [...new Set([governanceCase.reporterAddress, ...voters])];

      await Promise.all(
        recipients.map(async (recipient) => {
          await this.createNotification({
            type: this.NOTIFICATION_TYPES.GOVERNANCE_CASE_RESOLVED,
            recipient,
            content: {
              title: 'Governance Case Resolved',
              message: `"${governanceCase.title}" has been resolved: ${resolution.outcome || governanceCase.status}`,
              caseId: governanceCase.caseId,
              outcome: resolution.outcome || governanceCase.status
            },
            metadata: {
              caseId: governanceCase.caseId
            }
          });
        })
      );

      logger.info(`Case resolution notifications sent: ${recipients.length} recipients`);

    } catch (error) {
      logger.error('Error sending case resolution notifications:', error);
    }
  }

  async notifyDeadlineApproaching(governanceCase) {
    try {
      const existingVotes = await CommunityVote.find({ caseId: governanceCase.caseId }).distinct('voterAddress');
      const activeVoters = await this.getActiveGovernanceParticipants();
      const pendingVoters = activeVoters.filter(
        voter => !existingVotes.includes(voter.address)
      );

      const votingDeadline = governanceCase.votingDeadline || governanceCase.deadline;
      const timeLeft = new Date(votingDeadline) - new Date();
      const hoursLeft = Math.round(timeLeft / (1000 * 60 * 60));

      await Promise.all(
        pendingVoters.map(async (voter) => {
          await this.createNotification({
            type: this.NOTIFICATION_TYPES.GOVERNANCE_DEADLINE_APPROACHING,
            recipient: voter.address,
            content: {
              title: 'Voting Deadline Approaching',
              message: `"${governanceCase.title}" voting ends in ${hoursLeft} hours`,
              caseId: governanceCase.caseId,
              caseTitle: governanceCase.title,
              timeLeft: `${hoursLeft} hours`,
              votingDeadline
            },
            metadata: {
              caseId: governanceCase.caseId,
              urgency: hoursLeft <= 6 ? 'high' : 'medium'
            }
          });
        })
      );

      logger.info(`Deadline approaching notifications sent: ${pendingVoters.length} recipients`);

    } catch (error) {
      logger.error('Error sending deadline notifications:', error);
    }
  }

  /**
   * Moderation and appeals notifications
   */
  async notifyContentFlagged(contentId, contentType, authorAddress, moderationResult) {
    try {
      await this.createNotification({
        type: this.NOTIFICATION_TYPES.CONTENT_FLAGGED,
        recipient: authorAddress,
        content: {
          title: 'Content Under Review',
          message: `Your ${contentType.toLowerCase()} has been flagged for review`,
          contentId,
          contentType,
          reason: moderationResult.reason,
          canAppeal: true,
          appealDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        metadata: {
          moderationId: moderationResult.moderationId,
          confidence: moderationResult.confidence,
          automaticFlag: moderationResult.automatic
        }
      });

    } catch (error) {
      logger.error('Error sending content flagged notification:', error);
    }
  }

  async notifyAppealResolved(appealId, appealerAddress, resolution) {
    try {
      await this.createNotification({
        type: this.NOTIFICATION_TYPES.APPEAL_RESOLVED,
        recipient: appealerAddress,
        content: {
          title: 'Appeal Resolved',
          message: `Your appeal has been ${resolution.decision}`,
          appealId,
          decision: resolution.decision,
          reasoning: resolution.reasoning,
          actionTaken: resolution.actionTaken
        },
        metadata: {
          appealId,
          resolvedBy: resolution.decisionBy,
          resolutionTime: resolution.processingTime
        }
      });

    } catch (error) {
      logger.error('Error sending appeal resolved notification:', error);
    }
  }

  /**
   * Escalation Ladder Notifications
   */
  async notifyModerationWarning(userAddress, violationData) {
    try {
      const { contentId, contentType, violationType, violatingContent, severity } = violationData;

      await this.createNotification({
        type: this.NOTIFICATION_TYPES.MODERATION_WARNING,
        recipient: userAddress,
        content: {
          title: 'First Warning - Community Guidelines Violation',
          message: 'Your recent content violated our community guidelines. This is your first warning.',
          contentId,
          contentType,
          violationType,
          severity,
          violatingContentSnippet: violatingContent.substring(0, 100) + '...',
          nextSteps: [
            'This is a formal warning - no restrictions applied',
            'Please review our community guidelines carefully',
            'Future violations may result in temporary or permanent restrictions',
            'You can continue posting and participating normally'
          ],
          appeal: {
            canAppeal: true,
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            instructions: 'If you believe this warning was issued in error, you may appeal within 7 days.',
            appealUrl: '/appeals/submit'
          },
          guidelines: {
            url: '/community-guidelines',
            message: 'Review our community guidelines to avoid future violations'
          }
        },
        metadata: {
          escalationLevel: 1,
          warningType: 'first_strike',
          canContinuePosting: true
        }
      });

    } catch (error) {
      logger.error('Error sending moderation warning notification:', error);
    }
  }

  async notifyModerationTempBan(userAddress, violationData, banDetails) {
    try {
      const { contentId, contentType, violationType, violatingContent, severity } = violationData;
      const { banHours, restrictedUntil } = banDetails;

      await this.createNotification({
        type: this.NOTIFICATION_TYPES.MODERATION_TEMP_BAN,
        recipient: userAddress,
        content: {
          title: 'Second Warning - Temporary Ban Applied',
          message: `Your account has been temporarily restricted for ${banHours} hours due to a second community guideline violation.`,
          contentId,
          contentType,
          violationType,
          severity,
          violatingContentSnippet: violatingContent.substring(0, 100) + '...',
          banDuration: {
            hours: banHours,
            restrictedUntil: restrictedUntil,
            friendlyDuration: banHours < 48 ? `${banHours} hours` : `${Math.floor(banHours/24)} days`
          },
          restrictions: [
            'You cannot create new posts during this period',
            'You cannot comment on posts during this period',
            'You can still view content and browse the platform',
            'This restriction will be automatically lifted after the ban period'
          ],
          nextSteps: [
            'This is your second violation - one more will result in permanent ban',
            'Please take this time to review our community guidelines',
            'Consider the impact of your content on other community members',
            'Future violations will result in permanent account suspension'
          ],
          appeal: {
            canAppeal: true,
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            instructions: 'You can appeal this temporary ban if you believe it was issued in error.',
            appealUrl: '/appeals/submit'
          }
        },
        metadata: {
          escalationLevel: 2,
          banType: 'temporary',
          banDurationHours: banHours,
          automaticLift: true
        }
      });

    } catch (error) {
      logger.error('Error sending temporary ban notification:', error);
    }
  }

  async notifyModerationPermanentBan(userAddress, violationData) {
    try {
      const { contentId, contentType, violationType, violatingContent, severity } = violationData;

      await this.createNotification({
        type: this.NOTIFICATION_TYPES.MODERATION_PERMANENT_BAN,
        recipient: userAddress,
        content: {
          title: 'Third Strike - Permanent Account Suspension',
          message: 'Your account has been permanently suspended due to repeated community guideline violations.',
          contentId,
          contentType,
          violationType,
          severity,
          violatingContentSnippet: violatingContent.substring(0, 100) + '...',
          finalWarning: true,
          restrictions: [
            'Your account is permanently restricted from all platform activities',
            'You cannot create posts, comments, or interact with content',
            'This restriction affects your ability to participate in governance',
            'Creating new accounts is not permitted and may result in IP restrictions'
          ],
          escalationHistory: [
            '1st violation: Warning issued',
            '2nd violation: Temporary ban applied',
            '3rd violation: Permanent ban applied'
          ],
          appeal: {
            canAppeal: true,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            instructions: 'This is a permanent restriction. You may submit a final appeal within 30 days explaining why this decision should be reversed.',
            appealUrl: '/appeals/submit',
            lastChance: true
          }
        },
        metadata: {
          escalationLevel: 3,
          banType: 'permanent',
          finalAction: true
        }
      });

    } catch (error) {
      logger.error('Error sending permanent ban notification:', error);
    }
  }

  /**
   * Batch notification scheduler for governance case deadlines
   */
  async scheduleGovernanceReminders() {
    try {
      const now = new Date();
      const upcomingDeadlines = await GovernanceCase.find({
        status: 'VOTING_ACTIVE',
        votingDeadline: {
          $gte: now,
          $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000)
        }
      });

      for (const governanceCase of upcomingDeadlines) {
        const timeLeft = new Date(governanceCase.votingDeadline) - now;
        const hoursLeft = timeLeft / (1000 * 60 * 60);

        if ((hoursLeft <= 24 && hoursLeft > 23) ||
            (hoursLeft <= 6 && hoursLeft > 5) ||
            (hoursLeft <= 1 && hoursLeft > 0)) {
          await this.notifyDeadlineApproaching(governanceCase);
        }
      }

      logger.info(`Governance reminders processed: ${upcomingDeadlines.length} cases`);

    } catch (error) {
      logger.error('Error scheduling governance reminders:', error);
    }
  }

  /**
   * Helper methods
   */
  async getActiveGovernanceParticipants(limit = 1000) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const activeVoters = await CommunityVote.distinct('voterAddress', {
        createdAt: { $gte: thirtyDaysAgo }
      });

      return activeVoters.slice(0, limit).map(address => ({ address }));

    } catch (error) {
      logger.error('Error getting active governance participants:', error);
      return [];
    }
  }

  async checkNotificationPreferences(recipient, type) {
    try {
      // Get user preferences, default to all enabled if not set
      const NotificationPreferences = require('../models/NotificationPreferences');
      const prefs = await NotificationPreferences.findOne({ user: recipient.toLowerCase() });

      if (!prefs) {
        // Default: all notifications enabled
        return true;
      }

      // Check if this type is disabled
      const typeKey = type.replace(/[:-]/g, '_').toLowerCase();

      // Check if notifications are globally disabled
      if (prefs.disabled === true) return false;

      // Check if this specific type is disabled
      if (prefs[typeKey] === false) return false;

      return true;
    } catch (error) {
      logger.warn('Error checking notification preferences, allowing notification:', error);
      return true; // Allow notification if there's an error
    }
  }

  calculateUrgency(governanceCase) {
    const deadline = governanceCase.votingDeadline || governanceCase.deadline;
    if (!deadline) return 'low';
    const timeLeft = new Date(deadline) - new Date();
    const daysLeft = timeLeft / (1000 * 60 * 60 * 24);

    if (daysLeft <= 1) return 'high';
    if (daysLeft <= 3) return 'medium';
    return 'low';
  }

  getDefaultTitle(type) {
    const titles = {
      [this.NOTIFICATION_TYPES.GOVERNANCE_CASE_CREATED]: 'New Governance Case',
      [this.NOTIFICATION_TYPES.GOVERNANCE_VOTE_CAST]: 'Vote Cast',
      [this.NOTIFICATION_TYPES.GOVERNANCE_CASE_RESOLVED]: 'Case Resolved',
      [this.NOTIFICATION_TYPES.GOVERNANCE_DEADLINE_APPROACHING]: 'Voting Deadline',
      [this.NOTIFICATION_TYPES.CONTENT_FLAGGED]: 'Content Review',
      [this.NOTIFICATION_TYPES.APPEAL_RESOLVED]: 'Appeal Update'
    };

    return titles[type] || 'Notification';
  }

  getDefaultMessage(type, content) {
    return 'You have a new notification';
  }

  async createNotificationLegacy({ type, recipient, sender = {}, content = {} }) {
    return await this.createNotification({ type, recipient, sender, content });
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Legacy function exports for backward compatibility
async function createNotification(params) {
  return await notificationService.createNotificationLegacy(params);
}

async function fetchNotifications(recipient, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;
  const query = { recipient: recipient.toLowerCase() };

  const total = await Notification.countDocuments(query);
  const items = await Notification.find(query)
    .sort({ read: 1, timestamp: -1 })
    .skip(skip)
    .limit(limit);

  return {
    success: true,
    notifications: items,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      total
    }
  };
}

async function unreadCount(recipient) {
  const query = { recipient: recipient.toLowerCase(), read: false };
  const count = await Notification.countDocuments(query);
  return { success: true, count };
}

async function markRead(notificationId) {
  try {
    const n = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true, readAt: new Date() },
      { new: true }
    );
    return { success: true, notification: n };
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
}

async function markAllRead(recipient) {
  try {
    const res = await Notification.updateMany(
      { recipient: recipient.toLowerCase(), read: false },
      { read: true, readAt: new Date() }
    );
    return { success: true, modifiedCount: res.modifiedCount };
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    return { success: false, error: error.message };
  }
}

async function sendNotification(recipient, notification) {
  return await notificationService.createNotification({
    type: notification.type,
    recipient,
    content: notification
  });
}

// Export both the service instance and legacy functions
module.exports = {
  notificationService,

  notifyModerationWarning: notificationService.notifyModerationWarning.bind(notificationService),
  notifyModerationTempBan: notificationService.notifyModerationTempBan.bind(notificationService),
  notifyModerationPermanentBan: notificationService.notifyModerationPermanentBan.bind(notificationService),

  createNotification,
  fetchNotifications,
  unreadCount,
  markRead,
  markAllRead,
  sendNotification
};
