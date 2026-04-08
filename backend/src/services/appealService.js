/**
 * Content Appeals Service
 * Handles the complete appeals workflow for AI moderation decisions
 */

const Appeal = require('../models/Appeal');
const AIModeration = require('../models/AIModeration');
const ModerationFlag = require('../models/ModerationFlag');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const GovernanceCase = require('../models/GovernanceCase');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

class AppealService {
  constructor() {
    this.ESCALATION_THRESHOLD = {
      HIGH_CONFIDENCE_DECISIONS: 0.9, // Don't escalate if AI was very confident
      REPEAT_APPEALS: 3, // Escalate if user appeals frequently
      COMMUNITY_INTEREST: 5, // Escalate if many users are interested
      CONTROVERSIAL_CONTENT: 0.6 // Escalate if decision was close
    };
  }

  /**
   * Submit a new appeal for moderated content
   */
  async submitAppeal(contentId, contentType, appealerAddress, appealData) {
    try {
      logger.info(`📝 Submitting appeal for ${contentType} ${contentId}`);

      // Validate content exists and was moderated
      const { content, moderation } = await this.validateAppealableContent(
        contentId, 
        contentType
      );

      if (!content || !moderation) {
        throw new Error('Content not found or not subject to moderation');
      }

      // Check if appeal already exists
      const existingAppeal = await Appeal.findOne({
        contentId,
        contentType,
        appealerAddress,
        status: { $in: ['pending', 'under_review', 'community_vote'] }
      });

      if (existingAppeal) {
        throw new Error('Appeal already pending for this content');
      }

      // Create new appeal
      const appeal = new Appeal({
        contentId,
        contentType,
        originalModerationId: moderation._id,
        moderationFlagId: moderation.flagId,
        appealerAddress,
        appealReason: appealData.reason,
        appealDescription: appealData.description,
        evidence: appealData.evidence || []
      });

      await appeal.save();

      // Determine initial review path
      const shouldEscalate = await this.shouldEscalateImmediately(appeal, moderation);
      
      if (shouldEscalate) {
        await this.escalateToGovernance(appeal._id);
      } else {
        appeal.status = 'under_review';
        await appeal.save();
      }

      // Send notifications
      await this.sendAppealNotifications(appeal, 'appeal_received');

      logger.info(`✅ Appeal submitted: ${appeal.appealId}`);
      
      return {
        success: true,
        appealId: appeal.appealId,
        status: appeal.status,
        estimatedResolutionTime: this.estimateResolutionTime(appeal)
      };

    } catch (error) {
      logger.error('❌ Appeal submission error:', error);
      throw error;
    }
  }

  /**
   * Process appeal review by moderators
   */
  async reviewAppeal(appealId, moderatorAddress, reviewData) {
    try {
      const appeal = await Appeal.findOne({ appealId });
      
      if (!appeal || appeal.status !== 'under_review') {
        throw new Error('Appeal not found or not in reviewable state');
      }

      // Update review information
      appeal.reviewedBy = {
        moderatorAddress,
        reviewDate: new Date(),
        reviewNotes: reviewData.notes,
        recommendation: reviewData.recommendation
      };

      // Handle different recommendations
      switch (reviewData.recommendation) {
        case 'approve':
          await this.approveAppeal(appeal);
          break;
          
        case 'reject':
          await this.rejectAppeal(appeal, reviewData.reasoning);
          break;
          
        case 'escalate_to_community':
          await this.escalateToGovernance(appeal._id);
          break;
      }

      logger.info(`✅ Appeal reviewed: ${appealId} - ${reviewData.recommendation}`);
      return appeal;

    } catch (error) {
      logger.error('❌ Appeal review error:', error);
      throw error;
    }
  }

  /**
   * Escalate appeal to community governance
   */
  async escalateToGovernance(appealId) {
    try {
      // appealId here is actually an ObjectId (_id) passed from submitAppeal/reviewAppeal,
      // so we query by _id rather than the string appealId field.
      const appeal = await Appeal.findById(appealId)
        .populate('originalModerationId')
        .populate('contentId');

      if (!appeal) {
        throw new Error('Appeal not found');
      }

      // Create governance case for the appeal
      const governanceCase = new GovernanceCase({
        title: `Content Report: ${appeal.appealReason.replace(/_/g, ' ')}`,
        description: this.generateAppealProposalDescription(appeal),
        type: 'CONTENT_REPORT',
        reporterAddress: appeal.appealerAddress,

        // Case details
        details: {
          appealId: appeal.appealId,
          contentId: appeal.contentId,
          contentType: appeal.contentType,
          originalModeration: appeal.originalModerationId,
          appealReason: appeal.appealReason,
          evidence: appeal.evidence
        },

        status: 'VOTING_ACTIVE',
        votingDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      await governanceCase.save();

      // Update appeal status
      appeal.governanceProposalId = governanceCase._id;
      await appeal.escalateToGovernance();

      // Notify community
      await this.sendAppealNotifications(appeal, 'community_vote_started');

      logger.info(`Appeal escalated to governance: ${appealId} -> Case ${governanceCase.caseId}`);

      return {
        success: true,
        caseId: governanceCase.caseId,
        votingDeadline: governanceCase.votingDeadline
      };

    } catch (error) {
      logger.error('❌ Appeal escalation error:', error);
      throw error;
    }
  }

  /**
   * Handle governance decision on appeal
   */
  async handleGovernanceDecision(appealId, decision, votingResults) {
    try {
      const appeal = await Appeal.findOne({ appealId });
      
      if (!appeal || appeal.status !== 'community_vote') {
        throw new Error('Appeal not in community vote state');
      }

      const isApproved = decision === 'approved';
      
      if (isApproved) {
        await this.approveAppeal(appeal, 'community');
      } else {
        await this.rejectAppeal(appeal, 'Community voted to uphold original moderation decision', 'community');
      }

      // Update governance tracking
      appeal.resolution.votingResults = votingResults;
      await appeal.save();

      logger.info(`🗳️ Governance decision processed: ${appealId} - ${decision}`);
      return appeal;

    } catch (error) {
      logger.error('❌ Governance decision error:', error);
      throw error;
    }
  }

  /**
   * Approve an appeal (overturn moderation decision)
   */
  async approveAppeal(appeal, decisionBy = 'moderator') {
    try {
      // Restore content
      const restorationResult = await this.restoreContent(appeal.contentId, appeal.contentType);
      
      // Remove moderation flags
      await this.removeModerationFlags(appeal.originalModerationId);
      
      // Update moderation system based on appeal
      await this.updateModerationSystem(appeal, 'appeal_approved');
      
      // Resolve appeal
      await appeal.resolve(
        'overturned',
        decisionBy,
        'Appeal approved - content restored',
        {
          contentRestored: restorationResult.restored,
          flagRemoved: true,
          userNotified: true,
          moderationSystemAdjusted: true
        }
      );

      // Send resolution notifications
      await this.sendAppealNotifications(appeal, 'resolution');

      logger.info(`✅ Appeal approved: ${appeal.appealId}`);
      return appeal;

    } catch (error) {
      logger.error('❌ Appeal approval error:', error);
      throw error;
    }
  }

  /**
   * Reject an appeal (uphold moderation decision)
   */
  async rejectAppeal(appeal, reasoning, decisionBy = 'moderator') {
    try {
      // Update moderation confidence based on upheld decision
      await this.updateModerationSystem(appeal, 'appeal_rejected');
      
      // Resolve appeal
      await appeal.resolve(
        'upheld',
        decisionBy,
        reasoning,
        {
          contentRestored: false,
          flagRemoved: false,
          userNotified: true,
          moderationSystemAdjusted: true
        }
      );

      // Send resolution notifications
      await this.sendAppealNotifications(appeal, 'resolution');

      logger.info(`❌ Appeal rejected: ${appeal.appealId}`);
      return appeal;

    } catch (error) {
      logger.error('❌ Appeal rejection error:', error);
      throw error;
    }
  }

  /**
   * Get appeals for a specific user
   */
  async getUserAppeals(userAddress, status = null) {
    try {
      const query = { appealerAddress: userAddress };
      if (status) {
        query.status = status;
      }

      const appeals = await Appeal.find(query)
        .sort({ submittedAt: -1 })
        .populate('originalModerationId')
        .populate('governanceProposalId')
        .populate('contentId');

      return appeals;

    } catch (error) {
      logger.error('❌ Error getting user appeals:', error);
      throw error;
    }
  }

  /**
   * Get pending appeals for moderator review
   */
  async getPendingAppeals(limit = 20) {
    try {
      const appeals = await Appeal.find({
        status: { $in: ['pending', 'under_review'] }
      })
      .sort({ submittedAt: 1 })
      .limit(limit)
      .populate('originalModerationId')
      .populate('contentId');

      return appeals;

    } catch (error) {
      logger.error('❌ Error getting pending appeals:', error);
      throw error;
    }
  }

  /**
   * Get appeal statistics for analytics
   */
  async getAppealStatistics(timeframe = '30d') {
    try {
      const timeframeDays = parseInt(timeframe);
      const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

      const stats = await Appeal.aggregate([
        { $match: { submittedAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            totalAppeals: { $sum: 1 },
            approved: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            rejected: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $in: ['$status', ['pending', 'under_review', 'community_vote']] }, 1, 0] }
            },
            avgProcessingTime: { $avg: '$processingTime' },
            communityEscalations: {
              $sum: { $cond: [{ $eq: ['$status', 'community_vote'] }, 1, 0] }
            }
          }
        }
      ]);

      const appealsByReason = await Appeal.aggregate([
        { $match: { submittedAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$appealReason',
            count: { $sum: 1 },
            approvalRate: {
              $avg: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            }
          }
        },
        { $sort: { count: -1 } }
      ]);

      return {
        summary: stats[0] || {
          totalAppeals: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          avgProcessingTime: 0,
          communityEscalations: 0
        },
        byReason: appealsByReason,
        timeframe: `${timeframeDays} days`
      };

    } catch (error) {
      logger.error('❌ Error getting appeal statistics:', error);
      throw error;
    }
  }

  /**
   * Helper Methods
   */

  async validateAppealableContent(contentId, contentType) {
    try {
      let content;
      
      if (contentType === 'Post') {
        content = await Post.findById(contentId);
      } else if (contentType === 'Comment') {
        content = await Comment.findById(contentId);
      }

      const moderation = await AIModeration.findOne({ 
        postId: contentId,
        'analysis.flagged': true 
      });

      return { content, moderation };

    } catch (error) {
      logger.error('❌ Error validating appealable content:', error);
      return { content: null, moderation: null };
    }
  }

  async shouldEscalateImmediately(appeal, moderation) {
    // High-confidence AI decisions don't need immediate escalation
    if (moderation.analysis.confidence > this.ESCALATION_THRESHOLD.HIGH_CONFIDENCE_DECISIONS) {
      return false;
    }

    // Check if user has many previous appeals
    const userAppeals = await Appeal.countDocuments({
      appealerAddress: appeal.appealerAddress,
      status: { $in: ['approved', 'rejected'] }
    });

    if (userAppeals >= this.ESCALATION_THRESHOLD.REPEAT_APPEALS) {
      return true;
    }

    // Check if decision was borderline (low confidence)
    if (moderation.analysis.confidence < this.ESCALATION_THRESHOLD.CONTROVERSIAL_CONTENT) {
      return true;
    }

    return false;
  }

  async restoreContent(contentId, contentType) {
    try {
      let restored = false;
      
      if (contentType === 'Post') {
        const post = await Post.findByIdAndUpdate(
          contentId,
          { 
            status: 'active',
            flagged: false,
            moderationScore: 0
          },
          { new: true }
        );
        restored = !!post;
      } else if (contentType === 'Comment') {
        const comment = await Comment.findByIdAndUpdate(
          contentId,
          { 
            status: 'active',
            flagged: false 
          },
          { new: true }
        );
        restored = !!comment;
      }

      return { restored };

    } catch (error) {
      logger.error('❌ Error restoring content:', error);
      return { restored: false };
    }
  }

  async removeModerationFlags(moderationId) {
    try {
      await ModerationFlag.updateOne(
        { _id: moderationId },
        { 
          status: 'resolved',
          resolution: 'appeal_approved',
          resolvedAt: new Date()
        }
      );

      return true;

    } catch (error) {
      logger.error('❌ Error removing moderation flags:', error);
      return false;
    }
  }

  async updateModerationSystem(appeal, outcome) {
    // This would update the AI moderation system based on appeal outcomes
    // For now, we'll log the learning opportunity
    
    logger.info(`🧠 Moderation learning: ${appeal.appealReason} -> ${outcome}`);
    
    // In a production system, this would:
    // 1. Update AI model weights
    // 2. Adjust confidence thresholds
    // 3. Update rule-based filters
    // 4. Improve training data
    
    return true;
  }

  generateAppealProposalDescription(appeal) {
    return `
# Content Moderation Appeal

**Appeal ID:** ${appeal.appealId}
**Content Type:** ${appeal.contentType}
**Reason:** ${appeal.appealReason.replace(/_/g, ' ')}

## Appeal Description
${appeal.appealDescription}

## Original Moderation Decision
The content was flagged by our AI moderation system and is currently hidden from public view.

## Evidence Provided
${appeal.evidence.map(e => `- ${e.type}: ${e.content}`).join('\n') || 'None provided'}

## Community Decision Needed
Should this content be restored? Vote **FOR** to overturn the moderation decision and restore the content, or **AGAINST** to uphold the original decision.

---
*This proposal was automatically generated from a user appeal of AI moderation.*
    `.trim();
  }

  async sendAppealNotifications(appeal, type) {
    try {
      const notification = {
        type: 'appeal_update',
        title: this.getNotificationTitle(type),
        message: this.getNotificationMessage(appeal, type),
        appealId: appeal.appealId
      };

      await notificationService.sendNotification(
        appeal.appealerAddress,
        notification
      );

      // Track notification sent
      appeal.notificationsSent.push({
        type,
        sentAt: new Date(),
        recipient: appeal.appealerAddress
      });

      await appeal.save();

    } catch (error) {
      logger.error('❌ Error sending appeal notifications:', error);
    }
  }

  getNotificationTitle(type) {
    const titles = {
      appeal_received: 'Appeal Received',
      under_review: 'Appeal Under Review',
      community_vote_started: 'Community Vote Started',
      resolution: 'Appeal Resolved'
    };
    
    return titles[type] || 'Appeal Update';
  }

  getNotificationMessage(appeal, type) {
    const messages = {
      appeal_received: `Your appeal (${appeal.appealId}) has been received and will be reviewed.`,
      under_review: `Your appeal (${appeal.appealId}) is now under review by our moderation team.`,
      community_vote_started: `Your appeal (${appeal.appealId}) has been escalated to community voting.`,
      resolution: `Your appeal (${appeal.appealId}) has been ${appeal.status === 'approved' ? 'approved' : 'rejected'}.`
    };
    
    return messages[type] || 'Your appeal status has been updated.';
  }

  estimateResolutionTime(appeal) {
    // Estimate based on appeal complexity and current queue
    if (appeal.status === 'community_vote') {
      return '5-7 days (community voting period)';
    } else if (appeal.status === 'under_review') {
      return '1-3 business days';
    } else {
      return '24-48 hours';
    }
  }
}

module.exports = new AppealService();