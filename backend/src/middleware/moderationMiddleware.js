const UserViolation = require('../models/UserViolation');

/**
 * Middleware to check if a user is restricted from posting or commenting
 */
const checkUserRestrictions = (actionType = 'both') => {
  return async (req, res, next) => {
    try {
      const userAddress = req.user?.address || req.body.authorAddress || req.body.author || req.headers['x-user-address'];
      
      if (!userAddress) {
        return res.status(400).json({
          success: false,
          error: 'User address is required'
        });
      }

      // Get user violation record
      const userRecord = await UserViolation.findOne({ userAddress });
      
      // If no record exists, user is clean - allow action
      if (!userRecord) {
        req.userViolationRecord = null;
        next();
        return;
      }
      
      if (userRecord && userRecord.isRestricted()) {
        const restrictionDetails = userRecord.restrictions;
        
        // Check specific action restrictions
        let canPerform = true;
        let actionName = '';
        
        if (actionType === 'post' || actionType === 'both') {
          if (!restrictionDetails.canPost) {
            canPerform = false;
            actionName = 'post';
          }
        }
        
        if (actionType === 'comment' || actionType === 'both') {
          if (!restrictionDetails.canComment) {
            canPerform = false;
            actionName = actionName ? 'post or comment' : 'comment';
          }
        }
        
        if (!canPerform) {
          const timeRemaining = Math.ceil(
            (new Date(restrictionDetails.restrictedUntil) - new Date()) / (1000 * 60)
          );
          
          // Enhanced user-friendly messages based on restriction level
          let userMessage = '';
          let actionSteps = [];
          let appealInfo = {};
          
          switch (restrictionDetails.restrictionLevel) {
            case 'warning':
              userMessage = `Warning: Your account has been flagged for violating community guidelines. This is a formal warning.`;
              actionSteps = [
                'Review our community guidelines',
                'Future violations may result in restrictions',
                'Contact support if you believe this was an error'
              ];
              break;
              
            case 'temp_restriction':
              const hours = Math.ceil(timeRemaining / 60);
              userMessage = `Your account is temporarily restricted from ${actionName} for ${hours} hour(s) due to community guideline violations.`;
              actionSteps = [
                `You can ${actionName} again in ${hours} hour(s)`,
                'Review our community guidelines during this time',
                'Future violations may result in permanent restrictions',
                'You can appeal this decision if you believe it was made in error'
              ];
              appealInfo = {
                canAppeal: true,
                appealDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days to appeal
                appealInstructions: 'Submit an appeal with your reason and any evidence'
              };
              break;
              
            case 'permanent_ban':
              userMessage = `Your account has been permanently restricted from ${actionName} due to severe or repeated community guideline violations.`;
              actionSteps = [
                'This restriction is permanent and affects your ability to participate',
                'You violated our community guidelines regarding hate speech, harassment, or toxic behavior',
                'You may appeal this decision within 30 days',
                'Appeals are reviewed by human moderators',
                'Create a new account is not permitted and will result in IP restrictions'
              ];
              appealInfo = {
                canAppeal: true,
                appealDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days to appeal
                appealInstructions: 'Submit a detailed appeal explaining why you believe this decision should be reversed. Include any evidence or context that supports your case.',
                appealEmail: 'appeals@cribsocial.com',
                appealFormUrl: '/appeals/submit'
              };
              break;
              
            default:
              userMessage = `You cannot ${actionName} due to community guideline violations`;
              actionSteps = ['Contact support for more information'];
          }
          
          return res.status(403).json({
            success: false,
            error: 'Account restricted',
            message: userMessage,
            restriction: {
              level: restrictionDetails.restrictionLevel,
              reason: restrictionDetails.restrictionReason,
              restrictedUntil: restrictionDetails.restrictedUntil,
              timeRemainingMinutes: Math.max(0, timeRemaining),
              actionSteps: actionSteps,
              appeal: appealInfo
            },
            canAppeal: appealInfo.canAppeal || false,
            supportContact: {
              email: 'support@cribsocial.com',
              guidelines: '/community-guidelines',
              faq: '/help/restrictions'
            }
          });
        }
      }
      
      // Add user record to request for use in route handlers
      req.userViolationRecord = userRecord;
      next();
      
    } catch (error) {
      console.error('Error checking user restrictions:', error);
      // Don't block the request on middleware errors, just log and continue
      next();
    }
  };
};

/**
 * Middleware specifically for comment restrictions
 */
const checkCommentRestrictions = checkUserRestrictions('comment');

/**
 * Middleware specifically for post restrictions  
 */
const checkPostRestrictions = checkUserRestrictions('post');

/**
 * Helper function to process moderation results and apply consequences
 */
const processModerationViolation = async (userAddress, contentId, contentType, moderationResult, content) => {
  try {
    if (!moderationResult.flagged && moderationResult.action !== 'flag') {
      return null; // No violation
    }

    // Get or create user violation record
    const userRecord = await UserViolation.getOrCreateUserRecord(userAddress);
    
    // Determine violation type and severity
    const violationType = determineViolationType(moderationResult);
    const severity = determineSeverity(moderationResult);
    
    // Add violation to user record
    const violationData = {
      contentId,
      contentType,
      violationType,
      severity,
      aiConfidence: moderationResult.confidence,
      aiProvider: moderationResult.provider,
      aiReason: moderationResult.reason,
      violatingContent: content.substring(0, 1000), // Limit length
      actionTaken: 'warning' // Will be updated by applyConsequences
    };
    
    userRecord.addViolation(violationData);
    
    // Apply consequences based on violation history
    const consequenceLevel = userRecord.applyConsequences();
    
    // Update the violation with the actual action taken
    const latestViolation = userRecord.violations[userRecord.violations.length - 1];
    latestViolation.actionTaken = getActionFromConsequenceLevel(consequenceLevel);
    latestViolation.actionDetails = getActionDetails(consequenceLevel, userRecord.restrictions);
    
    await userRecord.save();
    
    return {
      violationAdded: true,
      consequenceLevel,
      userRecord,
      violationId: latestViolation._id,
      restrictionDetails: userRecord.restrictions
    };
    
  } catch (error) {
    console.error('Error processing moderation violation:', error);
    return null;
  }
};

/**
 * Helper functions for determining violation details
 */
function determineViolationType(moderationResult) {
  const reason = moderationResult.reason?.toLowerCase() || '';
  const details = moderationResult.details || {};
  
  if (reason.includes('hate') || reason.includes('identity')) {
    return 'hate_speech';
  } else if (reason.includes('threat') || reason.includes('kill')) {
    return 'threats';
  } else if (reason.includes('harassment') || reason.includes('stalk')) {
    return 'harassment';
  } else if (reason.includes('scam') || reason.includes('money')) {
    return 'scam';
  } else if (reason.includes('spam')) {
    return 'spam';
  } else {
    return 'toxic_language';
  }
}

function determineSeverity(moderationResult) {
  const confidence = moderationResult.confidence;
  const reason = moderationResult.reason?.toLowerCase() || '';
  
  if (confidence >= 0.9 || reason.includes('extreme') || reason.includes('kill')) {
    return 'extreme';
  } else if (confidence >= 0.8 || reason.includes('high')) {
    return 'high';
  } else if (confidence >= 0.6 || reason.includes('medium')) {
    return 'medium';
  } else {
    return 'low';
  }
}

function getActionFromConsequenceLevel(level) {
  switch (level) {
    case 'warning': return 'warning';
    case 'temp_ban': return 'temp_ban';
    case 'temp_restriction': return 'temp_restriction';
    case 'suspension': return 'suspension';
    case 'permanent_ban': return 'ban';
    default: return 'warning';
  }
}

function getActionDetails(level, restrictions) {
  switch (level) {
    case 'warning':
      return 'User warned about community guideline violations';
    case 'temp_ban':
      const tempBanHours = restrictions.tempBanHours || Math.ceil((new Date(restrictions.restrictedUntil) - new Date()) / (1000 * 60 * 60));
      return `User temporarily banned from posting/commenting for ${tempBanHours} hours`;
    case 'temp_restriction':
      const hours = Math.ceil((new Date(restrictions.restrictedUntil) - new Date()) / (1000 * 60 * 60));
      return `User restricted from posting/commenting for ${hours} hours`;
    case 'suspension':
    case 'permanent_ban':
      return 'User account suspended for severe or repeated violations';
    default:
      return 'Violation recorded';
  }
}

module.exports = {
  checkUserRestrictions,
  checkCommentRestrictions, 
  checkPostRestrictions,
  processModerationViolation
};