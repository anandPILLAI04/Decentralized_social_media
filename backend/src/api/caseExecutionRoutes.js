const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const caseExecutionService = require('../services/caseExecutionService');
const GovernanceCase = require('../models/GovernanceCase');

/**
 * Case Execution Management Routes
 * Handles automatic execution of approved governance decisions
 */

/**
 * POST /api/case-execution/execute/:caseId
 * Execute a governance case (manual trigger)
 */
router.post('/execute/:caseId', auth, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { decision, executorId } = req.body;
    const walletAddress = req.user.address;
    
    // Validate case exists and can be executed
    const governanceCase = await GovernanceCase.findById(caseId);
    if (!governanceCase) {
      return res.status(404).json({
        success: false,
        message: 'Governance case not found'
      });
    }
    
    // Check if case is in executable state
    const validStatuses = ['VOTING_ENDED', 'APPROVED', 'REJECTED'];
    if (!validStatuses.includes(governanceCase.status)) {
      return res.status(400).json({
        success: false,
        message: `Case cannot be executed. Current status: ${governanceCase.status}`,
        validStatuses
      });
    }
    
    // Execute the case
    const result = await caseExecutionService.executeGovernanceCase(
      caseId,
      decision || governanceCase.status,
      executorId || walletAddress
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          caseId,
          executedActions: result.executedActions,
          results: result.results,
          requiresManualReview: result.requiresManualReview
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: result.message || 'Execution failed',
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('Error executing case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute case',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/case-execution/status/:caseId
 * Get execution status for a case
 */
router.get('/status/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const result = await caseExecutionService.getExecutionStatus(caseId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
    
  } catch (error) {
    console.error('Error getting execution status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get execution status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/case-execution/retry/:caseId
 * Retry failed execution
 */
router.post('/retry/:caseId', auth, async (req, res) => {
  try {
    const { caseId } = req.params;
    const walletAddress = req.user.address;
    
    const result = await caseExecutionService.retryExecution(caseId, walletAddress);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          caseId,
          executedActions: result.executedActions,
          results: result.results,
          requiresManualReview: result.requiresManualReview
        }
      });
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    console.error('Error retrying execution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry execution',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/case-execution/pending
 * Get cases pending execution
 */
router.get('/pending', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    
    // Find cases that can be executed (use model's canExecute method)
    const allCases = await GovernanceCase.find({
      status: 'VOTING_ENDED',
      'execution.status': { $ne: 'COMPLETED' }
    })
    .sort({ votingEndTime: 1 }); // Oldest first
    
    // Filter using the model's canExecute method
    const cases = allCases.filter(c => c.canExecute());
    
    // Apply pagination to the filtered results
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedCases = cases.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        cases: paginatedCases,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(cases.length / parseInt(limit)),
          limit: parseInt(limit),
          totalCases: cases.length
        }
      }
    });

  } catch (error) {
    console.error('Error fetching pending executions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending executions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});/**
 * GET /api/case-execution/failed
 * Get cases with failed executions
 */
router.get('/failed', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    
    const cases = await GovernanceCase.find({
      'execution.status': 'FAILED'
    })
    .select('_id title caseType status execution createdAt')
    .sort({ 'execution.executedAt': -1 }) // Most recent failures first
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit))
    .lean();
    
    const totalCases = await GovernanceCase.countDocuments({
      'execution.status': 'FAILED'
    });
    
    res.json({
      success: true,
      data: {
        cases,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalCases / parseInt(limit)),
          limit: parseInt(limit),
          totalCases
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching failed executions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch failed executions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/case-execution/stats
 * Get execution statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await GovernanceCase.aggregate([
      {
        $group: {
          _id: '$execution.status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Calculate execution success rate
    const executionStats = await GovernanceCase.aggregate([
      {
        $match: {
          'execution.status': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          totalExecutions: { $sum: 1 },
          successful: {
            $sum: {
              $cond: [
                { $eq: ['$execution.status', 'COMPLETED'] },
                1,
                0
              ]
            }
          },
          failed: {
            $sum: {
              $cond: [
                { $eq: ['$execution.status', 'FAILED'] },
                1,
                0
              ]
            }
          },
          pending: {
            $sum: {
              $cond: [
                { $eq: ['$execution.status', 'PENDING'] },
                1,
                0
              ]
            }
          },
          requiresManual: {
            $sum: {
              $cond: [
                { $eq: ['$execution.status', 'REQUIRES_MANUAL'] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalExecutions: 1,
          successful: 1,
          failed: 1,
          pending: 1,
          requiresManual: 1,
          successRate: {
            $cond: [
              { $eq: ['$totalExecutions', 0] },
              0,
              { $multiply: [{ $divide: ['$successful', '$totalExecutions'] }, 100] }
            ]
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        statusDistribution: stats,
        overview: executionStats[0] || {
          totalExecutions: 0,
          successful: 0,
          failed: 0,
          pending: 0,
          requiresManual: 0,
          successRate: 0
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching execution stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch execution statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/case-execution/auto-execute
 * Auto-execute all eligible cases (admin/cron job)
 */
router.post('/auto-execute', auth, async (req, res) => {
  try {
    const { adminKey, maxCases = 10 } = req.body;
    
    // Simple admin check (replace with proper admin auth in production)
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }
    
    // Find cases eligible for execution using model's canExecute method
    const allCases = await GovernanceCase.find({
      status: 'VOTING_ENDED',
      'execution.status': { $in: ['PENDING', 'FAILED'] }
    })
    .limit(maxCases * 2) // Get more than needed since we'll filter
    .sort({ votingEndTime: 1 }); // Oldest first
    
    // Filter using the model's canExecute method
    const eligibleCases = allCases.filter(c => c.canExecute()).slice(0, maxCases);
    
    const results = [];
    
    for (const governanceCase of eligibleCases) {
      try {
        const result = await caseExecutionService.executeGovernanceCase(
          governanceCase._id,
          governanceCase.status,
          'AUTO_EXECUTOR'
        );
        
        results.push({
          caseId: governanceCase._id,
          title: governanceCase.title,
          ...result
        });
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        results.push({
          caseId: governanceCase._id,
          title: governanceCase.title,
          success: false,
          error: error.message
        });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      message: `Auto-execution completed: ${successful} successful, ${failed} failed`,
      data: {
        summary: {
          total: results.length,
          successful,
          failed
        },
        results: results.slice(0, 10) // Limit response size
      }
    });
    
  } catch (error) {
    console.error('Error in auto-execution:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-execute cases',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;