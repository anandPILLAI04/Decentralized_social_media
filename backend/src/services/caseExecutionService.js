const GovernanceCase = require('../models/GovernanceCase');
const CommunityMember = require('../models/CommunityMember');
const User = require('../models/User');
const UserViolation = require('../models/UserViolation');
const Post = require('../models/Post');
const governanceNotificationService = require('./governanceNotificationService');
const notificationService = require('./notificationService');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Case Execution Service
 * Handles automatic execution of approved governance decisions
 */

// Execution action types
const EXECUTION_ACTIONS = {
  // Content actions
  REMOVE_CONTENT: 'REMOVE_CONTENT',
  HIDE_CONTENT: 'HIDE_CONTENT',
  RESTORE_CONTENT: 'RESTORE_CONTENT',
  FLAG_CONTENT: 'FLAG_CONTENT',
  
  // User actions
  WARN_USER: 'WARN_USER',
  RESTRICT_USER: 'RESTRICT_USER',
  SUSPEND_USER: 'SUSPEND_USER',
  BAN_USER: 'BAN_USER',
  REMOVE_RESTRICTION: 'REMOVE_RESTRICTION',
  
  // Community actions
  UPDATE_GUIDELINES: 'UPDATE_GUIDELINES',
  MODIFY_RULES: 'MODIFY_RULES',
  ADJUST_PARAMETERS: 'ADJUST_PARAMETERS',
  
  // Appeal actions
  REVERSE_DECISION: 'REVERSE_DECISION',
  RESTORE_STATUS: 'RESTORE_STATUS'
};

// Execution status types
const EXECUTION_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REQUIRES_MANUAL: 'REQUIRES_MANUAL'
};

/**
 * Determine execution actions based on case type, decision, and reporter's requested action
 */
async function determineExecutionActions(governanceCase, decision) {
  const actions = [];
  const caseType = governanceCase.type;
  const suggestedAction = governanceCase.caseData?.suggestedAction;

  // Only execute if case is APPROVED
  if (decision !== 'APPROVED') {
    logger.info(`⏭️  Case not approved - no actions to execute (Decision: ${decision})`);
    return actions;
  }

  switch (caseType) {
    case 'USER_REPORT': {
      // Execute the action requested by the reporter
      const reportedUserAddress = governanceCase.caseData?.reportedUser?.userAddress;
      const reportedUserId = governanceCase.caseData?.reportedUser?.userId;

      if (!reportedUserAddress && !reportedUserId) {
        logger.warn('⚠️  USER_REPORT case has no reported user info');
        break;
      }

      logger.info(`🎯 Executing USER_REPORT action: ${suggestedAction}`);
      logger.info(`   Reported user: ${reportedUserAddress}`);

      switch (suggestedAction) {
        case 'WARNING':
          actions.push({
            type: EXECUTION_ACTIONS.WARN_USER,
            target: reportedUserId || reportedUserAddress,
            params: {
              reason: governanceCase.description,
              duration: null,
              warningLevel: 1,
              caseId: governanceCase._id,
              isWalletAddressTarget: !reportedUserId, // true if target is wallet, false if target is userId
              postCreatorAddress: reportedUserAddress, // Provide wallet for notification fallback
              violationType: governanceCase.caseData?.violationType,
              approveVotes: governanceCase.votes?.approve || 0,
              rejectVotes: governanceCase.votes?.reject || 0,
              totalVoters: governanceCase.totalEligibleVoters
            }
          });
          logger.info(`   Action: Issue WARNING to user ${reportedUserAddress || reportedUserId}`);
          break;

        case 'TEMP_BAN_48H':
          // 48 hours suspension as per specification
          actions.push({
            type: EXECUTION_ACTIONS.SUSPEND_USER,
            target: reportedUserId || reportedUserAddress,
            params: {
              reason: governanceCase.description,
              duration: 48 * 60 * 60 * 1000, // 48 hours in milliseconds
              suspendAll: true,
              caseId: governanceCase._id,
              suspensionReason: 'Community governance vote - temporary suspension for 48 hours',
              isWalletAddressTarget: !reportedUserId, // true if target is wallet, false if target is userId
              postCreatorAddress: reportedUserAddress, // Provide wallet for notification fallback
              violationType: governanceCase.caseData?.violationType,
              approveVotes: governanceCase.votes?.approve || 0,
              rejectVotes: governanceCase.votes?.reject || 0,
              totalVoters: governanceCase.totalEligibleVoters
            }
          });
          logger.info(`   Action: Suspend user for 48 hours (${reportedUserAddress || reportedUserId})`);
          break;

        case 'PERMANENT_BAN':
          actions.push({
            type: EXECUTION_ACTIONS.BAN_USER,
            target: reportedUserId || reportedUserAddress,
            params: {
              reason: governanceCase.description,
              permanent: true,
              caseId: governanceCase._id,
              banReason: 'Permanent ban by community governance vote',
              isWalletAddressTarget: !reportedUserId, // true if target is wallet, false if target is userId
              postCreatorAddress: reportedUserAddress, // Provide wallet for notification fallback
              violationType: governanceCase.caseData?.violationType,
              approveVotes: governanceCase.votes?.approve || 0,
              rejectVotes: governanceCase.votes?.reject || 0,
              totalVoters: governanceCase.totalEligibleVoters
            }
          });
          logger.info(`   Action: Permanently ban user (${reportedUserAddress || reportedUserId})`);
          break;

        case 'DELETE_POST':
          // If reporting a specific post
          const postId = governanceCase.caseData?.originalContent?.postId;
          if (postId) {
            actions.push({
              type: EXECUTION_ACTIONS.REMOVE_CONTENT,
              target: postId,
              params: {
                reason: governanceCase.description,
                caseId: governanceCase._id,
                removalReason: 'Post deleted by community governance vote'
              }
            });
            logger.info(`   Action: Delete post (${postId})`);
          }
          break;

        default:
          logger.warn(`⚠️  Unknown suggested action: ${suggestedAction}`);
      }
      break;
    }

    case 'CONTENT_REPORT': {
      const postId = governanceCase.caseData?.originalContent?.postId;
      const suggestedAction = governanceCase.caseData?.suggestedAction;

      if (decision === 'APPROVED') {
        // If reporter suggested a specific action, execute it
        if (suggestedAction) {
          // Get the post to find the creator
          const post = await Post.findById(postId);
          // Post model stores creator as authorId (wallet address) or looks up by User._id
          const postCreatorId = post?.authorId;
          const postCreatorUserId = post?.userId;

          // If we have authorId (wallet), find the User by walletAddress
          let targetUserId = postCreatorUserId;
          if (!targetUserId && postCreatorId) {
            const creator = await User.findOne({ walletAddress: postCreatorId });
            targetUserId = creator?._id;
          }

          switch (suggestedAction) {
            case 'DELETE_POST':
              actions.push({
                type: EXECUTION_ACTIONS.REMOVE_CONTENT,
                target: postId,
                params: {
                  reason: governanceCase.description,
                  caseId: governanceCase._id,
                  removalReason: 'Post deleted by community governance vote',
                  postCreatorId: postCreatorId || postCreatorUserId,
                  postCreatorAddress: postCreatorId,
                  violationType: governanceCase.caseData?.violationType,
                  approveVotes: governanceCase.votes?.approve || 0,
                  rejectVotes: governanceCase.votes?.reject || 0,
                  totalVoters: governanceCase.totalEligibleVoters
                }
              });
              logger.info(`   Action: Delete post (${postId})`);
              break;

            case 'WARNING':
              if (targetUserId) {
                actions.push({
                  type: EXECUTION_ACTIONS.WARN_USER,
                  target: targetUserId,
                  params: {
                    reason: governanceCase.description,
                    duration: null,
                    warningLevel: 1,
                    caseId: governanceCase._id,
                    postCreatorAddress: postCreatorId, // Include wallet for notification fallback
                    violationType: governanceCase.caseData?.violationType,
                    approveVotes: governanceCase.votes?.approve || 0,
                    rejectVotes: governanceCase.votes?.reject || 0,
                    totalVoters: governanceCase.totalEligibleVoters
                  }
                });
                logger.info(`   Action: Issue WARNING to post creator (${targetUserId})`);
              } else {
                logger.warn(`⚠️  Could not find post creator user ID, but will attempt notification for ${postCreatorId}`);
                // Still create the action - notification will use wallet address
                if (postCreatorId) {
                  actions.push({
                    type: EXECUTION_ACTIONS.WARN_USER,
                    target: postCreatorId,
                    params: {
                      reason: governanceCase.description,
                      duration: null,
                      warningLevel: 1,
                      caseId: governanceCase._id,
                      isWalletAddressTarget: true,
                      violationType: governanceCase.caseData?.violationType,
                      approveVotes: governanceCase.votes?.approve || 0,
                      rejectVotes: governanceCase.votes?.reject || 0,
                      totalVoters: governanceCase.totalEligibleVoters
                    }
                  });
                }
              }
              break;

            case 'TEMP_BAN_48H':
              if (targetUserId) {
                actions.push({
                  type: EXECUTION_ACTIONS.SUSPEND_USER,
                  target: targetUserId,
                  params: {
                    reason: governanceCase.description,
                    duration: 48 * 60 * 60 * 1000,
                    suspendAll: true,
                    caseId: governanceCase._id,
                    suspensionReason: 'Community governance vote - temporary suspension for 48 hours',
                    postCreatorAddress: postCreatorId, // Include wallet for notification fallback
                    violationType: governanceCase.caseData?.violationType,
                    approveVotes: governanceCase.votes?.approve || 0,
                    rejectVotes: governanceCase.votes?.reject || 0,
                    totalVoters: governanceCase.totalEligibleVoters
                  }
                });
                logger.info(`   Action: Suspend post creator for 48 hours (${targetUserId})`);
              } else {
                logger.warn(`⚠️  Could not find post creator user ID, but will attempt notification for ${postCreatorId}`);
                // Still create the action - notification will use wallet address
                if (postCreatorId) {
                  actions.push({
                    type: EXECUTION_ACTIONS.SUSPEND_USER,
                    target: postCreatorId,
                    params: {
                      reason: governanceCase.description,
                      duration: 48 * 60 * 60 * 1000,
                      suspendAll: true,
                      caseId: governanceCase._id,
                      suspensionReason: 'Community governance vote - temporary suspension for 48 hours',
                      isWalletAddressTarget: true,
                      violationType: governanceCase.caseData?.violationType,
                      approveVotes: governanceCase.votes?.approve || 0,
                      rejectVotes: governanceCase.votes?.reject || 0,
                      totalVoters: governanceCase.totalEligibleVoters
                    }
                  });
                }
              }
              break;

            case 'PERMANENT_BAN':
              if (targetUserId) {
                actions.push({
                  type: EXECUTION_ACTIONS.BAN_USER,
                  target: targetUserId,
                  params: {
                    reason: governanceCase.description,
                    permanent: true,
                    caseId: governanceCase._id,
                    banReason: 'Permanent ban by community governance vote',
                    postCreatorAddress: postCreatorId, // Include wallet for notification fallback
                    violationType: governanceCase.caseData?.violationType,
                    approveVotes: governanceCase.votes?.approve || 0,
                    rejectVotes: governanceCase.votes?.reject || 0,
                    totalVoters: governanceCase.totalEligibleVoters
                  }
                });
                logger.info(`   Action: Permanently ban post creator (${targetUserId})`);
              } else {
                logger.warn(`⚠️  Could not find post creator user ID, but will attempt notification for ${postCreatorId}`);
                // Still create the action - notification will use wallet address
                if (postCreatorId) {
                  actions.push({
                    type: EXECUTION_ACTIONS.BAN_USER,
                    target: postCreatorId,
                    params: {
                      reason: governanceCase.description,
                      permanent: true,
                      caseId: governanceCase._id,
                      banReason: 'Permanent ban by community governance vote',
                      isWalletAddressTarget: true,
                      violationType: governanceCase.caseData?.violationType,
                      approveVotes: governanceCase.votes?.approve || 0,
                      rejectVotes: governanceCase.votes?.reject || 0,
                      totalVoters: governanceCase.totalEligibleVoters
                    }
                  });
                }
              }
              break;

            default:
              // Default: just delete the content
              actions.push({
                type: EXECUTION_ACTIONS.REMOVE_CONTENT,
                target: postId,
                params: { reason: governanceCase.description, caseId: governanceCase._id }
              });
              logger.info(`   Action: Delete post (${postId})`);
          }
        } else {
          // No suggested action, default: restore content
          actions.push({
            type: EXECUTION_ACTIONS.RESTORE_CONTENT,
            target: postId,
            params: { reason: 'Appeal approved by community' }
          });
          logger.info(`   Action: Restore content (post ${postId})`);
        }
      }
      break;
    }

    case 'GUIDELINE_UPDATE':
      if (decision === 'APPROVED') {
        actions.push({
          type: EXECUTION_ACTIONS.UPDATE_GUIDELINES,
          target: 'COMMUNITY_GUIDELINES',
          params: {
            changes: governanceCase.caseData || {},
            effectiveDate: new Date()
          }
        });
        logger.info(`   Action: Update community guidelines`);
      }
      break;

    case 'AI_OVERRIDE': {
      const postId = governanceCase.caseData?.originalContent?.postId;
      if (postId) {
        if (decision === 'APPROVED') {
          actions.push({
            type: EXECUTION_ACTIONS.HIDE_CONTENT,
            target: postId,
            params: {
              reason: `Community governance upheld AI moderation flag`,
              confirmedByGovernance: true
            }
          });
          logger.info(`   Action: Hide content (post ${postId})`);
        } else {
          actions.push({
            type: EXECUTION_ACTIONS.RESTORE_CONTENT,
            target: postId,
            params: {
              reason: 'Community governance dismissed AI moderation flag',
              confirmedByGovernance: true
            }
          });
          logger.info(`   Action: Restore content (post ${postId})`);
        }
      }
      break;
    }

    default:
      logger.warn(`⚠️  Unknown case type for execution: ${caseType}`);
  }

  return actions;
}

/**
 * Execute content-related actions
 */
async function executeContentAction(action) {
  const { type, target, params } = action;

  try {
    switch (type) {
      case EXECUTION_ACTIONS.REMOVE_CONTENT:
        const deletedPost = await Post.findByIdAndUpdate(
          target,
          {
            $set: {
              isDeleted: true,
              deletedAt: new Date(),
              deletedReason: params.reason,
              deletedBy: 'COMMUNITY_GOVERNANCE'
            }
          },
          { new: true }
        );

        // Send notification to post creator
        if (deletedPost && (params.postCreatorAddress || params.postCreatorId)) {
          const creatorWallet = params.postCreatorAddress;
          const creatorId = params.postCreatorId;

          // Try to get creator user details if we have the ID
          let creatorUser = null;
          if (creatorId) {
            try {
              creatorUser = await User.findById(creatorId).select('username walletAddress email');
            } catch (err) {
              logger.warn(`Could not fetch user details for ${creatorId}`);
            }
          } else if (creatorWallet) {
            // Try to find by wallet address
            try {
              creatorUser = await User.findOne({ walletAddress: creatorWallet.toLowerCase() }).select('username walletAddress email');
            } catch (err) {
              logger.warn(`Could not fetch user by wallet ${creatorWallet}`);
            }
          }

          try {
            const notificationResult = await notificationService.createNotification({
              type: 'governance_status_update',
              recipient: creatorUser?.walletAddress || creatorWallet,
              sender: {
                address: 'COMMUNITY_GOVERNANCE',
                username: 'Community Governance'
              },
              content: {
                title: '🗑️ Your Post Was Removed',
                message: `Your post has been removed by community governance.\n\nViolation Type: ${params.violationType || 'Not specified'}\nReason: ${params.reason}\n\nCommunity Vote: ${params.approveVotes} voted to remove, ${params.rejectVotes} voted against (${params.totalVoters} total voters)`,
                actionType: 'POST_REMOVED',
                caseId: params.caseId,
                postId: target
              },
              metadata: {
                caseId: params.caseId,
                actionType: 'POST_REMOVED',
                postId: target,
                violationType: params.violationType,
                approveVotes: params.approveVotes,
                rejectVotes: params.rejectVotes
              }
            });
            if (notificationResult) {
              logger.info(`📢 Post removal notification sent to ${creatorUser?.username || creatorWallet}`);
            } else {
              logger.warn(`⚠️ Post removal notification returned null for ${creatorUser?.username || creatorWallet}`);
            }
          } catch (notifErr) {
            logger.error(`❌ Error sending post removal notification:`, notifErr);
          }
        }
        break;

      case EXECUTION_ACTIONS.HIDE_CONTENT:
        await Post.findByIdAndUpdate(
          target,
          {
            $set: {
              isHidden: true,
              hiddenAt: new Date(),
              hiddenReason: params.reason,
              hiddenBy: 'COMMUNITY_GOVERNANCE'
            }
          }
        );
        break;

      case EXECUTION_ACTIONS.RESTORE_CONTENT:
        await Post.findByIdAndUpdate(
          target,
          {
            $set: {
              isDeleted: false,
              isHidden: false,
              restoredAt: new Date(),
              restoredReason: params.reason,
              restoredBy: 'COMMUNITY_GOVERNANCE'
            },
            $unset: {
              deletedAt: 1,
              deletedReason: 1,
              hiddenAt: 1,
              hiddenReason: 1
            }
          }
        );
        break;

      case EXECUTION_ACTIONS.FLAG_CONTENT:
        await Post.findByIdAndUpdate(
          target,
          {
            $set: {
              'moderation.flagged': true,
              'moderation.flaggedAt': new Date(),
              'moderation.flagReason': params.reason,
              'moderation.confirmedByGovernance': params.confirmed || false
            }
          }
        );
        break;
        
      default:
        throw new Error(`Unknown content action: ${type}`);
    }
    
    return { success: true, message: `Content action ${type} executed successfully` };
    
  } catch (error) {
    logger.error(`Error executing content action ${type}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute user-related actions
 */
async function executeUserAction(action) {
  const { type, target, params } = action;

  try {
    switch (type) {
      case EXECUTION_ACTIONS.WARN_USER:
        // Handle both user ID and wallet address targets
        let userIdForWarning = target;
        let walletForWarning = params.postCreatorAddress;

        if (params.isWalletAddressTarget) {
          // Target is a wallet address, try to find user by it
          walletForWarning = target;
          const userByWallet = await User.findOne({ walletAddress: target.toLowerCase() });
          userIdForWarning = userByWallet?._id;
        }

        // Add warning to user's moderation history if we have user ID
        if (userIdForWarning) {
          await User.findByIdAndUpdate(
            userIdForWarning,
            {
              $push: {
                'moderation.warnings': {
                  reason: params.reason,
                  issuedAt: new Date(),
                  issuedBy: 'COMMUNITY_GOVERNANCE',
                  level: params.warningLevel || 1,
                  caseId: params.caseId
                }
              },
              $inc: {
                'moderation.warningCount': 1
              }
            }
          );
          logger.info(`⚠️ Warning issued to user ${userIdForWarning}`);
        }

        // Send notification (use wallet if available, otherwise use user ID)
        const notificationRecipient = walletForWarning || userIdForWarning;
        if (notificationRecipient) {
          // If we have user ID, get full user details; otherwise use what we have
          let warnedUser = null;
          if (userIdForWarning) {
            warnedUser = await User.findById(userIdForWarning).select('username walletAddress email');
          }

          try {
            const notificationResult = await notificationService.createNotification({
              type: 'moderation_warning',
              recipient: warnedUser?.walletAddress || walletForWarning,
              sender: {
                address: 'COMMUNITY_GOVERNANCE',
                username: 'Community Governance'
              },
              content: {
                title: '⚠️ Community Warning Issued',
                message: `Your account has received a warning from community governance.\n\nViolation Type: ${params.violationType || 'Not specified'}\nReason: ${params.reason}\n\nCommunity Vote: ${params.approveVotes} voted to approve, ${params.rejectVotes} voted against (${params.totalVoters} total voters)`,
                actionType: 'WARNING',
                caseId: params.caseId,
                reason: params.reason
              },
              metadata: {
                caseId: params.caseId,
                actionType: 'WARNING',
                level: params.warningLevel || 1,
                violationType: params.violationType,
                approveVotes: params.approveVotes,
                rejectVotes: params.rejectVotes
              }
            });
            if (notificationResult) {
              logger.info(`📢 Notification sent for WARNING to ${warnedUser?.username || walletForWarning}`);
            } else {
              logger.warn(`⚠️ Notification creation returned null for WARNING to ${warnedUser?.username || walletForWarning}`);
            }
          } catch (notifErr) {
            logger.error(`❌ Error sending WARNING notification:`, notifErr);
          }
        }
        break;

      case EXECUTION_ACTIONS.RESTRICT_USER:
        const restrictionEnd = new Date(Date.now() + params.duration);
        await User.findByIdAndUpdate(
          target,
          {
            $set: {
              'moderation.restricted': true,
              'moderation.restrictionStart': new Date(),
              'moderation.restrictionEnd': restrictionEnd,
              'moderation.restrictionReason': params.reason,
              'moderation.restrictions': params.restrictions || ['posting', 'commenting']
            }
          }
        );

        // Send notification
        const restrictedUser = await User.findById(target).select('username walletAddress email');
        if (restrictedUser) {
          await notificationService.createNotification({
            type: 'governance_status_update',
            recipient: restrictedUser.walletAddress,
            sender: {
              address: 'COMMUNITY_GOVERNANCE',
              username: 'Community Governance'
            },
            content: {
              title: '🚫 Account Restrictions Applied',
              message: `Your account has been restricted by community governance. Restrictions: ${params.restrictions?.join(', ')}. Reason: ${params.reason}`,
              actionType: 'RESTRICT',
              caseId: params.caseId,
              restrictions: params.restrictions
            },
            metadata: {
              caseId: params.caseId,
              actionType: 'RESTRICT',
              restrictionEnd: restrictionEnd
            }
          });
          logger.info(`📢 Notification sent to ${restrictedUser.username} for RESTRICT`);
        }
        break;

      case EXECUTION_ACTIONS.SUSPEND_USER:
        // Handle both user ID and wallet address targets
        let userIdForSuspend = target;
        let walletForSuspend = params.postCreatorAddress;

        if (params.isWalletAddressTarget) {
          // Target is a wallet address, try to find user by it
          walletForSuspend = target;
          const userByWallet = await User.findOne({ walletAddress: target.toLowerCase() });
          userIdForSuspend = userByWallet?._id;
        }

        const suspensionEnd = new Date(Date.now() + params.duration);
        const durationHours = params.duration / (1000 * 60 * 60);

        // Update user suspension status if we have user ID
        if (userIdForSuspend) {
          await User.findByIdAndUpdate(
            userIdForSuspend,
            {
              $set: {
                'moderation.suspended': true,
                'moderation.suspensionStart': new Date(),
                'moderation.suspensionEnd': suspensionEnd,
                'moderation.suspensionReason': params.reason,
                'moderation.suspendedBy': 'COMMUNITY_GOVERNANCE'
              }
            }
          );
          logger.info(`⏸️ User ${userIdForSuspend} suspended until ${suspensionEnd}`);
        }

        // Create/Update UserViolation record with temp_ban restrictions (CRITICAL!)
        try {
          const lowerWallet = (walletForSuspend || (await User.findById(userIdForSuspend))?.walletAddress)?.toLowerCase();
          if (lowerWallet) {
            await UserViolation.findOneAndUpdate(
              { userAddress: lowerWallet },
              {
                $set: {
                  userAddress: lowerWallet,
                  restrictions: {
                    restrictionLevel: 'temp_ban',
                    canPost: false,
                    canComment: false,
                    restrictedUntil: suspensionEnd,
                    restrictionReason: params.reason,
                    tempBanHours: durationHours
                  }
                }
              },
              { upsert: true, new: true }
            );
            logger.info(`🔒 UserViolation temp_ban created for ${lowerWallet} until ${suspensionEnd}`);
          }
        } catch (violErr) {
          logger.error(`❌ Error creating UserViolation for SUSPEND:`, violErr);
        }

        // Send notification
        const notificationRecipientSuspend = walletForSuspend || userIdForSuspend;
        if (notificationRecipientSuspend) {
          let suspendedUser = null;
          if (userIdForSuspend) {
            suspendedUser = await User.findById(userIdForSuspend).select('username walletAddress email');
          }

          const durationHours = params.duration / (1000 * 60 * 60);
          try {
            const notificationResult = await notificationService.createNotification({
              type: 'moderation_temp_ban',
              recipient: suspendedUser?.walletAddress || walletForSuspend,
              sender: {
                address: 'COMMUNITY_GOVERNANCE',
                username: 'Community Governance'
              },
              content: {
                title: '⏸️ Account Temporarily Suspended',
                message: `Your account has been suspended for ${durationHours} hours by community governance.\n\nViolation Type: ${params.violationType || 'Not specified'}\nReason: ${params.reason}\n\nCommunity Vote: ${params.approveVotes} voted to approve, ${params.rejectVotes} voted against (${params.totalVoters} total voters)\n\nYour account will be available after ${suspensionEnd.toLocaleString()}`,
                actionType: 'SUSPEND',
                caseId: params.caseId,
                suspensionEnd: suspensionEnd
              },
              metadata: {
                caseId: params.caseId,
                actionType: 'SUSPEND',
                durationHours: durationHours,
                suspensionEnd: suspensionEnd,
                violationType: params.violationType,
                approveVotes: params.approveVotes,
                rejectVotes: params.rejectVotes
              }
            });
            if (notificationResult) {
              logger.info(`📢 Notification sent for SUSPEND to ${suspendedUser?.username || walletForSuspend}`);
            } else {
              logger.warn(`⚠️ Notification creation returned null for SUSPEND to ${suspendedUser?.username || walletForSuspend}`);
            }
          } catch (notifErr) {
            logger.error(`❌ Error sending SUSPEND notification:`, notifErr);
          }
        }
        break;

      case EXECUTION_ACTIONS.BAN_USER:
        // Handle both user ID and wallet address targets
        let userIdForBan = target;
        let walletForBan = params.postCreatorAddress;

        if (params.isWalletAddressTarget) {
          // Target is a wallet address, try to find user by it
          walletForBan = target;
          const userByWallet = await User.findOne({ walletAddress: target.toLowerCase() });
          userIdForBan = userByWallet?._id;
        }

        // Update user ban status if we have user ID
        if (userIdForBan) {
          await User.findByIdAndUpdate(
            userIdForBan,
            {
              $set: {
                'moderation.banned': true,
                'moderation.bannedAt': new Date(),
                'moderation.bannedReason': params.reason,
                'moderation.bannedBy': 'COMMUNITY_GOVERNANCE',
                'moderation.permanent': params.permanent || false
              }
            }
          );
          logger.info(`🔒 User ${userIdForBan} banned (permanent: ${params.permanent})`);
        }

        // Create/Update UserViolation record with permanent_ban restrictions (CRITICAL!)
        try {
          const lowerWallet = (walletForBan || (await User.findById(userIdForBan))?.walletAddress)?.toLowerCase();
          if (lowerWallet) {
            await UserViolation.findOneAndUpdate(
              { userAddress: lowerWallet },
              {
                $set: {
                  userAddress: lowerWallet,
                  restrictions: {
                    restrictionLevel: 'permanent_ban',
                    canPost: false,
                    canComment: false,
                    restrictedUntil: null, // Permanent, no expiry
                    restrictionReason: params.reason,
                    tempBanHours: null
                  }
                }
              },
              { upsert: true, new: true }
            );
            logger.info(`🔒 UserViolation permanent_ban created for ${lowerWallet}`);
          }
        } catch (violErr) {
          logger.error(`❌ Error creating UserViolation for BAN:`, violErr);
        }

        // Send notification
        const notificationRecipientBan = walletForBan || userIdForBan;
        if (notificationRecipientBan) {
          let bannedUser = null;
          if (userIdForBan) {
            bannedUser = await User.findById(userIdForBan).select('username walletAddress email');
          }

          const banType = params.permanent ? 'permanently' : 'temporarily';
          try {
            const notificationResult = await notificationService.createNotification({
              type: 'moderation_permanent_ban',
              recipient: bannedUser?.walletAddress || walletForBan,
              sender: {
                address: 'COMMUNITY_GOVERNANCE',
                username: 'Community Governance'
              },
              content: {
                title: '🔒 Account Banned',
                message: `Your account has been ${banType} banned by community governance.\n\nViolation Type: ${params.violationType || 'Not specified'}\nReason: ${params.reason}\n\nCommunity Vote: ${params.approveVotes} voted to approve, ${params.rejectVotes} voted against (${params.totalVoters} total voters)\n\n${!params.permanent ? 'You may appeal this decision.' : 'This ban is permanent.'}`,
                actionType: 'BAN',
                caseId: params.caseId,
                permanent: params.permanent
              },
              metadata: {
                caseId: params.caseId,
                actionType: 'BAN',
                permanent: params.permanent,
                violationType: params.violationType,
                approveVotes: params.approveVotes,
                rejectVotes: params.rejectVotes
              }
            });
            if (notificationResult) {
              logger.info(`📢 Notification sent for BAN to ${bannedUser?.username || walletForBan}`);
            } else {
              logger.warn(`⚠️ Notification creation returned null for BAN to ${bannedUser?.username || walletForBan}`);
            }
          } catch (notifErr) {
            logger.error(`❌ Error sending BAN notification:`, notifErr);
          }
        }
        break;

      case EXECUTION_ACTIONS.REMOVE_RESTRICTION:
        await User.findByIdAndUpdate(
          target,
          {
            $set: {
              'moderation.restricted': false,
              'moderation.restrictionRemovedAt': new Date(),
              'moderation.restrictionRemovedReason': params.reason
            },
            $unset: {
              'moderation.restrictionStart': 1,
              'moderation.restrictionEnd': 1,
              'moderation.restrictions': 1
            }
          }
        );

        // Send notification
        const unrestrictedUser = await User.findById(target).select('username walletAddress email');
        if (unrestrictedUser) {
          await notificationService.createNotification({
            type: 'governance_status_update',
            recipient: unrestrictedUser.walletAddress,
            sender: {
              address: 'COMMUNITY_GOVERNANCE',
              username: 'Community Governance'
            },
            content: {
              title: '✅ Restrictions Lifted',
              message: `Your account restrictions have been lifted. You can now use all platform features again.`,
              actionType: 'UNRESTRICT',
              caseId: params.caseId
            },
            metadata: {
              caseId: params.caseId,
              actionType: 'UNRESTRICT'
            }
          });
          logger.info(`📢 Notification sent to ${unrestrictedUser.username} for UNRESTRICT`);
        }
        break;

      default:
        throw new Error(`Unknown user action: ${type}`);
    }

    return { success: true, message: `User action ${type} executed successfully` };

  } catch (error) {
    logger.error(`Error executing user action ${type}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute policy/community actions
 */
async function executePolicyAction(action) {
  const { type, target, params } = action;

  try {
    switch (type) {
      case EXECUTION_ACTIONS.UPDATE_GUIDELINES:
        // This would typically update a community guidelines collection
        // For now, we'll log the action and mark it as requiring manual intervention
        logger.info('Policy update action:', { type, target, params });
        return {
          success: true,
          requiresManual: true,
          message: 'Policy update flagged for manual implementation'
        };

      default:
        throw new Error(`Unknown policy action: ${type}`);
    }

  } catch (error) {
    logger.error(`Error executing policy action ${type}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Execute a single action
 */
async function executeAction(action) {
  const { type } = action;
  
  // Determine action category and route to appropriate handler
  if ([
    EXECUTION_ACTIONS.REMOVE_CONTENT,
    EXECUTION_ACTIONS.HIDE_CONTENT,
    EXECUTION_ACTIONS.RESTORE_CONTENT,
    EXECUTION_ACTIONS.FLAG_CONTENT
  ].includes(type)) {
    return executeContentAction(action);
  }

  if ([
    EXECUTION_ACTIONS.WARN_USER,
    EXECUTION_ACTIONS.RESTRICT_USER,
    EXECUTION_ACTIONS.SUSPEND_USER,
    EXECUTION_ACTIONS.BAN_USER,
    EXECUTION_ACTIONS.REMOVE_RESTRICTION
  ].includes(type)) {
    return executeUserAction(action);
  }

  if ([
    EXECUTION_ACTIONS.UPDATE_GUIDELINES,
    EXECUTION_ACTIONS.MODIFY_RULES,
    EXECUTION_ACTIONS.ADJUST_PARAMETERS
  ].includes(type)) {
    return executePolicyAction(action);
  }
  
  throw new Error(`Unknown action type: ${type}`);
}

/**
 * Execute all actions for a governance case
 */
async function executeGovernanceCase(caseId, decision, executorId = null) {
  try {
    logger.info(`Executing governance case ${caseId} with decision: ${decision}`);

    // Get the case details
    const governanceCase = await GovernanceCase.findById(caseId);
    if (!governanceCase) {
      throw new Error('Governance case not found');
    }
    
    // Check if case is in executable state using the model's built-in method
    if (!governanceCase.canExecute()) {
      const reason = governanceCase.status !== 'VOTING_ENDED' ? 
        `Case status is ${governanceCase.status}, not VOTING_ENDED` :
        governanceCase.executed ? 
          'Case has already been executed' :
          `Voting did not pass: ${governanceCase.votes.approve}/${governanceCase.totalVotes} votes (need majority)`;
      
      throw new Error(`Case cannot be executed: ${reason}`);
    }
    
    // Determine what actions to take
    const actions = await determineExecutionActions(governanceCase, decision);
    
    if (actions.length === 0) {
      // No actions needed - just mark as executed
      await GovernanceCase.findByIdAndUpdate(
        caseId,
        {
          $set: {
            'execution.status': EXECUTION_STATUS.COMPLETED,
            'execution.executedAt': new Date(),
            'execution.executedBy': executorId || 'SYSTEM',
            'execution.actions': [],
            'execution.results': [{ success: true, message: 'No actions required' }],
            'executed': true
          }
        }
      );

      return {
        success: true,
        message: 'Case executed successfully (no actions required)',
        executedActions: 0,
        results: []
      };
    }
    
    // Execute each action
    const results = [];
    let allSuccessful = true;
    let requiresManual = false;
    
    for (const action of actions) {
      try {
        logger.info(`Executing action: ${action.type} on ${action.target}`);
        const result = await executeAction(action);
        results.push({ action: action.type, ...result });
        
        if (!result.success) {
          allSuccessful = false;
        }
        if (result.requiresManual) {
          requiresManual = true;
        }
      } catch (error) {
        logger.error(`Failed to execute action ${action.type}:`, error);
        results.push({
          action: action.type,
          success: false,
          error: error.message
        });
        allSuccessful = false;
      }
    }
    
    // Update case with execution results
    const executionStatus = allSuccessful
      ? (requiresManual ? EXECUTION_STATUS.REQUIRES_MANUAL : EXECUTION_STATUS.COMPLETED)
      : EXECUTION_STATUS.FAILED;

    await GovernanceCase.findByIdAndUpdate(
      caseId,
      {
        $set: {
          'execution.status': executionStatus,
          'execution.executedAt': new Date(),
          'execution.executedBy': executorId || 'SYSTEM',
          'execution.actions': actions,
          'execution.results': results,
          'execution.requiresManualReview': requiresManual,
          'executed': true  // Mark case as executed
        }
      }
    );

    logger.info(`Case execution completed with status: ${executionStatus}`);
    
    // Send execution notification to participants
    try {
      const executionResult = {
        summary: `Case executed with ${actions.length} actions`,
        actions: actions,
        status: executionStatus,
        successfulActions: results.filter(r => r.success).length,
        failedActions: results.filter(r => !r.success).length
      };
      
      await governanceNotificationService.notifyCaseExecuted(governanceCase, executionResult);
      logger.info(`✅ Execution notifications sent for case: ${caseId}`);
    } catch (notificationError) {
      logger.error('⚠️  Failed to send execution notifications:', notificationError);
      // Don't fail the execution if notifications fail
    }
    
    return {
      success: true,
      message: `Case executed with status: ${executionStatus}`,
      executedActions: actions.length,
      results: results,
      requiresManualReview: requiresManual
    };

  } catch (error) {
    logger.error('Error executing governance case:', error);

    // Mark case as execution failed
    try {
      await GovernanceCase.findByIdAndUpdate(caseId, {
        $set: {
          'execution.status': EXECUTION_STATUS.FAILED,
          'execution.executedAt': new Date(),
          'execution.error': error.message,
          'execution.requiresManualReview': true,
          'executed': true
        }
      });
    } catch (updateError) {
      logger.error('Failed to update case with execution error:', updateError);
    }

    return {
      success: false,
      error: error.message,
      message: 'Case execution failed'
    };
  }
}

/**
 * Get execution status for a case
 */
async function getExecutionStatus(caseId) {
  try {
    const governanceCase = await GovernanceCase.findById(caseId)
      .select('execution status title type')
      .lean();

    if (!governanceCase) {
      return { success: false, error: 'Case not found' };
    }

    return {
      success: true,
      data: {
        caseId,
        title: governanceCase.title,
        caseType: governanceCase.type,
        status: governanceCase.status,
        execution: governanceCase.execution || {
          status: EXECUTION_STATUS.PENDING,
          actions: [],
          results: []
        }
      }
    };
    
  } catch (error) {
    logger.error('Error getting execution status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Retry failed execution
 */
async function retryExecution(caseId, executorId = null) {
  try {
    const governanceCase = await GovernanceCase.findById(caseId);
    if (!governanceCase) {
      throw new Error('Case not found');
    }
    
    if (governanceCase.execution?.status !== EXECUTION_STATUS.FAILED) {
      throw new Error('Can only retry failed executions');
    }
    
    // Determine decision based on voting results
    const majorityThreshold = governanceCase.totalVotes * 0.5;
    const decision = governanceCase.votes.approve > majorityThreshold ? 'APPROVED' : 'REJECTED';
    return await executeGovernanceCase(caseId, decision, executorId);
    
  } catch (error) {
    logger.error('Error retrying execution:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  executeGovernanceCase,
  getExecutionStatus,
  retryExecution,
  EXECUTION_ACTIONS,
  EXECUTION_STATUS,
  determineExecutionActions
};