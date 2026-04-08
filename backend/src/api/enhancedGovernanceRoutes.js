const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GovernanceCase = require('../models/GovernanceCase');
const CommunityVote = require('../models/CommunityVote');
const CommunityMember = require('../models/CommunityMember');
const Evidence = require('../models/Evidence');
const User = require('../models/User');
const governanceNotificationService = require('../services/governanceNotificationService');
const caseExecutionService = require('../services/caseExecutionService');
const { preventGovernanceParticipation, enforceBanRestrictions } = require('../middleware/banEnforcement');
const {
  createEvidenceRecord,
  bulkCreateEvidence,
  getEvidenceByCase,
  validateEvidenceFile
} = require('../services/evidenceService');

/**
 * Enhanced Governance API Routes
 * Comprehensive endpoints for community-driven governance
 */

// Middleware for wallet verification
const verifyWallet = (req, res, next) => {
  const walletAddress = req.headers['x-wallet-address'] || req.body.walletAddress;
  
  if (!walletAddress) {
    return res.status(401).json({
      success: false,
      message: 'Wallet address required'
    });
  }
  
  req.walletAddress = walletAddress.toLowerCase();
  next();
};

// Middleware to get or create community member profile
const ensureCommunityMember = async (req, res, next) => {
  try {
    let member = await CommunityMember.findOne({ walletAddress: req.walletAddress });
    
    if (!member) {
      // Create new community member profile
      const user = await User.findOne({ walletAddress: req.walletAddress });
      
      member = new CommunityMember({
        user: user?._id || null,  // Allow null if user doesn't exist yet
        walletAddress: req.walletAddress,
        username: user?.username || user?.name || `User_${req.walletAddress.slice(-6)}`
      });
      
      await member.save();
      console.log('Created new community member:', member.walletAddress);
    }
    
    req.communityMember = member;
    next();
  } catch (error) {
    console.error('Error ensuring community member:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify community membership',
      error: error.message
    });
  }
};

/**
 * GET /api/governance/cases
 * Get all governance cases with filtering and pagination
 */
router.get('/cases', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 5,
      type = null,
      status = null,
      urgency = null,
      sortBy = 'createdAt',
      order = 'desc',
      search = ''
    } = req.query;
    
    const walletAddress = req.headers['x-wallet-address'];
    
    // Build query
    const query = {};
    
    if (type) query.type = type;
    if (status) query.status = status;
    if (urgency) query.urgency = urgency;
    
    // Search in title and description
    if (search.trim()) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = order === 'desc' ? -1 : 1;
    
    // Execute query
    const cases = await GovernanceCase.find(query)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('reporter', 'username walletAddress avatar')
      .populate({
        path: 'evidence',
        select: 'evidenceType fileName category verified',
        options: { limit: 3 } // Only show first 3 evidence items
      });
    
    // If user wallet is provided, check which cases they've voted on
    let userVotedCaseIds = [];
    if (walletAddress) {
      const userVotes = await CommunityVote.find({
        voterAddress: walletAddress.toLowerCase()
      });
      userVotedCaseIds = userVotes.map(vote => vote.governanceCase.toString());
      console.log(`🗳️ Found ${userVotedCaseIds.length} voted cases for ${walletAddress}`);
    }

    // Add hasUserVoted flag to each case
    const casesWithVoteInfo = cases.map(case_ => {
      const caseObj = case_.toObject();
      caseObj.hasUserVoted = userVotedCaseIds.includes(case_._id.toString());
      return caseObj;
    });
    
    const totalCases = await GovernanceCase.countDocuments(query);
    
    // Get statistics
    const stats = await GovernanceCase.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      cases: casesWithVoteInfo,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCases,
        pages: Math.ceil(totalCases / parseInt(limit))
      },
      stats: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    });
    
  } catch (error) {
    console.error('Error fetching governance cases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch governance cases',
      error: error.message
    });
  }
});

/**
 * GET /api/governance/cases/:caseId
 * Get specific governance case with full details
 */
router.get('/cases/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const walletAddress = req.headers['x-wallet-address'];
    
    const governanceCase = await GovernanceCase.findById(caseId)
      .populate('reporter', 'username walletAddress avatar')
      .populate({
        path: 'evidence',
        populate: {
          path: 'submittedBy',
          select: 'username walletAddress'
        }
      })
      .populate('reviewedBy.reviewer', 'username');
    
    if (!governanceCase) {
      return res.status(404).json({
        success: false,
        message: 'Governance case not found'
      });
    }
    
    // Check if user has voted
    let userVote = null;
    if (walletAddress) {
      userVote = await CommunityVote.findOne({
        governanceCase: caseId,
        voterAddress: walletAddress.toLowerCase()
      });
    }
    
    // Get voting statistics
    const voteStats = await CommunityVote.aggregate([
      { $match: { governanceCase: new mongoose.Types.ObjectId(caseId) } },
      {
        $group: {
          _id: '$decision',
          count: { $sum: 1 },
          totalWeight: { $sum: '$votingPower.total' }
        }
      }
    ]);
    
    // Increment view count
    governanceCase.metrics.views += 1;
    await governanceCase.save();
    
    res.json({
      success: true,
      case: governanceCase,
      userVote: userVote,
      voteStats: voteStats,
      canVote: governanceCase.canVote(),
      canExecute: governanceCase.canExecute()
    });
    
  } catch (error) {
    console.error('Error fetching governance case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch governance case',
      error: error.message
    });
  }
});

/**
 * GET /api/enhanced-governance/cases/:caseId/votes
 * Get all votes for a specific governance case
 */
router.get('/cases/:caseId/votes', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    // Validate case exists
    const governanceCase = await GovernanceCase.findById(caseId);
    if (!governanceCase) {
      return res.status(404).json({
        success: false,
        message: 'Governance case not found'
      });
    }
    
    // Get all votes for this case
    const votes = await CommunityVote.find({ governanceCase: caseId })
      .populate('voter', 'username walletAddress avatar')
      .sort({ createdAt: -1 });
    
    // Calculate voting summary
    const summary = votes.reduce((acc, vote) => {
      const decision = vote.decision || vote.vote;
      if (!acc[decision]) {
        acc[decision] = {
          count: 0,
          totalWeight: 0,
          voters: []
        };
      }
      acc[decision].count += 1;
      acc[decision].totalWeight += vote.votingPower?.total || 1;
      acc[decision].voters.push({
        address: vote.voterAddress,
        username: vote.voter?.username || 'Anonymous',
        weight: vote.votingPower?.total || 1
      });
      return acc;
    }, {});
    
    res.json({
      success: true,
      votes: votes.map(vote => ({
        _id: vote._id,
        vote: vote.decision || vote.vote,
        voterAddress: vote.voterAddress,
        voter: vote.voter,
        reason: vote.reason,
        votingPower: vote.votingPower?.total || 1,
        createdAt: vote.createdAt
      })),
      summary: summary,
      totalVotes: votes.length
    });
    
  } catch (error) {
    console.error('Error fetching case votes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch case votes',
      error: error.message
    });
  }
});

/**
 * POST /api/governance/cases
 * Create new governance case
 */
router.post('/cases', enforceBanRestrictions, verifyWallet, ensureCommunityMember, async (req, res) => {
  try {
    const {
      type,
      title,
      description,
      urgency = 'NORMAL',
      caseData = {},
      evidence = [],
      tags = []
    } = req.body;

    // Validate required fields
    if (!type || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Type, title, and description are required'
      });
    }

    // Validate case type
    const validTypes = ['CONTENT_REPORT', 'USER_REPORT', 'GUIDELINE_UPDATE', 'FEATURE_REQUEST', 'AI_OVERRIDE'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid case type'
      });
    }

    // For USER_REPORT or content reports, validate requested action
    if (type === 'USER_REPORT' && !caseData?.suggestedAction) {
      return res.status(400).json({
        success: false,
        message: 'suggestedAction is required for USER_REPORT (WARNING, DELETE_POST, TEMP_BAN_48H, PERMANENT_BAN)'
      });
    }

    // For CONTENT_REPORT, also require suggestedAction to know what to do when approved
    if (type === 'CONTENT_REPORT' && !caseData?.suggestedAction) {
      return res.status(400).json({
        success: false,
        message: 'suggestedAction is required for CONTENT_REPORT (WARNING, DELETE_POST, TEMP_BAN_48H, PERMANENT_BAN)'
      });
    }

    // Get eligible voters (all active community members)
    // Get eligible voters - EXCLUDE BANNED USERS
    const User = require('../models/User');
    const CommunityMember = require('../models/CommunityMember');

    // Get all active community members
    const allMembers = await CommunityMember.find({
      'status.active': true
    }).select('walletAddress').lean();

    // Filter out banned AND suspended users
    const eligibleVotersList = [];
    for (const member of allMembers) {
      const user = await User.findOne({ walletAddress: member.walletAddress.toLowerCase() });
      // Only include if user is NOT banned AND NOT suspended
      if (!user || (!user.moderation?.banned && !user.moderation?.suspended)) {
        eligibleVotersList.push({
          walletAddress: member.walletAddress.toLowerCase(),
          hasVoted: false,
          votedAt: null
        });
      } else {
        console.log(`⏭️  Excluding ineligible user from eligible voters: ${member.walletAddress} (banned: ${user?.moderation?.banned}, suspended: ${user?.moderation?.suspended})`);
      }
    }

    // Create governance case with ACTIVE_VOTING status (automatic start)
    const startTime = new Date();
    const votingDurationMinutes = 5; // ⏱️ TESTING: Changed to 5 minutes
    const governanceCase = new GovernanceCase({
      type: type,
      title: title,
      description: description,
      reporter: req.communityMember.user || null,
      reporterAddress: req.walletAddress.toLowerCase(),
      urgency: urgency,
      caseData: caseData,
      tags: tags,

      // Automatically start voting immediately (5 minutes for testing)
      status: 'ACTIVE_VOTING',
      votingStartTime: startTime,
      votingEndTime: new Date(startTime.getTime() + votingDurationMinutes * 60 * 1000), // 5 minutes from now
      votingPeriod: votingDurationMinutes, // Testing: 5 minutes instead of 48 hours

      // Track eligible voters
      eligibleVoters: eligibleVotersList,
      totalEligibleVoters: eligibleVotersList.length,
      votedCount: 0
    });

    await governanceCase.save();

    console.log(`📋 NEW GOVERNANCE CASE CREATED (Auto-Voting Started)`);
    console.log(`   Case ID: ${governanceCase._id}`);
    console.log(`   Type: ${type}`);
    console.log(`   Reporter: ${req.walletAddress}`);
    console.log(`   Voting Start: ${startTime}`);
    console.log(`   Voting End: ${governanceCase.votingEndTime}`);
    console.log(`   ⏱️  TESTING MODE: Voting period = ${votingDurationMinutes} minutes`);
    console.log(`   Eligible Voters: ${eligibleVotersList.length}`);
    console.log(`   ✅ Voting automatically activated`);
    console.log(`   Ends: ${votingDurationMinutes} minutes OR when all ${eligibleVotersList.length} users vote`);
    // Process evidence if provided
    let evidenceResults = null;
    if (evidence && evidence.length > 0) {
      try {
        evidenceResults = await bulkCreateEvidence(
          evidence,
          governanceCase._id,
          req.communityMember._id
        );

        // Update case with evidence references
        governanceCase.evidence = evidenceResults.evidence.map(e => e._id);
        await governanceCase.save();
      } catch (evidenceError) {
        console.error('Error processing evidence:', evidenceError);
      }
    }

    // Update community member stats
    req.communityMember.governanceProfile.totalProposals += 1;
    req.communityMember.participationHistory.lastVote = new Date();
    await req.communityMember.save();

    // Send case creation notifications
    try {
      await governanceNotificationService.notifyCaseCreated(governanceCase);
      console.log(`📢 Case creation notifications sent for: ${governanceCase._id}`);
    } catch (notificationError) {
      console.error('⚠️  Failed to send case creation notifications:', notificationError);
    }

    res.status(201).json({
      success: true,
      message: 'Governance case created and voting automatically started for 5 minutes (testing)',
      case: governanceCase,
      votingInfo: {
        status: 'ACTIVE_VOTING',
        startTime: governanceCase.votingStartTime,
        endTime: governanceCase.votingEndTime,
        durationMinutes: 5,
        durationDisplay: '5 minutes (testing mode)',
        eligibleVoters: eligibleVotersList.length,
        mechanism: 'Voting ends after 5 minutes OR when all eligible voters have voted, whichever is earlier'
      },
      evidence: evidenceResults
    });

  } catch (error) {
    console.error('❌ Error creating governance case:', error.message);
    console.error(error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to create governance case',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /api/governance/cases/:caseId/vote
 * Submit vote on governance case
 */
router.post('/cases/:caseId/vote', enforceBanRestrictions, verifyWallet, ensureCommunityMember, async (req, res) => {
  try {
    const { caseId } = req.params;
    const {
      decision,
      confidence = 3,
      reasoning,
      category = 'OTHER',
      supportingEvidence = [],
      conditions = []
    } = req.body;

    // Validate decision
    const validDecisions = ['APPROVE', 'REJECT'];
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vote decision. Must be APPROVE or REJECT'
      });
    }

    // Validate confidence level
    if (confidence < 1 || confidence > 5) {
      return res.status(400).json({
        success: false,
        message: 'Confidence must be between 1 and 5'
      });
    }

    // Get governance case
    const governanceCase = await GovernanceCase.findById(caseId);
    if (!governanceCase) {
      return res.status(404).json({
        success: false,
        message: 'Governance case not found'
      });
    }

    // Check if voting is allowed (must be in ACTIVE_VOTING status and before end time)
    if (governanceCase.status !== 'ACTIVE_VOTING') {
      return res.status(400).json({
        success: false,
        message: `Voting is not allowed. Case status: ${governanceCase.status}`
      });
    }

    // Double-check: Ensure voter is in eligible voters list
    const isEligible = governanceCase.eligibleVoters.some(v =>
      v.walletAddress.toLowerCase() === req.walletAddress.toLowerCase()
    );

    if (!isEligible) {
      return res.status(403).json({
        success: false,
        message: 'You are not eligible to vote on this case',
        userFriendlyMessage: 'You are either banned or not a community member. To appeal a ban, contact crib@gmail.com',
        error: 'NOT_ELIGIBLE_VOTER'
      });
    }

    if (new Date() > governanceCase.votingEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Voting period has ended for this case'
      });
    }

    // Check if user can vote on this case
    if (!req.communityMember.canVoteOnCase(governanceCase)) {
      return res.status(403).json({
        success: false,
        message: 'You are not eligible to vote on this case'
      });
    }

    // Check if user already voted
    const existingVote = await CommunityVote.findOne({
      governanceCase: caseId,
      voterAddress: req.walletAddress.toLowerCase()
    });

    if (existingVote) {
      return res.status(400).json({
        success: false,
        message: 'You have already voted on this case'
      });
    }

    // Calculate voting power
    const votingPower = req.communityMember.calculateVotingPower();

    // Generate unique vote ID
    const voteId = `vote_${Date.now()}_${req.walletAddress.slice(-8)}`;

    // Create vote
    const vote = new CommunityVote({
      voteId: voteId,
      governanceCase: caseId,
      caseId: governanceCase.caseId,
      voter: req.communityMember.user || req.communityMember._id,
      voterAddress: req.walletAddress.toLowerCase(),
      voterUsername: req.communityMember.username,
      decision: decision,
      confidence: confidence,
      reasoning: reasoning,
      category: category,
      supportingEvidence: supportingEvidence,
      conditions: conditions,
      votingPower: {
        base: 1,
        reputation: req.communityMember.governanceProfile?.reputationBonus || 0,
        stake: req.communityMember.governanceProfile?.stakeBonus || 0,
        expertise: req.communityMember.governanceProfile?.expertiseBonus || 0,
        total: votingPower
      }
    });

    await vote.save();

    // Update governance case vote counts
    let voteField;
    switch (decision) {
      case 'APPROVE':
        voteField = 'approve';
        break;
      case 'REJECT':
        voteField = 'reject';
        break;
      default:
        voteField = 'approve';
    }

    // Initialize vote counts if they don't exist
    if (!governanceCase.votes) {
      governanceCase.votes = { approve: 0, reject: 0, partial: 0, needMoreEvidence: 0 };
    }

    // Increment the appropriate vote count
    if (governanceCase.votes[voteField] !== undefined) {
      governanceCase.votes[voteField] += 1;
    } else {
      governanceCase.votes.needMoreEvidence = governanceCase.votes.needMoreEvidence || 0;
      governanceCase.votes[voteField] = 1;
    }

    governanceCase.totalVotes += 1;
    governanceCase.totalVotingWeight += votingPower;

    // Track voter in eligibleVoters
    const voterIndex = governanceCase.eligibleVoters.findIndex(
      v => v.walletAddress.toLowerCase() === req.walletAddress.toLowerCase()
    );

    if (voterIndex !== -1) {
      governanceCase.eligibleVoters[voterIndex].hasVoted = true;
      governanceCase.eligibleVoters[voterIndex].votedAt = new Date();
    }

    governanceCase.votedCount = governanceCase.eligibleVoters.filter(v => v.hasVoted).length;

    console.log(`🗳️  Vote recorded for case ${caseId}`);
    console.log(`   Voter: ${req.walletAddress}`);
    console.log(`   Decision: ${decision}`);
    console.log(`   Total votes: ${governanceCase.totalVotes}/${governanceCase.totalEligibleVoters}`);
    console.log(`   Votes received: ${governanceCase.votedCount}/${governanceCase.totalEligibleVoters}`);

    // Check if all eligible voters have voted
    const allVotedEarly = governanceCase.votedCount >= governanceCase.totalEligibleVoters;

    if (allVotedEarly) {
      console.log(`✅ ALL ELIGIBLE VOTERS HAVE VOTED - ENDING VOTING PERIOD EARLY`);

      // End voting and determine result
      governanceCase.status = 'VOTING_ENDED';

      // Calculate if approved or rejected
      const approveVotes = governanceCase.votes.approve;
      const rejectVotes = governanceCase.votes.reject;

      const resultStatus = approveVotes > rejectVotes ? 'APPROVED' : 'REJECTED';
      governanceCase.status = resultStatus;

      console.log(`   Approve votes: ${approveVotes}`);
      console.log(`   Reject votes: ${rejectVotes}`);
      console.log(`   Final Status: ${resultStatus}`);
    }

    await governanceCase.save();

    // ⚡ IMMEDIATE EXECUTION: If case is approved, execute it right away (don't wait for scheduler)
    if (governanceCase.status === 'APPROVED') {
      console.log(`⚡ Case APPROVED - Triggering IMMEDIATE execution (not waiting for scheduler)`);
      try {
        const executionResult = await caseExecutionService.executeGovernanceCase(
          governanceCase._id,
          'APPROVED',
          'IMMEDIATE_ON_APPROVAL'
        );
        console.log(`✅ Immediate execution completed:`, executionResult.message);
      } catch (executionError) {
        console.error(`❌ Error during immediate execution:`, executionError);
        // Don't fail the vote - execution can be retried by scheduler
      }
    }

    // Update community member voting stats
    req.communityMember.recordVote({
      caseType: governanceCase.type,
      decision: decision
    });
    await req.communityMember.save();

    res.json({
      success: true,
      message: allVotedEarly
        ? 'Vote submitted. All voters have voted - voting ended early!'
        : 'Vote submitted successfully',
      vote: vote,
      caseStats: {
        totalVotes: governanceCase.totalVotes,
        eligibleVoters: governanceCase.totalEligibleVoters,
        votesReceived: governanceCase.votedCount,
        allVotedEarly: allVotedEarly,
        votes: governanceCase.votes,
        votingEndTime: governanceCase.votingEndTime,
        caseStatus: governanceCase.status
      }
    });

  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit vote',
      error: error.message
    });
  }
});

/**
 * GET /api/governance/cases/:caseId/votes
 * Get all votes for a governance case
 */
router.get('/cases/:caseId/votes', async (req, res) => {
  try {
    const { caseId } = req.params;
    const {
      page = 1,
      limit = 20,
      decision = null,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;
    
    const query = { governanceCase: caseId };
    if (decision) query.decision = decision;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = order === 'desc' ? -1 : 1;
    
    const votes = await CommunityVote.find(query)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('voter', 'username walletAddress')
      .select('-voter'); // Hide voter info for privacy if needed
    
    const totalVotes = await CommunityVote.countDocuments(query);
    
    res.json({
      success: true,
      votes: votes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalVotes,
        pages: Math.ceil(totalVotes / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Error fetching votes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch votes',
      error: error.message
    });
  }
});

/**
 * POST /api/governance/cases/:caseId/evidence
 * Add evidence to governance case
 */
router.post('/cases/:caseId/evidence', enforceBanRestrictions, verifyWallet, ensureCommunityMember, async (req, res) => {
  try {
    const { caseId } = req.params;
    const evidenceList = req.body.evidence || [req.body];
    
    // Verify governance case exists
    const governanceCase = await GovernanceCase.findById(caseId);
    if (!governanceCase) {
      return res.status(404).json({
        success: false,
        message: 'Governance case not found'
      });
    }
    
    // Process evidence
    const results = await bulkCreateEvidence(
      evidenceList,
      caseId,
      req.communityMember._id
    );
    
    // Update case with new evidence
    const newEvidenceIds = results.evidence.map(e => e._id);
    governanceCase.evidence.push(...newEvidenceIds);
    await governanceCase.save();
    
    res.json({
      success: true,
      message: 'Evidence added successfully',
      evidence: results.evidence,
      errors: results.errors
    });
    
  } catch (error) {
    console.error('Error adding evidence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add evidence',
      error: error.message
    });
  }
});

/**
 * GET /api/governance/cases/:caseId/evidence
 * Get evidence for governance case
 */
router.get('/cases/:caseId/evidence', async (req, res) => {
  try {
    const { caseId } = req.params;
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      evidenceType: req.query.type,
      verified: req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : null
    };
    
    const result = await getEvidenceByCase(caseId, options);
    res.json(result);
    
  } catch (error) {
    console.error('Error fetching evidence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch evidence',
      error: error.message
    });
  }
});

/**
 * PUT /api/governance/cases/:caseId/status
 * Update governance case status (admin/moderator only)
 */
router.put('/cases/:caseId/status', verifyWallet, ensureCommunityMember, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { status, reason } = req.body;
    
    // Check if user has moderator privileges
    if (req.communityMember.governanceProfile.trustLevel !== 'MODERATOR') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient privileges to update case status'
      });
    }
    
    const validStatuses = ['PENDING_REVIEW', 'ACTIVE_VOTING', 'VOTING_ENDED', 'EXECUTED', 'REJECTED', 'APPEALED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    const governanceCase = await GovernanceCase.findById(caseId);
    if (!governanceCase) {
      return res.status(404).json({
        success: false,
        message: 'Governance case not found'
      });
    }
    
    const oldStatus = governanceCase.status;
    governanceCase.status = status;
    
    // Add to review history
    governanceCase.reviewedBy.push({
      reviewer: req.communityMember._id,
      reviewType: 'MODERATOR_ACTION',
      decision: `Status changed from ${oldStatus} to ${status}`,
      reasoning: reason,
      reviewedAt: new Date()
    });
    
    await governanceCase.save();
    
    res.json({
      success: true,
      message: 'Case status updated successfully',
      case: governanceCase
    });
    
  } catch (error) {
    console.error('Error updating case status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update case status',
      error: error.message
    });
  }
});

/**
 * GET /api/governance/dashboard
 * Get governance dashboard statistics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const walletAddress = req.headers['x-wallet-address'];
    
    // Get overall statistics
    const totalCases = await GovernanceCase.countDocuments();
    const activeCases = await GovernanceCase.countDocuments({ status: 'ACTIVE_VOTING' });
    const pendingCases = await GovernanceCase.countDocuments({ status: 'PENDING_REVIEW' });
    const executedCases = await GovernanceCase.countDocuments({ status: 'EXECUTED' });
    
    // Get user's participation stats
    const member = await CommunityMember.findOne({ walletAddress: walletAddress });
    const userVotes = member ? await CommunityVote.countDocuments({ voter: member._id }) : 0;
    const userProposals = member ? await GovernanceCase.countDocuments({ reporterAddress: walletAddress }) : 0;
    
    // Get recent cases
    const recentCases = await GovernanceCase.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('reporter', 'username')
      .select('title type status urgency createdAt votes totalVotes');
    
    // Get cases where user can vote
    const votableCases = await GovernanceCase.find({
      status: 'ACTIVE_VOTING',
      votingEndTime: { $gt: new Date() }
    }).limit(10).select('title type urgency votingEndTime');
    
    // Filter out cases user already voted on
    const userVotesCaseIds = member ? await CommunityVote.find({ voter: member._id }).distinct('governanceCase') : [];
    const availableToVote = votableCases.filter(c => !userVotesCaseIds.includes(c._id.toString()));
    
    res.json({
      success: true,
      dashboard: {
        stats: {
          totalCases,
          activeCases,
          pendingCases,
          executedCases,
          userVotes,
          userProposals
        },
        recentCases,
        availableToVote,
        userMembership: member ? {
          trustLevel: member.governanceProfile.trustLevel,
          reputationScore: member.governanceProfile.reputationScore,
          totalVotingPower: member.governanceProfile.totalVotingPower,
          participationScore: member.governanceProfile.participationScore
        } : null
      }
    });
    
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

/**
 * POST /api/governance/cases/:caseId/activate-voting
 * Manually activate voting for a governance case
 */
router.post('/cases/:caseId/activate-voting', enforceBanRestrictions, verifyWallet, ensureCommunityMember, async (req, res) => {
  try {
    const { caseId } = req.params;
    
    // Find the governance case
    const governanceCase = await GovernanceCase.findById(caseId);
    if (!governanceCase) {
      return res.status(404).json({
        success: false,
        message: 'Governance case not found'
      });
    }
    
    // Check if case is in PENDING_REVIEW status
    if (governanceCase.status !== 'PENDING_REVIEW') {
      return res.status(400).json({
        success: false,
        message: `Cannot activate voting for case in ${governanceCase.status} status`,
        currentStatus: governanceCase.status
      });
    }
    
    // Optional: Check if user has permission to activate voting
    // For now, any community member can activate voting
    // You could add role-based permissions here if needed
    
    // Activate voting
    governanceCase.status = 'ACTIVE_VOTING';
    governanceCase.votingStartTime = new Date();
    governanceCase.votingEndTime = new Date(Date.now() + governanceCase.votingPeriod * 60 * 60 * 1000);
    
    await governanceCase.save();
    
    // Send notifications to community members
    try {
      await governanceNotificationService.notifyVotingStarted(governanceCase);
    } catch (notifError) {
      console.error('Failed to send voting start notifications:', notifError);
    }
    
    res.json({
      success: true,
      message: 'Voting has been activated successfully',
      case: {
        id: governanceCase._id,
        caseId: governanceCase.caseId,
        title: governanceCase.title,
        status: governanceCase.status,
        votingStartTime: governanceCase.votingStartTime,
        votingEndTime: governanceCase.votingEndTime,
        votingPeriod: governanceCase.votingPeriod
      }
    });
    
  } catch (error) {
    console.error('Error activating voting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate voting',
      error: error.message
    });
  }
});

/**
 * POST /api/governance/cases/:caseId/auto-activate
 * Auto-activate voting for cases that have been in PENDING_REVIEW for a certain time
 */
router.post('/cases/auto-activate-voting', verifyWallet, async (req, res) => {
  try {
    const { maxPendingHours = 24 } = req.body; // Cases pending for more than 24 hours
    
    const cutoffTime = new Date(Date.now() - maxPendingHours * 60 * 60 * 1000);
    
    // Find cases that have been pending for too long
    const pendingCases = await GovernanceCase.find({
      status: 'PENDING_REVIEW',
      createdAt: { $lt: cutoffTime }
    });
    
    const activatedCases = [];
    
    for (const governanceCase of pendingCases) {
      // Activate voting
      governanceCase.status = 'ACTIVE_VOTING';
      governanceCase.votingStartTime = new Date();
      governanceCase.votingEndTime = new Date(Date.now() + governanceCase.votingPeriod * 60 * 60 * 1000);
      
      await governanceCase.save();
      
      activatedCases.push({
        id: governanceCase._id,
        caseId: governanceCase.caseId,
        title: governanceCase.title,
        type: governanceCase.type
      });
      
      // Send notifications
      try {
        await governanceNotificationService.notifyVotingStarted(governanceCase);
      } catch (notifError) {
        console.error('Failed to send voting start notification for case:', governanceCase.caseId, notifError);
      }
    }
    
    res.json({
      success: true,
      message: `Activated voting for ${activatedCases.length} pending cases`,
      activatedCases: activatedCases,
      totalActivated: activatedCases.length
    });
    
  } catch (error) {
    console.error('Error auto-activating voting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-activate voting',
      error: error.message
    });
  }
});

module.exports = router;