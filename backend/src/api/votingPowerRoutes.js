const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const votingPowerService = require('../services/votingPowerService');
const CommunityMember = require('../models/CommunityMember');

/**
 * Voting Power Management Routes
 * Handles voting power calculation and management
 */

/**
 * GET /api/voting-power/calculate/:walletAddress
 * Calculate voting power for a specific wallet address
 */
router.get('/calculate/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }
    
    // Calculate voting power
    const votingPowerData = await votingPowerService.calculateVotingPower(walletAddress);
    
    res.json({
      success: true,
      data: votingPowerData
    });
    
  } catch (error) {
    console.error('Error calculating voting power:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate voting power',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/voting-power/update
 * Update voting power for authenticated user
 */
router.post('/update', auth, async (req, res) => {
  try {
    const walletAddress = req.user.address;

    // Update voting power
    const result = await votingPowerService.updateMemberVotingPower(walletAddress);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update voting power',
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Voting power updated successfully',
      data: {
        member: result.member,
        votingPower: result.votingPower
      }
    });
    
  } catch (error) {
    console.error('Error updating voting power:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update voting power',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/voting-power/member/:walletAddress
 * Get member's current voting power from database
 */
router.get('/member/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    const member = await CommunityMember.findOne({ 
      walletAddress: walletAddress.toLowerCase() 
    }).select('governanceProfile walletAddress username');
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Community member not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        walletAddress: member.walletAddress,
        username: member.username,
        totalVotingPower: member.governanceProfile.totalVotingPower,
        powerLevel: member.governanceProfile.powerLevel,
        lastCalculation: member.governanceProfile.lastPowerCalculation,
        breakdown: member.governanceProfile.powerBreakdown,
        isEligibleToVote: member.governanceProfile.totalVotingPower >= 50
      }
    });
    
  } catch (error) {
    console.error('Error fetching member voting power:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch voting power',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/voting-power/leaderboard
 * Get voting power leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    
    const members = await CommunityMember.find({})
      .select('walletAddress username governanceProfile.totalVotingPower governanceProfile.powerLevel')
      .sort({ 'governanceProfile.totalVotingPower': -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const totalMembers = await CommunityMember.countDocuments({});
    
    const leaderboard = members.map((member, index) => ({
      rank: (parseInt(page) - 1) * parseInt(limit) + index + 1,
      walletAddress: member.walletAddress,
      username: member.username,
      totalVotingPower: member.governanceProfile.totalVotingPower,
      powerLevel: member.governanceProfile.powerLevel
    }));
    
    res.json({
      success: true,
      data: {
        leaderboard,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalMembers / parseInt(limit)),
          limit: parseInt(limit),
          totalMembers
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/voting-power/batch-update
 * Batch update voting power for multiple addresses (admin only)
 */
router.post('/batch-update', auth, async (req, res) => {
  try {
    const { walletAddresses, adminKey } = req.body;
    
    // Simple admin check (replace with proper admin auth in production)
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    if (!Array.isArray(walletAddresses) || walletAddresses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Wallet addresses array is required'
      });
    }
    
    // Limit batch size to prevent overload
    const limitedAddresses = walletAddresses.slice(0, 20);
    
    const results = await votingPowerService.batchUpdateVotingPower(limitedAddresses);
    
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
    
    res.json({
      success: true,
      message: `Batch update completed: ${summary.successful}/${summary.total} successful`,
      data: {
        summary,
        results: results.slice(0, 10) // Limit response size
      }
    });
    
  } catch (error) {
    console.error('Error in batch update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to batch update voting power',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/voting-power/stats
 * Get overall voting power statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await CommunityMember.aggregate([
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          averagePower: { $avg: '$governanceProfile.totalVotingPower' },
          totalPower: { $sum: '$governanceProfile.totalVotingPower' },
          minPower: { $min: '$governanceProfile.totalVotingPower' },
          maxPower: { $max: '$governanceProfile.totalVotingPower' }
        }
      },
      {
        $project: {
          _id: 0,
          totalMembers: 1,
          averagePower: { $round: ['$averagePower', 2] },
          totalPower: 1,
          minPower: 1,
          maxPower: 1
        }
      }
    ]);
    
    // Get power level distribution
    const powerLevelDistribution = await CommunityMember.aggregate([
      {
        $group: {
          _id: '$governanceProfile.powerLevel',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalMembers: 0,
          averagePower: 0,
          totalPower: 0,
          minPower: 0,
          maxPower: 0
        },
        powerLevelDistribution,
        votingPowerConfig: votingPowerService.VOTING_POWER_CONFIG
      }
    });
    
  } catch (error) {
    console.error('Error fetching voting power stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/voting-power/eligibility/:walletAddress
 * Check voting eligibility for specific governance actions
 */
router.get('/eligibility/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const { action = 'vote' } = req.query;
    
    const member = await CommunityMember.findOne({ 
      walletAddress: walletAddress.toLowerCase() 
    }).select('governanceProfile');
    
    if (!member) {
      return res.json({
        success: true,
        data: {
          isEligible: false,
          reason: 'Member not found',
          minimumRequired: 50,
          currentPower: 0
        }
      });
    }
    
    const currentPower = member.governanceProfile.totalVotingPower;
    
    // Define minimum power requirements for different actions
    const powerRequirements = {
      vote: 50,           // Basic voting
      propose: 100,       // Creating proposals
      moderate: 200,      // Moderation actions
      adminVote: 500      // Administrative voting
    };
    
    const requiredPower = powerRequirements[action] || powerRequirements.vote;
    const isEligible = currentPower >= requiredPower;
    
    res.json({
      success: true,
      data: {
        isEligible,
        reason: isEligible ? 'Eligible' : `Insufficient voting power for ${action}`,
        minimumRequired: requiredPower,
        currentPower,
        powerLevel: member.governanceProfile.powerLevel,
        powerDeficit: isEligible ? 0 : requiredPower - currentPower
      }
    });
    
  } catch (error) {
    console.error('Error checking eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check eligibility',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;