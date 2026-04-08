const Notification = require('../models/Notification');
const NotificationPreferences = require('../models/NotificationPreferences');
const GovernanceCase = require('../models/GovernanceCase');
const User = require('../models/User');

/**
 * Enhanced Governance Notification Service
 * Handles all governance-related notifications with user preferences
 */

class GovernanceNotificationService {
  constructor() {
    this.NOTIFICATION_TYPES = {
      // Case lifecycle notifications
      CASE_CREATED: 'governance_case_created',
      CASE_RESOLVED: 'governance_case_resolved',
      CASE_EXECUTED: 'governance_case_executed',
      CASE_ESCALATED: 'governance_case_escalated',
      STATUS_UPDATE: 'governance_status_update',
      
      // Voting notifications
      VOTING_STARTED: 'governance_voting_started',
      VOTING_REMINDER: 'governance_voting_reminder',
      DEADLINE_APPROACHING: 'governance_deadline_approaching',
      
      // Appeal notifications
      APPEAL_FILED: 'governance_appeal_filed',
      EVIDENCE_ADDED: 'governance_evidence_added',
      
      // Community notifications
      PARTICIPATION_REWARD: 'governance_participation_reward',
      COMMUNITY_UPDATE: 'governance_community_update'
    };
    
    this.URGENCY_PRIORITY_MAP = {
      'LOW': 'LOW',
      'NORMAL': 'NORMAL',
      'HIGH': 'HIGH',
      'CRITICAL': 'URGENT'
    };
  }

  /**
   * Create a governance notification with user preferences checking
   */
  async createGovernanceNotification(data) {
    try {
      const {
        type,
        recipient,
        sender,
        content,
        governanceCase,
        priority,
        expiresAt
      } = data;

      // Get user preferences
      const preferences = await NotificationPreferences.getOrCreatePreferences(recipient);
      
      // Create notification object for preference checking
      const tempNotification = {
        type,
        category: 'GOVERNANCE',
        governanceCase
      };
      
      // Check if user wants to receive this notification
      if (!preferences.shouldReceiveNotification(tempNotification)) {
        console.log(`🔇 Notification filtered by user preferences: ${type} for ${recipient}`);
        return null;
      }
      
      // Create the notification
      const notification = await Notification.createGovernanceNotification({
        type,
        recipient: recipient.toLowerCase(),
        sender,
        content,
        priority: priority || this.URGENCY_PRIORITY_MAP[governanceCase?.urgency] || 'NORMAL',
        governanceCase,
        userPreferences: {
          canEmail: preferences.deliveryMethods.email.enabled,
          canPush: preferences.deliveryMethods.push.enabled,
          frequency: preferences.globalSettings.frequency
        },
        expiresAt
      });
      
      console.log(`📬 Governance notification created: ${type} for ${recipient}`);
      
      // Schedule delivery based on user preferences
      await this.scheduleDelivery(notification, preferences);
      
      return notification;
      
    } catch (error) {
      console.error('❌ Error creating governance notification:', error);
      return null;
    }
  }

  /**
   * Notify when a new governance case is created
   */
  async notifyCaseCreated(governanceCase) {
    try {
      // Get all active community members
      const activeMembers = await this.getActiveCommunityMembers();
      
      const notifications = await Promise.all(
        activeMembers.map(async (member) => {
          return await this.createGovernanceNotification({
            type: this.NOTIFICATION_TYPES.CASE_CREATED,
            recipient: member.walletAddress,
            sender: {
              address: governanceCase.reporterAddress,
              username: governanceCase.reporter?.username || `User_${governanceCase.reporterAddress.slice(0, 6)}`
            },
            content: {
              title: 'New Governance Case Created',
              message: `A new ${governanceCase.type.replace('_', ' ').toLowerCase()} case has been created: ${governanceCase.title}`,
              caseId: governanceCase._id,
              caseTitle: governanceCase.title,
              urgency: governanceCase.urgency,
              actionUrl: `/governance/case/${governanceCase._id}`
            },
            governanceCase: {
              caseId: governanceCase._id,
              caseType: governanceCase.type,
              urgency: governanceCase.urgency
            },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          });
        })
      );
      
      console.log(`📢 Notified ${notifications.filter(n => n).length} members about new case: ${governanceCase.caseId}`);
      return notifications.filter(n => n);
      
    } catch (error) {
      console.error('❌ Error notifying case creation:', error);
      return [];
    }
  }

  /**
   * Notify when voting starts on a case
   */
  async notifyVotingStarted(governanceCase) {
    try {
      const eligibleVoters = await this.getEligibleVoters(governanceCase);
      
      const notifications = await Promise.all(
        eligibleVoters.map(async (voter) => {
          return await this.createGovernanceNotification({
            type: this.NOTIFICATION_TYPES.VOTING_STARTED,
            recipient: voter.walletAddress,
            content: {
              title: 'Voting Started',
              message: `Voting has started for case: ${governanceCase.title}. Your voice matters!`,
              caseId: governanceCase._id,
              caseTitle: governanceCase.title,
              votingEndTime: governanceCase.votingEndTime,
              actionUrl: `/governance/case/${governanceCase._id}/vote`
            },
            governanceCase: {
              caseId: governanceCase._id,
              caseType: governanceCase.type,
              urgency: governanceCase.urgency
            },
            expiresAt: governanceCase.votingEndTime
          });
        })
      );
      
      console.log(`🗳️ Notified ${notifications.filter(n => n).length} voters about voting start: ${governanceCase.caseId}`);
      return notifications.filter(n => n);
      
    } catch (error) {
      console.error('❌ Error notifying voting start:', error);
      return [];
    }
  }

  /**
   * Send voting reminders to users who haven't voted
   */
  async sendVotingReminders() {
    try {
      // Find cases that are actively voting and close to deadline
      const activeVotingCases = await GovernanceCase.find({
        status: 'VOTING_ACTIVE',
        votingEndTime: {
          $gt: new Date(),
          $lt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next 24 hours
        }
      });
      
      for (const governanceCase of activeVotingCases) {
        const eligibleVoters = await this.getEligibleVoters(governanceCase);
        const votersWhoVoted = await this.getVotersForCase(governanceCase._id);
        
        // Find voters who haven't voted yet
        const nonVoters = eligibleVoters.filter(voter => 
          !votersWhoVoted.includes(voter.walletAddress)
        );
        
        const timeLeft = Math.round((governanceCase.votingEndTime - new Date()) / (1000 * 60 * 60));
        
        const notifications = await Promise.all(
          nonVoters.map(async (voter) => {
            return await this.createGovernanceNotification({
              type: this.NOTIFICATION_TYPES.VOTING_REMINDER,
              recipient: voter.walletAddress,
              content: {
                title: 'Voting Reminder',
                message: `Don't forget to vote on "${governanceCase.title}". Only ${timeLeft} hours left!`,
                caseId: governanceCase._id,
                caseTitle: governanceCase.title,
                hoursLeft: timeLeft,
                actionUrl: `/governance/case/${governanceCase._id}/vote`
              },
              governanceCase: {
                caseId: governanceCase._id,
                caseType: governanceCase.type,
                urgency: governanceCase.urgency
              },
              priority: timeLeft <= 6 ? 'HIGH' : 'NORMAL'
            });
          })
        );
        
        console.log(`⏰ Sent ${notifications.filter(n => n).length} voting reminders for case: ${governanceCase.caseId}`);
      }
      
    } catch (error) {
      console.error('❌ Error sending voting reminders:', error);
    }
  }

  /**
   * Notify when a case is resolved
   */
  async notifyCaseResolved(governanceCase, result) {
    try {
      // Notify case participants and interested community members
      const participants = await this.getCaseParticipants(governanceCase._id);
      
      const notifications = await Promise.all(
        participants.map(async (participant) => {
          const isReporter = participant.walletAddress === governanceCase.reporterAddress;
          const action = result.approved ? 'approved' : 'rejected';
          
          return await this.createGovernanceNotification({
            type: this.NOTIFICATION_TYPES.CASE_RESOLVED,
            recipient: participant.walletAddress,
            content: {
              title: `Case ${action.charAt(0).toUpperCase() + action.slice(1)}`,
              message: `The case "${governanceCase.title}" has been ${action}. ${
                isReporter ? 'Thank you for your report.' : 'Thank you for participating.'
              }`,
              caseId: governanceCase._id,
              caseTitle: governanceCase.title,
              result: action,
              isReporter,
              actionUrl: `/governance/case/${governanceCase._id}`
            },
            governanceCase: {
              caseId: governanceCase._id,
              caseType: governanceCase.type,
              urgency: governanceCase.urgency
            }
          });
        })
      );
      
      console.log(`⚖️ Notified ${notifications.filter(n => n).length} participants about case resolution: ${governanceCase.caseId}`);
      return notifications.filter(n => n);
      
    } catch (error) {
      console.error('❌ Error notifying case resolution:', error);
      return [];
    }
  }

  /**
   * Notify when a case is executed
   */
  async notifyCaseExecuted(governanceCase, executionResult) {
    try {
      const participants = await this.getCaseParticipants(governanceCase._id);
      
      const notifications = await Promise.all(
        participants.map(async (participant) => {
          return await this.createGovernanceNotification({
            type: this.NOTIFICATION_TYPES.CASE_EXECUTED,
            recipient: participant.walletAddress,
            content: {
              title: 'Case Executed',
              message: `The approved case "${governanceCase.title}" has been executed successfully.`,
              caseId: governanceCase._id,
              caseTitle: governanceCase.title,
              executionSummary: executionResult.summary,
              actionsCount: executionResult.actions?.length || 0,
              actionUrl: `/governance/case/${governanceCase._id}`
            },
            governanceCase: {
              caseId: governanceCase._id,
              caseType: governanceCase.type,
              urgency: governanceCase.urgency
            }
          });
        })
      );
      
      console.log(`⚡ Notified ${notifications.filter(n => n).length} participants about case execution: ${governanceCase.caseId}`);
      return notifications.filter(n => n);
      
    } catch (error) {
      console.error('❌ Error notifying case execution:', error);
      return [];
    }
  }

  /**
   * Notify when an appeal is filed
   */
  async notifyAppealFiled(appeal, originalCase) {
    try {
      // Notify governance moderators and case participants
      const moderators = await this.getGovernanceModerators();
      const participants = await this.getCaseParticipants(originalCase._id);
      const allRecipients = [...moderators, ...participants];
      
      const notifications = await Promise.all(
        allRecipients.map(async (recipient) => {
          const isModerator = moderators.some(m => m.walletAddress === recipient.walletAddress);
          
          return await this.createGovernanceNotification({
            type: this.NOTIFICATION_TYPES.APPEAL_FILED,
            recipient: recipient.walletAddress,
            sender: {
              address: appeal.appellantAddress,
              username: appeal.appellant?.username
            },
            content: {
              title: 'Appeal Filed',
              message: `An appeal has been filed for case "${originalCase.title}". ${
                isModerator ? 'Your review is needed.' : 'The case is under appeal review.'
              }`,
              caseId: originalCase._id,
              appealId: appeal._id,
              caseTitle: originalCase.title,
              appealReason: appeal.reason,
              isModerator,
              actionUrl: isModerator ? `/governance/appeals/${appeal._id}/review` : `/governance/case/${originalCase._id}`
            },
            governanceCase: {
              caseId: originalCase._id,
              caseType: originalCase.type,
              urgency: 'HIGH'
            },
            priority: 'HIGH'
          });
        })
      );
      
      console.log(`📝 Notified ${notifications.filter(n => n).length} recipients about appeal: ${originalCase.caseId}`);
      return notifications.filter(n => n);
      
    } catch (error) {
      console.error('❌ Error notifying appeal filed:', error);
      return [];
    }
  }

  /**
   * Helper methods for getting user groups
   */
  async getActiveCommunityMembers() {
    try {
      // Get users who have been active in governance in the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const activeUsers = await User.find({
        $or: [
          { lastLoginAt: { $gte: thirtyDaysAgo } },
          { 'governance.participationCount': { $gt: 0 } },
          { 'governance.lastVoted': { $gte: thirtyDaysAgo } }
        ]
      }).select('walletAddress username');
      
      return activeUsers;
    } catch (error) {
      console.error('❌ Error getting active members:', error);
      return [];
    }
  }

  async getEligibleVoters(governanceCase) {
    try {
      // Users with sufficient voting power and account age
      const minAccountAge = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const eligibleUsers = await User.find({
        createdAt: { $lte: minAccountAge },
        'voting.power': { $gt: 0 },
        'account.status': { $ne: 'BANNED' }
      }).select('walletAddress username voting.power');
      
      return eligibleUsers;
    } catch (error) {
      console.error('❌ Error getting eligible voters:', error);
      return [];
    }
  }

  async getCaseParticipants(caseId) {
    try {
      // Get users who participated in this case (voted, commented, etc.)
      const participants = await User.find({
        $or: [
          { 'governance.participatedCases': caseId },
          { 'governance.votedCases': caseId }
        ]
      }).select('walletAddress username');
      
      return participants;
    } catch (error) {
      console.error('❌ Error getting case participants:', error);
      return [];
    }
  }

  async getGovernanceModerators() {
    try {
      const moderators = await User.find({
        'governance.isModerator': true,
        'account.status': 'ACTIVE'
      }).select('walletAddress username');
      
      return moderators;
    } catch (error) {
      console.error('❌ Error getting moderators:', error);
      return [];
    }
  }

  async getVotersForCase(caseId) {
    try {
      // This would need to be implemented based on your voting system
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('❌ Error getting voters for case:', error);
      return [];
    }
  }

  /**
   * Schedule delivery based on user preferences
   */
  async scheduleDelivery(notification, preferences) {
    try {
      const enabledMethods = preferences.getEnabledDeliveryMethods();
      
      for (const method of enabledMethods) {
        // For now, just mark as sent for in-app notifications
        if (method === 'IN_APP') {
          await notification.updateDeliveryStatus('DELIVERED', method);
        }
        // TODO: Implement email, push, and webhook delivery
      }
      
    } catch (error) {
      console.error('❌ Error scheduling delivery:', error);
    }
  }

  /**
   * Get user notifications with filtering
   */
  async getUserNotifications(walletAddress, options = {}) {
    try {
      return await Notification.getUserNotifications(walletAddress, options);
    } catch (error) {
      console.error('❌ Error getting user notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, walletAddress) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: walletAddress.toLowerCase()
      });
      
      if (notification) {
        await notification.markAsRead();
        return { success: true };
      }
      
      return { success: false, message: 'Notification not found' };
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      return { success: false, message: 'Error updating notification' };
    }
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(walletAddress) {
    try {
      return await Notification.getUnreadCount(walletAddress);
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Notify when a case is invalidated due to content deletion
   */
  async notifyCaseInvalidated(governanceCase, reason = 'Content deleted') {
    try {
      // Notify case participants that the case has been invalidated
      const participants = await this.getCaseParticipants(governanceCase._id);
      
      const notifications = await Promise.all(
        participants.map(async (participant) => {
          const isReporter = participant.walletAddress === governanceCase.reporterAddress;
          
          return await this.createGovernanceNotification({
            type: this.NOTIFICATION_TYPES.CASE_RESOLVED,
            recipient: participant.walletAddress,
            content: {
              title: 'Case Invalidated',
              message: `The case "${governanceCase.title}" has been invalidated because ${reason.toLowerCase()}. ${
                isReporter ? 'Your votes and participation have been noted.' : 'Thank you for your participation.'
              }`,
              caseId: governanceCase._id,
              caseTitle: governanceCase.title,
              result: 'invalidated',
              reason: reason,
              isReporter,
              actionUrl: `/governance/case/${governanceCase._id}`
            },
            governanceCase: {
              caseId: governanceCase._id,
              caseType: governanceCase.type,
              urgency: governanceCase.urgency || 'NORMAL'
            }
          });
        })
      );
      
      console.log(`⚖️ Notified ${notifications.filter(n => n).length} participants about case invalidation: ${governanceCase.caseId}`);
      return notifications.filter(n => n);
      
    } catch (error) {
      console.error('❌ Error notifying case invalidation:', error);
      return [];
    }
  }
}

module.exports = new GovernanceNotificationService();