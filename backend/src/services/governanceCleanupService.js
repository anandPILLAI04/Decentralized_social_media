const GovernanceCase = require('../models/GovernanceCase');
const CommunityVote = require('../models/CommunityVote');
const governanceNotificationService = require('./governanceNotificationService');

/**
 * Service for cleaning up governance cases when related content is removed
 */
class GovernanceCleanupService {
  
  /**
   * Clean up governance cases related to deleted content
   * @param {string} contentId - The ID of the deleted content
   * @param {string} contentType - Type of content (post, comment, user, etc.)
   * @param {string} reason - Reason for deletion (user_deletion, moderation, etc.)
   * @param {string} deletedBy - Who deleted the content (user address or 'system')
   */
  async cleanupCasesForDeletedContent(contentId, contentType = 'post', reason = 'Content deleted', deletedBy = 'user') {
    try {
      console.log(`🧹 Starting governance cleanup for deleted ${contentType}: ${contentId}`);
      
      // Find any governance cases related to this content
      const relatedCases = await GovernanceCase.find({
        $or: [
          { 'targetId': contentId },
          { 'contentId': contentId },
          { 'relatedContent.id': contentId },
          { 'reportedContent.id': contentId }
        ],
        status: { $in: ['PENDING_REVIEW', 'ACTIVE_VOTING'] } // Only affect active cases
      });

      if (relatedCases.length === 0) {
        console.log(`✅ No active governance cases found for ${contentType} ${contentId}`);
        return { cleanedUpCases: 0, deletedVotes: 0 };
      }

      console.log(`🏛️ Found ${relatedCases.length} governance cases related to deleted ${contentType} ${contentId}`);

      let totalDeletedVotes = 0;
      const cleanedCases = [];

      // Update each related governance case
      for (const governanceCase of relatedCases) {
        // Determine the resolution status based on deletion reason
        let resolutionStatus = 'REJECTED';
        let resolutionReason = `${reason} - case invalidated`;
        let autoResolvedFlag = true;

        if (reason.includes('moderation') || reason.includes('violation')) {
          resolutionStatus = 'EXECUTED'; // Content was removed by moderation
          resolutionReason = `Content removed by moderation - case automatically resolved`;
          autoResolvedFlag = true;
        } else if (reason.includes('user_deletion') || deletedBy !== 'system') {
          resolutionStatus = 'REJECTED';
          resolutionReason = `Content deleted by author - case invalidated`;
          autoResolvedFlag = true;
        }

        // Update the governance case
        await GovernanceCase.findByIdAndUpdate(governanceCase._id, {
          status: resolutionStatus,
          resolution: `auto_resolved_content_deleted`,
          resolutionReason: resolutionReason,
          resolvedAt: new Date(),
          autoResolved: autoResolvedFlag,
          deletionInfo: {
            deletedContentId: contentId,
            deletedContentType: contentType,
            deletionReason: reason,
            deletedBy: deletedBy,
            deletedAt: new Date()
          }
        });

        // Delete all votes on this case since it's now invalid/resolved
        const deletedVotes = await CommunityVote.deleteMany({
          caseId: governanceCase._id
        });

        totalDeletedVotes += deletedVotes.deletedCount;
        cleanedCases.push({
          caseId: governanceCase._id,
          caseTitle: governanceCase.title,
          deletedVotes: deletedVotes.deletedCount,
          newStatus: resolutionStatus
        });

        console.log(`🗳️ Deleted ${deletedVotes.deletedCount} votes for case ${governanceCase.caseId}`);

        // Send notifications to users who participated
        try {
          await governanceNotificationService.notifyCaseInvalidated(governanceCase, reason);
        } catch (notifError) {
          console.warn(`⚠️ Failed to send case invalidation notifications for ${governanceCase.caseId}:`, notifError.message);
        }
      }

      console.log(`✅ Successfully cleaned up ${cleanedCases.length} governance cases for deleted ${contentType}`);
      console.log(`🗳️ Total votes deleted: ${totalDeletedVotes}`);

      return {
        cleanedUpCases: cleanedCases.length,
        deletedVotes: totalDeletedVotes,
        cases: cleanedCases
      };
      
    } catch (error) {
      console.error(`❌ Error cleaning up governance cases for deleted ${contentType}:`, error);
      throw error;
    }
  }

  /**
   * Clean up governance cases when a user is banned or suspended
   * @param {string} userAddress - The wallet address of the banned user
   * @param {string} reason - Reason for the ban
   * @param {string} bannedBy - Who issued the ban
   */
  async cleanupCasesForBannedUser(userAddress, reason = 'User banned', bannedBy = 'system') {
    try {
      console.log(`🚫 Starting governance cleanup for banned user: ${userAddress}`);
      
      // Find cases where the banned user was involved
      const userCases = await GovernanceCase.find({
        $or: [
          { 'reporterAddress': userAddress },
          { 'targetUserAddress': userAddress },
          { 'createdBy': userAddress }
        ],
        status: { $in: ['PENDING_REVIEW', 'ACTIVE_VOTING'] }
      });

      // Also find cases where the banned user had voted
      const votedCases = await CommunityVote.find({
        voterAddress: userAddress
      }).populate('caseId');

      const allCasesToCleanup = new Map();
      
      // Add user's own cases
      userCases.forEach(case_ => {
        allCasesToCleanup.set(case_._id.toString(), {
          case: case_,
          reason: 'User banned - invalidating related cases',
          action: 'REJECTED'
        });
      });

      // Remove votes from cases where user voted
      for (const vote of votedCases) {
        if (vote.caseId && ['PENDING_REVIEW', 'ACTIVE_VOTING'].includes(vote.caseId.status)) {
          // Remove the specific vote
          await CommunityVote.findByIdAndDelete(vote._id);
          console.log(`🗳️ Removed vote from banned user ${userAddress} on case ${vote.caseId.caseId}`);
        }
      }

      // Clean up the user's cases
      let cleanedCases = 0;
      for (const [caseId, { case: governanceCase, reason: cleanupReason, action }] of allCasesToCleanup) {
        await GovernanceCase.findByIdAndUpdate(governanceCase._id, {
          status: action,
          resolution: 'auto_resolved_user_banned',
          resolutionReason: cleanupReason,
          resolvedAt: new Date(),
          autoResolved: true,
          banInfo: {
            bannedUser: userAddress,
            banReason: reason,
            bannedBy: bannedBy,
            bannedAt: new Date()
          }
        });

        // Notify participants
        try {
          await governanceNotificationService.notifyCaseInvalidated(governanceCase, `User was banned - ${reason}`);
        } catch (notifError) {
          console.warn(`⚠️ Failed to send notifications for banned user case ${governanceCase.caseId}:`, notifError.message);
        }

        cleanedCases++;
      }

      console.log(`✅ Cleaned up ${cleanedCases} cases and removed ${votedCases.length} votes for banned user ${userAddress}`);

      return {
        cleanedUpCases: cleanedCases,
        removedVotes: votedCases.length,
        bannedUser: userAddress
      };

    } catch (error) {
      console.error(`❌ Error cleaning up governance for banned user ${userAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get statistics about cleanup operations
   */
  async getCleanupStats(dateRange = 30) {
    try {
      const cutoffDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000);
      
      const autoResolvedCases = await GovernanceCase.countDocuments({
        autoResolved: true,
        resolvedAt: { $gte: cutoffDate }
      });

      const deletionResolvedCases = await GovernanceCase.countDocuments({
        resolution: { $regex: /auto_resolved_content_deleted/ },
        resolvedAt: { $gte: cutoffDate }
      });

      const banResolvedCases = await GovernanceCase.countDocuments({
        resolution: 'auto_resolved_user_banned',
        resolvedAt: { $gte: cutoffDate }
      });

      return {
        totalAutoResolved: autoResolvedCases,
        contentDeletionResolved: deletionResolvedCases,
        userBanResolved: banResolvedCases,
        dateRange: dateRange
      };
    } catch (error) {
      console.error('❌ Error getting cleanup stats:', error);
      return null;
    }
  }
}

module.exports = new GovernanceCleanupService();