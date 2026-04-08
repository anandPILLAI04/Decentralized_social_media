const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../middleware/auth');
const governanceNotificationService = require('../services/governanceNotificationService');
const NotificationPreferences = require('../models/NotificationPreferences');
const Notification = require('../models/Notification');

/**
 * Enhanced Notification API Routes
 * Comprehensive notification management for governance and social features
 */

/**
 * GET /api/notifications
 * Get user notifications with filtering and pagination
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const walletAddress = req.user?.address;
    if (!walletAddress) {
      return res.json({ success: true, data: { notifications: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } } });
    }

    const {
      page = 1,
      limit = 20,
      category,
      type,
      unreadOnly = false
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 50), // Max 50 per request
      category,
      type,
      unreadOnly: unreadOnly === 'true'
    };

    const notifications = await governanceNotificationService.getUserNotifications(
      walletAddress,
      options
    );

    const totalCount = await Notification.countDocuments({
      recipient: walletAddress.toLowerCase(),
      ...(category && { category }),
      ...(type && { type }),
      ...(unreadOnly === 'true' && { read: false })
    });

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: options.page,
          limit: options.limit,
          total: totalCount,
          pages: Math.ceil(totalCount / options.limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for user
 */
router.get('/unread-count', optionalAuth, async (req, res) => {
  try {
    const walletAddress = req.user?.address;
    if (!walletAddress) {
      return res.json({ success: true, data: { unreadCount: 0 } });
    }

    const count = await governanceNotificationService.getUnreadCount(walletAddress);

    res.json({
      success: true,
      data: { unreadCount: count }
    });

  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
});

// PATCH /api/notifications/:id/read (Legacy support)
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const walletAddress = req.user.address;

    const { id } = req.params;
    const result = await governanceNotificationService.markAsRead(id, walletAddress);
    
    if (result.success) {
      res.json({ success: true, message: 'Notification marked as read' });
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/:notificationId/read
 * Mark a notification as read
 */
router.post('/:notificationId/read', auth, async (req, res) => {
  try {
    const walletAddress = req.user.address;

    const { notificationId } = req.params;
    const result = await governanceNotificationService.markAsRead(
      notificationId,
      walletAddress
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } else {
      res.status(404).json(result);
    }

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification'
    });
  }
});

// PATCH /api/notifications/read-all (Legacy support)
router.patch('/read-all', auth, async (req, res) => {
  try {
    const walletAddress = req.user.address;

    const result = await Notification.updateMany(
      { recipient: walletAddress.toLowerCase(), read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ success: true, result: { modifiedCount: result.modifiedCount } });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/notifications/preferences
 * Get user notification preferences
 */
router.get('/preferences', auth, async (req, res) => {
  try {
    const walletAddress = req.user.address;

    const preferences = await NotificationPreferences.getOrCreatePreferences(walletAddress);

    res.json({
      success: true,
      data: preferences
    });

  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preferences'
    });
  }
});

/**
 * PUT /api/notifications/preferences
 * Update user notification preferences
 */
router.put('/preferences', auth, async (req, res) => {
  try {
    const walletAddress = req.user.address;

    const preferences = await NotificationPreferences.getOrCreatePreferences(walletAddress);
    
    // Update preferences with provided data
    Object.assign(preferences, req.body);
    await preferences.save();

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: preferences
    });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences'
    });
  }
});

/**
 * POST /api/notifications/test-governance
 * Test governance notification (development only)
 */
router.post('/test-governance', auth, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Test endpoints not available in production'
      });
    }

    const walletAddress = req.user.address;

    const { type = 'governance_case_created' } = req.body;

    const testNotification = await governanceNotificationService.createGovernanceNotification({
      type,
      recipient: walletAddress,
      sender: {
        address: '0xtest123',
        username: 'TestUser'
      },
      content: {
        title: 'Test Governance Notification',
        message: 'This is a test governance notification',
        actionUrl: '/governance/cases'
      },
      governanceCase: {
        caseId: 'test-case-123',
        caseType: 'TEST_CASE',
        urgency: 'NORMAL'
      }
    });

    res.json({
      success: true,
      message: 'Test notification created',
      data: testNotification
    });

  } catch (error) {
    console.error('Error creating test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create test notification'
    });
  }
});

module.exports = router;
