const User = require('../models/User');
const UserViolation = require('../models/UserViolation');

/**
 * Ban Enforcement Middleware
 * Prevents banned users from accessing any platform functionality
 * Handles both permanent bans (User model) and escalation restrictions (UserViolation model)
 */

/**
 * Check if user is banned or restricted and prevent all actions
 */
async function enforceBanRestrictions(req, res, next) {
  try {
    const walletAddress = req.user?.address ||
                         req.headers['x-wallet-address'] ||
                         req.headers['x-user-address'] ||
                         req.body.walletAddress ||
                         req.body.userAddress ||
                         req.body.authorAddress ||
                         req.body.author ||
                         req.query.walletAddress ||
                         req.query.userAddress ||
                         req.params.walletAddress ||
                         req.params.userAddress;

    if (!walletAddress) {
      // If auth middleware ran (req.user exists), address should be present.
      // If there's no address and the route is a write operation, reject the request.
      const isWriteOp = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
      if (isWriteOp) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required to perform this action'
        });
      }
      return next(); // Allow read-only operations without wallet
    }

    // Check User model for permanent bans AND suspensions
    const user = await User.findOne({
      walletAddress: walletAddress.toLowerCase()
    }).select('moderation.banned moderation.bannedAt moderation.bannedReason moderation.bannedBy moderation.suspended moderation.suspensionEnd moderation.suspensionReason');

    if (user && user.moderation && user.moderation.banned) {
      const banInfo = {
        banned: true,
        bannedAt: user.moderation.bannedAt,
        bannedReason: user.moderation.bannedReason,
        bannedBy: user.moderation.bannedBy,
        message: 'Your account has been permanently banned from the platform. You cannot perform any actions.',
        appealInfo: {
          canAppeal: true,
          contactEmail: 'crib@gmail.com',
          appealUrl: '/appeals/submit',
          appealDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          appealInstructions: `Your account has been permanently banned.\n\nTo appeal this decision:\n1. Send an email to: crib@gmail.com\n2. Include your wallet address: ${user.walletAddress}\n3. Include username: ${user.username}\n4. Explain why you believe this decision should be reversed\n5. Provide any supporting evidence or context\n\nYou have 30 days from the ban date to submit an appeal.\nBan Date: ${user.moderation.bannedAt?.toLocaleDateString()}\nBan Reason: ${user.moderation.bannedReason || 'Not specified'}`
        }
      };

      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_BANNED',
        message: 'Your account has been permanently banned',
        banInfo: banInfo,
        userFriendlyMessage: `Your account has been permanently banned. To appeal, email crib@gmail.com with your wallet address and username.`
      });
    }

    // Check for active suspension (temporary ban)
    if (user && user.moderation && user.moderation.suspended && user.moderation.suspensionEnd) {
      const now = new Date();
      if (now < user.moderation.suspensionEnd) {
        const timeRemaining = Math.ceil((user.moderation.suspensionEnd - now) / (1000 * 60)); // minutes
        const hoursRemaining = Math.ceil(timeRemaining / 60);

        return res.status(403).json({
          success: false,
          error: 'ACCOUNT_SUSPENDED',
          message: `Your account is temporarily suspended for ${hoursRemaining} hours`,
          restriction: {
            level: 'temp_ban',
            reason: user.moderation.suspensionReason,
            suspendedUntil: user.moderation.suspensionEnd,
            hoursRemaining: hoursRemaining
          },
          userFriendlyMessage: `Your account is temporarily suspended until ${user.moderation.suspensionEnd.toLocaleString()}. You cannot post or comment during this time.`
        });
      } else {
        // Suspension has expired, clear it
        console.log(`🟢 Suspension expired for user ${walletAddress.slice(0, 12)}...`);
        user.moderation.suspended = false;
        user.moderation.suspensionEnd = null;
        user.moderation.suspensionReason = null;
        await user.save();
      }
    }

    // Check UserViolation model for escalation restrictions
    const userRecord = await UserViolation.findOne({ userAddress: walletAddress.toLowerCase() });
    
    if (userRecord && userRecord.isRestricted()) {
      const restrictions = userRecord.restrictions;
      const now = new Date();
      
      // Check if temporary ban has expired
      if (restrictions.restrictedUntil && now > restrictions.restrictedUntil) {
        console.log(`🟢 Temporary ban expired for user ${walletAddress.slice(0, 12)}...`);
        
        // Clear the restriction
        userRecord.restrictions.restrictionLevel = 'none';
        userRecord.restrictions.canPost = true;
        userRecord.restrictions.canComment = true;
        userRecord.restrictions.restrictedUntil = null;
        userRecord.restrictions.restrictionReason = null;
        userRecord.restrictions.tempBanHours = null;
        await userRecord.save();
        
        // Allow the request to continue
        return next();
      }
      
      // Restriction is still active
      const timeRemaining = restrictions.restrictedUntil ? 
        Math.ceil((restrictions.restrictedUntil - now) / (1000 * 60)) : 0;
      
      let errorResponse = {
        success: false,
        error: 'Account restricted',
        restriction: {
          level: restrictions.restrictionLevel,
          reason: restrictions.restrictionReason,
          restrictedUntil: restrictions.restrictedUntil,
          timeRemainingMinutes: timeRemaining
        }
      };

      // Customize response based on restriction type
      switch (restrictions.restrictionLevel) {
        case 'warning':
          // Warnings don't block actions, just inform
          console.log(`⚠️ User ${walletAddress.slice(0, 12)}... has warning but can continue`);
          return next();
          
        case 'temp_ban':
          errorResponse.message = `Your account is temporarily restricted from ${getActionType(req)} due to community guideline violations.`;
          errorResponse.restriction.timeRemainingHours = Math.ceil(timeRemaining / 60);
          errorResponse.restriction.actionSteps = [
            `This restriction will automatically expire in ${Math.ceil(timeRemaining / 60)} hours`,
            'You can view content but cannot post or comment during this period',
            'Please review our community guidelines during this time',
            'Further violations may result in permanent account suspension'
          ];
          break;
          
        case 'permanent_ban':
          errorResponse.message = 'Your account has been permanently restricted from the platform due to repeated community guideline violations.';
          errorResponse.restriction.actionSteps = [
            'This restriction is permanent and affects your ability to participate',
            'You violated our community guidelines regarding hate speech, harassment, or toxic behavior',
            'You may appeal this decision within 30 days',
            'Appeals are reviewed by human moderators',
            'Create a new account is not permitted and will result in IP restrictions'
          ];
          break;
          
        default:
          errorResponse.message = 'Your account is currently restricted from performing this action.';
      }

      // Add appeal information
      errorResponse.appeal = {
        canAppeal: true,
        appealDeadline: new Date(Date.now() + (restrictions.restrictionLevel === 'permanent_ban' ? 30 : 14) * 24 * 60 * 60 * 1000),
        appealInstructions: 'Submit a detailed appeal explaining why you believe this decision should be reversed. Include any evidence or context that supports your case.',
        appealEmail: 'appeals@cribsocial.com',
        appealFormUrl: '/appeals/submit'
      };

      errorResponse.canAppeal = true;
      errorResponse.supportContact = {
        email: 'support@cribsocial.com',
        guidelines: '/community-guidelines',
        faq: '/help/restrictions'
      };

      return res.status(403).json(errorResponse);
    }

    next();
  } catch (error) {
    console.error('Error checking ban/restriction status:', error);
    // Don't block the request if there's an error checking status
    next();
  }
}

/**
 * Helper function to determine what action the user is trying to perform
 */
function getActionType(req) {
  const path = req.path.toLowerCase();
  const method = req.method.toLowerCase();
  
  if (path.includes('/posts') && method === 'post') return 'post';
  if (path.includes('/comments') && method === 'post') return 'comment';
  if (path.includes('/like') && method === 'post') return 'like';
  if (path.includes('/follow') && method === 'post') return 'follow';
  if (path.includes('/vote') && method === 'post') return 'vote';
  
  return 'post'; // Default
}

/**
 * Check if user is banned (lighter version for read-only operations)
 * Updated to check both User and UserViolation models
 */
async function checkBanStatus(req, res, next) {
  try {
    const walletAddress = req.user?.address ||
                         req.headers['x-wallet-address'] ||
                         req.headers['x-user-address'] ||
                         req.body.walletAddress ||
                         req.body.userAddress ||
                         req.body.authorAddress ||
                         req.body.author ||
                         req.query.walletAddress ||
                         req.query.userAddress;

    if (!walletAddress) {
      return next();
    }

    // Check User model for permanent bans
    const user = await User.findOne({
      walletAddress: walletAddress.toLowerCase()
    }).select('moderation.banned');

    // Check UserViolation model for active restrictions
    const userRecord = await UserViolation.findOne({ userAddress: walletAddress.toLowerCase() });
    
    // Check if user is restricted (either permanent ban or active restriction)
    const isPermanentlyBanned = user && user.moderation && user.moderation.banned;
    const hasActiveRestriction = userRecord && userRecord.isRestricted() && 
      (!userRecord.restrictions.restrictedUntil || new Date() < userRecord.restrictions.restrictedUntil);

    // Add ban/restriction status to request for other middleware/routes to use
    req.userBanned = isPermanentlyBanned;
    req.userRestricted = hasActiveRestriction;
    req.restrictionLevel = userRecord?.restrictions?.restrictionLevel || 'none';
    
    next();
  } catch (error) {
    console.error('Error checking ban/restriction status:', error);
    req.userBanned = false;
    req.userRestricted = false;
    req.restrictionLevel = 'none';
    next();
  }
}

/**
 * Specific middleware for different types of actions
 */

// Prevent banned users from creating content
const preventContentCreation = (req, res, next) => {
  if (req.userBanned) {
    return res.status(403).json({
      success: false,
      error: 'BANNED_USER_ACTION',
      message: 'Banned users cannot create content'
    });
  }
  next();
};

// Prevent banned users from social interactions
const preventSocialInteraction = (req, res, next) => {
  if (req.userBanned) {
    return res.status(403).json({
      success: false,
      error: 'BANNED_USER_ACTION', 
      message: 'Banned users cannot like, comment, or share content'
    });
  }
  next();
};

// Prevent banned users from governance participation
const preventGovernanceParticipation = (req, res, next) => {
  if (req.userBanned) {
    return res.status(403).json({
      success: false,
      error: 'BANNED_USER_ACTION',
      message: 'Banned users cannot participate in governance activities'
    });
  }
  next();
};

// Allow only read operations for banned users
const allowReadOnly = (req, res, next) => {
  // This middleware allows the request to continue
  // Used for GET operations that banned users should still be able to do
  next();
};

module.exports = {
  enforceBanRestrictions,
  checkBanStatus,
  preventContentCreation,
  preventSocialInteraction,
  preventGovernanceParticipation,
  allowReadOnly
};