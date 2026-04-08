const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const mongoose = require('mongoose');
const Evidence = require('../models/Evidence');
const { 
  verifyEvidence,
  flagEvidence,
  voteOnEvidence,
  deleteEvidence,
  getEvidenceById,
  getEvidenceStats
} = require('../services/evidenceService');

/**
 * Evidence Management API Routes
 * Handles evidence verification, voting, and moderation
 */

/**
 * GET /api/evidence/:evidenceId
 * Get specific evidence with metadata
 */
router.get('/:evidenceId', optionalAuth, async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const walletAddress = req.user ? req.user.address : null;
    
    const result = await getEvidenceById(evidenceId, walletAddress);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
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
 * POST /api/evidence/:evidenceId/verify
 * Verify evidence (moderators/experts only)
 */
router.post('/:evidenceId/verify', auth, async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const { method = 'MANUAL' } = req.body;

    // TODO: Add proper authorization check for moderators/experts
    // For now, anyone can verify

    const result = await verifyEvidence(evidenceId, req.user.address, method);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Error verifying evidence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify evidence',
      error: error.message
    });
  }
});

/**
 * POST /api/evidence/:evidenceId/flag
 * Flag evidence as inappropriate
 */
router.post('/:evidenceId/flag', auth, async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Flag reason must be at least 10 characters'
      });
    }

    const result = await flagEvidence(evidenceId, req.user.address, reason);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Error flagging evidence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to flag evidence',
      error: error.message
    });
  }
});

/**
 * POST /api/evidence/:evidenceId/vote
 * Vote on evidence quality (upvote/downvote)
 */
router.post('/:evidenceId/vote', auth, async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const { vote } = req.body; // 'up' or 'down'

    if (!vote || !['up', 'down'].includes(vote)) {
      return res.status(400).json({
        success: false,
        message: 'Vote must be either "up" or "down"'
      });
    }

    const isUpvote = vote === 'up';
    const result = await voteOnEvidence(evidenceId, req.user.address, isUpvote);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Error voting on evidence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to vote on evidence',
      error: error.message
    });
  }
});

/**
 * DELETE /api/evidence/:evidenceId
 * Delete evidence (submitter only)
 */
router.delete('/:evidenceId', auth, async (req, res) => {
  try {
    const { evidenceId } = req.params;

    const result = await deleteEvidence(evidenceId, req.user.address);
    
    if (!result.success) {
      return res.status(result.message === 'Evidence not found' ? 404 : 403).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Error deleting evidence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete evidence',
      error: error.message
    });
  }
});

/**
 * GET /api/evidence/case/:caseId/stats
 * Get evidence statistics for a governance case
 */
router.get('/case/:caseId/stats', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const result = await getEvidenceStats(caseId);
    res.json(result);
    
  } catch (error) {
    console.error('Error fetching evidence stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch evidence statistics',
      error: error.message
    });
  }
});

/**
 * PUT /api/evidence/:evidenceId/quality
 * Update evidence quality scores (community rating)
 */
router.put('/:evidenceId/quality', auth, async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const { clarity, relevance, authenticity, completeness } = req.body;
    
    // Validate ratings (1-5 scale)
    const ratings = { clarity, relevance, authenticity, completeness };
    for (const [key, value] of Object.entries(ratings)) {
      if (value !== undefined && (value < 1 || value > 5 || !Number.isInteger(value))) {
        return res.status(400).json({
          success: false,
          message: `${key} rating must be an integer between 1 and 5`
        });
      }
    }
    
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: 'Evidence not found'
      });
    }
    
    // Update quality ratings (average with existing scores)
    if (clarity !== undefined) {
      evidence.quality.clarity = Math.round((evidence.quality.clarity + clarity) / 2);
    }
    if (relevance !== undefined) {
      evidence.quality.relevance = Math.round((evidence.quality.relevance + relevance) / 2);
    }
    if (authenticity !== undefined) {
      evidence.quality.authenticity = Math.round((evidence.quality.authenticity + authenticity) / 2);
    }
    if (completeness !== undefined) {
      evidence.quality.completeness = Math.round((evidence.quality.completeness + completeness) / 2);
    }
    
    await evidence.save();
    
    res.json({
      success: true,
      message: 'Evidence quality updated successfully',
      quality: evidence.quality,
      overallQuality: evidence.overallQuality,
      trustScore: evidence.trustScore
    });
    
  } catch (error) {
    console.error('Error updating evidence quality:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update evidence quality',
      error: error.message
    });
  }
});

/**
 * GET /api/evidence/search
 * Search evidence across all cases
 */
router.get('/search', async (req, res) => {
  try {
    const {
      query = '',
      type = null,
      category = null,
      verified = null,
      minQuality = null,
      page = 1,
      limit = 20
    } = req.query;
    
    // Build search query
    const searchQuery = {
      status: { $in: ['APPROVED', 'PENDING'] },
      isPublic: true
    };
    
    // Text search in description and filename
    if (query.trim()) {
      searchQuery.$or = [
        { description: { $regex: query, $options: 'i' } },
        { fileName: { $regex: query, $options: 'i' } },
        { context: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (type) searchQuery.evidenceType = type;
    if (category) searchQuery.category = category;
    if (verified !== null) searchQuery.verified = verified === 'true';
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let pipeline = [
      { $match: searchQuery }
    ];
    
    // Add quality filter if specified
    if (minQuality) {
      pipeline.push({
        $addFields: {
          avgQuality: {
            $avg: [
              '$quality.clarity',
              '$quality.relevance',
              '$quality.authenticity',
              '$quality.completeness'
            ]
          }
        }
      });
      pipeline.push({
        $match: { avgQuality: { $gte: parseFloat(minQuality) } }
      });
    }
    
    pipeline = pipeline.concat([
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: 'submittedBy',
          foreignField: '_id',
          as: 'submitter'
        }
      },
      {
        $lookup: {
          from: 'governancecases',
          localField: 'governanceCase',
          foreignField: '_id',
          as: 'case'
        }
      }
    ]);
    
    const evidence = await Evidence.aggregate(pipeline);
    
    // Get total count for pagination
    const countPipeline = [{ $match: searchQuery }];
    if (minQuality) {
      countPipeline.push({
        $addFields: {
          avgQuality: {
            $avg: [
              '$quality.clarity',
              '$quality.relevance',
              '$quality.authenticity',
              '$quality.completeness'
            ]
          }
        }
      });
      countPipeline.push({
        $match: { avgQuality: { $gte: parseFloat(minQuality) } }
      });
    }
    countPipeline.push({ $count: "total" });
    
    const countResult = await Evidence.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;
    
    res.json({
      success: true,
      evidence: evidence,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Error searching evidence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search evidence',
      error: error.message
    });
  }
});

module.exports = router;