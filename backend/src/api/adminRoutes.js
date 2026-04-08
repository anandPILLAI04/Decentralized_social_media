const express = require('express');
const router = express.Router();
const adminDashboardService = require('../services/adminDashboardService');
const governanceScheduler = require('../services/governanceScheduler');
const executionScheduler = require('../services/executionScheduler');
const appealService = require('../services/appealService');
const { notificationService } = require('../services/notificationService');
const { unbanAllUsers } = require('../utils/unbanUsers');

/**
 * Admin Dashboard API Routes
 * Comprehensive analytics and monitoring for platform administrators
 */

// Middleware for admin authentication (placeholder)
const requireAdmin = (req, res, next) => {
  // In production, implement proper admin authentication
  const adminKey = req.headers.adminkey || req.headers['admin-key'] || req.headers.authorization;
  
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  
  next();
};

// Platform Overview Dashboard
router.get('/dashboard/overview', requireAdmin, async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;

    const overview = await adminDashboardService.getPlatformOverview(timeframe);

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    console.error('❌ Dashboard overview error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// User Analytics
router.get('/dashboard/users', requireAdmin, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const timeframeDays = adminDashboardService.parseTimeframe(timeframe);
    const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

    const userStats = await adminDashboardService.getUserStatistics(startDate);

    res.json({
      success: true,
      data: userStats,
      timeframe
    });

  } catch (error) {
    console.error('❌ User analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Content Analytics
router.get('/dashboard/content', requireAdmin, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const timeframeDays = adminDashboardService.parseTimeframe(timeframe);
    const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

    const contentStats = await adminDashboardService.getContentStatistics(startDate);

    res.json({
      success: true,
      data: contentStats,
      timeframe
    });

  } catch (error) {
    console.error('❌ Content analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// AI Moderation Analytics
router.get('/dashboard/moderation', requireAdmin, async (req, res) => {
  try {
    const { timeframe = '30d', detailed = 'false' } = req.query;

    let moderationData;
    
    if (detailed === 'true') {
      moderationData = await adminDashboardService.getAIModerationAnalytics(timeframe);
    } else {
      const timeframeDays = adminDashboardService.parseTimeframe(timeframe);
      const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
      moderationData = await adminDashboardService.getModerationStatistics(startDate);
    }

    res.json({
      success: true,
      data: moderationData,
      timeframe,
      detailed: detailed === 'true'
    });

  } catch (error) {
    console.error('❌ Moderation analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Governance Analytics
router.get('/dashboard/governance', requireAdmin, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;

    const [governanceStats, schedulerStatus] = await Promise.all([
      (async () => {
        const timeframeDays = adminDashboardService.parseTimeframe(timeframe);
        const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
        return await adminDashboardService.getGovernanceStatistics(startDate);
      })(),
      governanceScheduler.getGovernanceStats()
    ]);

    res.json({
      success: true,
      data: {
        ...governanceStats,
        scheduler: {
          status: governanceScheduler.getStatus(),
          stats: schedulerStatus
        }
      },
      timeframe
    });

  } catch (error) {
    console.error('❌ Governance analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// System Health Monitoring
router.get('/dashboard/health', requireAdmin, async (req, res) => {
  try {
    const [healthMetrics, alerts] = await Promise.all([
      adminDashboardService.getSystemHealthMetrics(),
      adminDashboardService.getPlatformAlerts()
    ]);

    res.json({
      success: true,
      data: {
        health: healthMetrics,
        alerts: alerts,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ System health error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Appeals Management
router.get('/dashboard/appeals', requireAdmin, async (req, res) => {
  try {
    const { status, timeframe = '30d', page = 1, limit = 20 } = req.query;

    const [appeals, statistics] = await Promise.all([
      appealService.getPendingAppeals(Number(limit)),
      appealService.getAppealStatistics(timeframe)
    ]);

    // Apply status filter if provided
    const filteredAppeals = status 
      ? appeals.filter(appeal => appeal.status === status)
      : appeals;

    res.json({
      success: true,
      data: {
        appeals: filteredAppeals,
        statistics,
        pagination: {
          currentPage: Number(page),
          limit: Number(limit),
          total: filteredAppeals.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Appeals dashboard error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Platform Alerts
router.get('/dashboard/alerts', requireAdmin, async (req, res) => {
  try {
    const alerts = await adminDashboardService.getPlatformAlerts();

    res.json({
      success: true,
      data: alerts
    });

  } catch (error) {
    console.error('❌ Platform alerts error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Governance Scheduler Controls
router.post('/dashboard/scheduler/:action', requireAdmin, async (req, res) => {
  try {
    const { action } = req.params;

    let result;
    switch (action) {
      case 'start':
        governanceScheduler.start();
        result = { message: 'Governance scheduler started' };
        break;
        
      case 'stop':
        governanceScheduler.stop();
        result = { message: 'Governance scheduler stopped' };
        break;
        
      case 'status':
        result = governanceScheduler.getStatus();
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Use start, stop, or status'
        });
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error(`❌ Scheduler ${action} error:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual Case Execution Trigger
router.post('/dashboard/execution/trigger', requireAdmin, async (req, res) => {
  try {
    console.log('🚀 Manual execution trigger initiated by admin');

    const result = await executionScheduler.triggerManualExecution();

    res.json({
      success: true,
      data: {
        message: 'Manual case execution triggered',
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        results: result.results
      }
    });

  } catch (error) {
    console.error('❌ Manual execution trigger error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Manual Governance Reminder
router.post('/dashboard/governance/remind/:proposalId', requireAdmin, async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { reminderType = 'deadline' } = req.body;

    const result = await governanceScheduler.sendManualReminder(proposalId, reminderType);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Manual reminder error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk Operations
router.post('/dashboard/bulk/:operation', requireAdmin, async (req, res) => {
  try {
    const { operation } = req.params;
    const { targets, action, reason } = req.body;

    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Targets array is required'
      });
    }

    let results = [];

    switch (operation) {
      case 'moderate':
        // Bulk moderation actions
        results = await Promise.all(
          targets.map(async (contentId) => {
            try {
              // Implementation for bulk moderation
              return { contentId, success: true, action };
            } catch (error) {
              return { contentId, success: false, error: error.message };
            }
          })
        );
        break;

      case 'notify':
        // Bulk notifications
        results = await Promise.all(
          targets.map(async (userId) => {
            try {
              await notificationService.createNotification({
                type: 'system_update',
                recipient: userId,
                content: {
                  title: 'System Notification',
                  message: reason || 'Platform update notification'
                }
              });
              return { userId, success: true };
            } catch (error) {
              return { userId, success: false, error: error.message };
            }
          })
        );
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid bulk operation'
        });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.json({
      success: true,
      data: {
        operation,
        totalTargets: targets.length,
        successCount,
        failureCount,
        results
      }
    });

  } catch (error) {
    console.error('❌ Bulk operation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export Analytics Data
router.get('/dashboard/export/:type', requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;
    const { timeframe = '30d', format = 'json' } = req.query;

    const timeframeDays = adminDashboardService.parseTimeframe(timeframe);
    const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

    let data;
    switch (type) {
      case 'users':
        data = await adminDashboardService.getUserStatistics(startDate);
        break;
      case 'content':
        data = await adminDashboardService.getContentStatistics(startDate);
        break;
      case 'moderation':
        data = await adminDashboardService.getModerationStatistics(startDate);
        break;
      case 'governance':
        data = await adminDashboardService.getGovernanceStatistics(startDate);
        break;
      case 'overview':
        data = await adminDashboardService.getPlatformOverview(timeframe);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid export type'
        });
    }

    if (format === 'csv') {
      // Convert to proper CSV format
      const flattenObject = (obj, prefix = '') => {
        let result = {};
        for (const [key, value] of Object.entries(obj)) {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            Object.assign(result, flattenObject(value, newKey));
          } else {
            result[newKey] = value;
          }
        }
        return result;
      };

      const flat = flattenObject(data);
      const headers = Object.keys(flat).join(',');
      const values = Object.values(flat).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
      const csv = `${headers}\n${values}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type}_export_${timeframe}.csv`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${type}_export_${timeframe}.json`);
      res.json({
        success: true,
        exportType: type,
        timeframe,
        generatedAt: new Date(),
        data
      });
    }

  } catch (error) {
    console.error('❌ Export error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Admin Activity Log
router.get('/dashboard/activity', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, action } = req.query;

    // This would track admin actions in a production system
    const activityLog = [
      {
        timestamp: new Date(),
        admin: 'system',
        action: 'dashboard_access',
        target: 'overview',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    ];

    res.json({
      success: true,
      data: {
        activities: activityLog,
        pagination: {
          currentPage: Number(page),
          totalPages: 1,
          total: activityLog.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Activity log error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/admin/unban-all-users
 * Unban all banned users (admin only)
 */
router.post('/unban-all-users', requireAdmin, async (req, res) => {
  try {
    console.log('🔧 Admin request: Unbanning all users...');
    
    const result = await unbanAllUsers();
    
    if (result.success) {
      console.log(`✅ Admin action completed: ${result.message}`);
      res.json({
        success: true,
        message: result.message,
        data: {
          unbannedCount: result.unbannedCount,
          previouslyBannedUsers: result.previouslyBannedUsers || []
        }
      });
    } else {
      console.error(`❌ Admin action failed: ${result.message}`);
      res.status(500).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Unban all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unban users',
      error: error.message
    });
  }
});

module.exports = router;