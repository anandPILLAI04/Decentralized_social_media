const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const appealService = require('../services/appealService');
const Appeal = require('../models/Appeal');

/**
 * Content Appeals API Routes
 * Handles appeals of AI moderation decisions
 */

// Submit a new appeal
router.post('/appeals', auth, async (req, res) => {
  try {
    const {
      contentId,
      contentType,
      reason,
      description,
      evidence
    } = req.body;

    const appealerAddress = req.user.address;

    // Validation
    if (!contentId || !contentType || !reason || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: contentId, contentType, reason, description'
      });
    }

    if (!['Post', 'Comment'].includes(contentType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contentType. Must be "Post" or "Comment"'
      });
    }

    const appealData = {
      reason,
      description,
      evidence: evidence || []
    };

    const result = await appealService.submitAppeal(
      contentId,
      contentType,
      appealerAddress,
      appealData
    );

    res.json(result);

  } catch (error) {
    console.error('❌ Submit appeal error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get appeals for a user
router.get('/appeals/user/:address', auth, async (req, res) => {
  try {
    const { address } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const appeals = await appealService.getUserAppeals(address, status);
    
    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedAppeals = appeals.slice(skip, skip + Number(limit));

    res.json({
      success: true,
      appeals: paginatedAppeals,
      pagination: {
        currentPage: Number(page),
        totalAppeals: appeals.length,
        totalPages: Math.ceil(appeals.length / Number(limit)),
        hasNextPage: skip + Number(limit) < appeals.length
      }
    });

  } catch (error) {
    console.error('❌ Get user appeals error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get appeal details by ID
router.get('/appeals/:appealId', optionalAuth, async (req, res) => {
  try {
    const { appealId } = req.params;

    const appeal = await Appeal.findOne({ appealId })
      .populate('originalModerationId')
      .populate('governanceProposalId')
      .populate('contentId');

    if (!appeal) {
      return res.status(404).json({
        success: false,
        error: 'Appeal not found'
      });
    }

    res.json({
      success: true,
      appeal
    });

  } catch (error) {
    console.error('❌ Get appeal details error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Moderator: Get pending appeals for review
router.get('/appeals/pending/review', auth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const appeals = await appealService.getPendingAppeals(Number(limit));

    res.json({
      success: true,
      appeals,
      count: appeals.length
    });

  } catch (error) {
    console.error('❌ Get pending appeals error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Moderator: Review an appeal
router.post('/appeals/:appealId/review', auth, async (req, res) => {
  try {
    const { appealId } = req.params;
    const { recommendation, notes, reasoning } = req.body;
    const moderatorAddress = req.user.address;

    if (!recommendation) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: recommendation'
      });
    }

    if (!['approve', 'reject', 'escalate_to_community'].includes(recommendation)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recommendation. Must be: approve, reject, or escalate_to_community'
      });
    }

    const reviewData = {
      recommendation,
      notes: notes || '',
      reasoning: reasoning || ''
    };

    const appeal = await appealService.reviewAppeal(
      appealId,
      moderatorAddress,
      reviewData
    );

    res.json({
      success: true,
      appeal,
      action: recommendation
    });

  } catch (error) {
    console.error('❌ Appeal review error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Escalate appeal to community governance
router.post('/appeals/:appealId/escalate', auth, async (req, res) => {
  try {
    const { appealId } = req.params;

    const result = await appealService.escalateToGovernance(appealId);

    res.json(result);

  } catch (error) {
    console.error('❌ Appeal escalation error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Handle governance decision (called by governance system)
router.post('/appeals/:appealId/governance-decision', auth, async (req, res) => {
  try {
    const { appealId } = req.params;
    const { decision, votingResults } = req.body;

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid decision. Must be "approved" or "rejected"'
      });
    }

    const appeal = await appealService.handleGovernanceDecision(
      appealId,
      decision,
      votingResults
    );

    res.json({
      success: true,
      appeal,
      decision
    });

  } catch (error) {
    console.error('❌ Governance decision error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get appeal statistics (for analytics)
router.get('/appeals/stats/summary', optionalAuth, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;

    const stats = await appealService.getAppealStatistics(timeframe);

    res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    console.error('❌ Get appeal statistics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Withdraw an appeal (user can cancel their own appeal)
router.post('/appeals/:appealId/withdraw', auth, async (req, res) => {
  try {
    const { appealId } = req.params;
    const { reason } = req.body;
    const userAddress = req.user.address;

    const appeal = await Appeal.findOne({ appealId });
    
    if (!appeal) {
      return res.status(404).json({
        success: false,
        error: 'Appeal not found'
      });
    }

    if (appeal.appealerAddress !== userAddress) {
      return res.status(403).json({
        success: false,
        error: 'Only the appealer can withdraw this appeal'
      });
    }

    if (!['pending', 'under_review'].includes(appeal.status)) {
      return res.status(400).json({
        success: false,
        error: 'Appeal cannot be withdrawn in its current state'
      });
    }

    // Update appeal status
    appeal.status = 'withdrawn';
    appeal.resolution = {
      decision: 'withdrawn',
      decisionDate: new Date(),
      decisionBy: 'user',
      reasoning: reason || 'Withdrawn by appealer'
    };
    appeal.resolvedAt = new Date();

    await appeal.save();

    res.json({
      success: true,
      message: 'Appeal withdrawn successfully',
      appeal
    });

  } catch (error) {
    console.error('❌ Withdraw appeal error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get appeal reasons and guidelines (for frontend forms)
router.get('/appeals/info/guidelines', optionalAuth, async (req, res) => {
  try {
    const guidelines = {
      appealReasons: [
        {
          value: 'false_positive',
          label: 'False Positive',
          description: 'The content was incorrectly flagged and doesn\'t violate guidelines'
        },
        {
          value: 'context_misunderstood',
          label: 'Context Misunderstood',
          description: 'The AI didn\'t understand the context or intent of the content'
        },
        {
          value: 'cultural_difference',
          label: 'Cultural Difference',
          description: 'Cultural or regional differences were not considered'
        },
        {
          value: 'sarcasm_humor',
          label: 'Sarcasm/Humor',
          description: 'The content was meant as sarcasm, humor, or satire'
        },
        {
          value: 'educational_content',
          label: 'Educational Content',
          description: 'The content has educational or informational value'
        },
        {
          value: 'artistic_expression',
          label: 'Artistic Expression',
          description: 'The content is artistic, creative, or expressive in nature'
        },
        {
          value: 'historical_reference',
          label: 'Historical Reference',
          description: 'The content references historical events or documents'
        },
        {
          value: 'technical_error',
          label: 'Technical Error',
          description: 'There was a technical issue with the moderation system'
        },
        {
          value: 'other',
          label: 'Other',
          description: 'Other reason not listed above'
        }
      ],
      guidelines: [
        'Provide specific details about why you believe the moderation decision was incorrect',
        'Include relevant context that may have been missed by the automated system',
        'Be respectful and constructive in your appeal description',
        'Provide evidence or references to support your appeal when possible',
        'Appeals are reviewed by human moderators and may be escalated to community voting',
        'False or frivolous appeals may affect your ability to submit future appeals'
      ],
      estimatedProcessingTimes: {
        moderator_review: '1-3 business days',
        community_vote: '5-7 days',
        complex_cases: 'Up to 14 days'
      }
    };

    res.json({
      success: true,
      guidelines
    });

  } catch (error) {
    console.error('❌ Get appeal guidelines error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;