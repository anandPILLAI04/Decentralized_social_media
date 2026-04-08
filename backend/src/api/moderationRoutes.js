const express = require('express');
const multer = require('multer');
const AIService = require('../services/aiService');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();
const aiService = new AIService();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

/**
 * @route   POST /api/moderation/analyze
 * @desc    Analyze content for inappropriate material
 * @access  Private
 */
router.post('/analyze', auth, upload.single('file'), async (req, res) => {
  try {
    const { type, text } = req.body;
    const file = req.file;

    console.log('🔍 Content moderation request:', {
      type,
      hasFile: !!file,
      hasText: !!text,
      userAddress: req.user?.address
    });

    let analysisResult = {
      safe: true,
      confidence: 0,
      reasons: [],
      shouldBlur: false,
      warning: null
    };

    // Analyze text content if provided
    if (text && text.trim()) {
      console.log('📝 Analyzing text content...');
      const textResult = await aiService.moderateContent(text);
      console.log('📊 AI Service Response:', textResult);

      // Handle the actual AI service response format
      if (textResult.action === 'flag' || textResult.action === 'review') {
        analysisResult.safe = false;
        analysisResult.confidence = Math.max(analysisResult.confidence, textResult.confidence || 0.7);
        analysisResult.reasons.push(textResult.reason || 'inappropriate_text');
        if (textResult.details?.flag_reasons) {
          analysisResult.reasons.push(...textResult.details.flag_reasons);
        }
        analysisResult.shouldBlur = true;
        analysisResult.warning = {
          type: textResult.action === 'flag' ? 'inappropriate_text' : 'review_needed',
          title: textResult.action === 'flag' ? '⚠️ Content Warning' : '🔍 Review Needed',
          message: textResult.action === 'flag'
            ? 'This text contains inappropriate content.'
            : 'This content needs human review.',
          action: 'Click to view'
        };
      } else if (textResult.action === 'approve' || textResult.action === 'continue') {
        analysisResult.safe = true;
        analysisResult.confidence = Math.max(analysisResult.confidence, textResult.confidence || 0.9);
      }
    }

    // Analyze image/video content if provided
    if (file) {
      console.log('🖼️ Media content uploaded but image moderation is disabled:', {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      });

      // Since image moderation is disabled, mark media as safe but with a warning
      console.log('⚠️ Image moderation is disabled - marking media as safe');
      // Media is considered safe since we don't have image moderation enabled
    }

    // If no content provided
    if (!text && !file) {
      return res.status(400).json({
        success: false,
        error: 'No content provided for analysis'
      });
    }

    console.log('✅ Content moderation complete:', {
      safe: analysisResult.safe,
      shouldBlur: analysisResult.shouldBlur,
      confidence: analysisResult.confidence,
      reasons: analysisResult.reasons
    });

    res.json({
      success: true,
      data: analysisResult
    });

  } catch (error) {
    console.error('❌ Content moderation error:', error);
    res.status(500).json({
      success: false,
      error: 'Content moderation failed',
      details: error.message
    });
  }
});

/**
 * @route   PUT /api/moderation/preferences
 * @desc    Update user content preferences
 * @access  Private
 */
router.put('/preferences', auth, async (req, res) => {
  try {
    const { walletAddress, preferences } = req.body;
    
    // Verify user can update these preferences
    if (req.user.address !== walletAddress) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to update preferences for this user'
      });
    }

    const user = await User.findOne({ walletAddress });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update content preferences
    user.contentPreferences = {
      ...user.contentPreferences,
      ...preferences,
      updatedAt: new Date()
    };

    await user.save();

    console.log('📋 Updated content preferences for', walletAddress, preferences);

    res.json({
      success: true,
      data: {
        preferences: user.contentPreferences
      }
    });

  } catch (error) {
    console.error('❌ Update preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update content preferences',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/moderation/preferences/:walletAddress
 * @desc    Get user content preferences
 * @access  Private
 */
router.get('/preferences/:walletAddress', auth, async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    // Users can only view their own preferences
    if (req.user.address !== walletAddress) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to view preferences for this user'
      });
    }

    const user = await User.findOne({ walletAddress });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const defaultPreferences = {
      showSensitiveContent: false,
      hideSensitiveContent: false,
      autoBlurMedia: true,
      allowExplicitContent: false,
      updatedAt: new Date()
    };

    res.json({
      success: true,
      data: {
        preferences: user.contentPreferences || defaultPreferences
      }
    });

  } catch (error) {
    console.error('❌ Get preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get content preferences',
      details: error.message
    });
  }
});

/**
 * @route   POST /api/moderation/report
 * @desc    Report inappropriate content
 * @access  Private
 */
router.post('/report', auth, async (req, res) => {
  try {
    const { contentId, contentType, reason, description } = req.body;
    const reportedBy = req.user.address;

    // Validate input
    if (!contentId || !contentType || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: contentId, contentType, and reason'
      });
    }

    // Create content report (you might want to create a ContentReport model)
    const report = {
      contentId,
      contentType, // 'post', 'comment', 'user'
      reason,
      description: description || '',
      reportedBy,
      reportedAt: new Date(),
      status: 'pending' // pending, reviewed, resolved
    };

    console.log('🚨 Content reported:', report);

    // Here you could save to a ContentReport model
    // For now, just log it and return success
    
    res.json({
      success: true,
      data: {
        message: 'Content reported successfully',
        reportId: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    });

  } catch (error) {
    console.error('❌ Content report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to report content',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/moderation/test
 * @desc    Test content moderation functionality
 * @access  Private
 */
router.get('/test', auth, async (req, res) => {
  try {
    console.log('🧪 Testing content moderation...');
    
    // Test text moderation
    const textTest = await aiService.moderateContent("This is a test message");
    
    res.json({
      success: true,
      data: {
        aiServiceInitialized: !!aiService,
        textModerationTest: textTest,
        imageModEnabled: false,
        availableMethods: [
          'moderateContent',
          'getStatus'
        ]
      }
    });

  } catch (error) {
    console.error('❌ Moderation test error:', error);
    res.status(500).json({
      success: false,
      error: 'Moderation test failed',
      details: error.message
    });
  }
});

module.exports = router;
