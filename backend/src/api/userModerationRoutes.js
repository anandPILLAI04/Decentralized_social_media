const express = require("express");
const router = express.Router();
const { auth } = require('../middleware/auth');
const UserViolation = require("../models/UserViolation");

/**
 * GET /api/moderation/user/:address
 * Get user violation history and current restrictions
 */
router.get("/user/:address", async (req, res) => {
  try {
    const { address } = req.params;
    
    const userRecord = await UserViolation.findOne({ userAddress: address });
    
    if (!userRecord) {
      return res.json({
        success: true,
        user: {
          userAddress: address,
          reputation: 100,
          violations: [],
          restrictions: {
            canPost: true,
            canComment: true,
            restrictionLevel: 'none'
          },
          isRestricted: false
        }
      });
    }
    
    res.json({
      success: true,
      user: {
        userAddress: userRecord.userAddress,
        reputation: userRecord.reputation,
        violations: userRecord.violations.map(v => ({
          id: v._id,
          type: v.violationType,
          severity: v.severity,
          content: v.violatingContent.substring(0, 100) + '...',
          date: v.detectedAt,
          action: v.actionTaken,
          status: v.status
        })),
        restrictions: userRecord.restrictions,
        stats: userRecord.stats,
        isRestricted: userRecord.isRestricted()
      }
    });
    
  } catch (error) {
    console.error('Error fetching user moderation data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/moderation/appeal/:violationId
 * Submit an appeal for a violation
 */
router.post("/appeal/:violationId", auth, async (req, res) => {
  try {
    const { violationId } = req.params;
    const userAddress = req.user.address;
    const { reason } = req.body;
    
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Appeal reason is required'
      });
    }
    
    const userRecord = await UserViolation.findOne({ userAddress });
    if (!userRecord) {
      return res.status(404).json({
        success: false,
        error: 'User record not found'
      });
    }
    
    const violation = userRecord.violations.id(violationId);
    if (!violation) {
      return res.status(404).json({
        success: false,
        error: 'Violation not found'
      });
    }
    
    // Add appeal
    userRecord.appeals.push({
      violationId: violationId,
      reason: reason.trim()
    });
    
    await userRecord.save();
    
    res.json({
      success: true,
      message: 'Appeal submitted successfully',
      appealId: userRecord.appeals[userRecord.appeals.length - 1]._id
    });
    
  } catch (error) {
    console.error('Error submitting appeal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/moderation/stats
 * Get overall moderation statistics
 */
router.get("/stats", async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const stats = await UserViolation.getModerationStats(parseInt(days));
    const restrictedUsers = await UserViolation.getRestrictedUsers();
    
    // Calculate totals
    const totalViolations = stats.reduce((sum, stat) => sum + stat.count, 0);
    const avgConfidence = stats.length > 0 ? 
      stats.reduce((sum, stat) => sum + (stat.avgConfidence * stat.count), 0) / totalViolations : 0;
    
    res.json({
      success: true,
      stats: {
        timeframe: `${days} days`,
        totalViolations,
        avgConfidence: avgConfidence.toFixed(3),
        violationsByType: stats,
        currentlyRestricted: restrictedUsers.length,
        restrictedUsers: restrictedUsers.map(u => ({
          address: u.userAddress,
          username: u.username,
          level: u.restrictions.restrictionLevel,
          until: u.restrictions.restrictedUntil
        }))
      }
    });
    
  } catch (error) {
    console.error('Error fetching moderation stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;