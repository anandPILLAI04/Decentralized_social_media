const express = require("express");
const router = express.Router();
const multer = require('multer');
const Post = require("../models/Post");
const User = require("../models/User");
const Like = require("../models/Like");
const Comment = require("../models/Comment");
const ipfsService = require('../services/ipfsService');
const notificationService = require('../services/notificationService');
const AIService = require('../services/aiService');
const aiService = new AIService();
const AIModeration = require('../models/AIModeration');
const ModerationFlag = require('../models/ModerationFlag');
const UserViolation = require('../models/UserViolation');
const smartFeedService = require('../services/smartFeedService');
const { checkCommentRestrictions, checkPostRestrictions, processModerationViolation } = require('../middleware/moderationMiddleware');
const { enforceBanRestrictions, checkBanStatus, preventContentCreation, preventSocialInteraction } = require('../middleware/banEnforcement');
const auth = require('../middleware/auth'); // Import auth middleware

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Map AI moderation reasons to valid ModerationFlag categories
const mapReasonToCategory = (reason) => {
  const validCategories = [
    'spam',
    'harassment',
    'hate_speech',
    'violence',
    'adult_content',
    'misinformation',
    'copyright',
    'scam',
    'off_topic',
    'duplicate_content',
    'other'
  ];

  if (!reason) return 'other';

  const lowerReason = reason.toLowerCase();

  // Map common AI moderation reasons to valid categories
  const reasonMap = {
    'toxic_content': 'harassment',
    'toxicity': 'harassment',
    'hate': 'hate_speech',
    'violence': 'violence',
    'adult': 'adult_content',
    'sexual': 'adult_content',
    'spam': 'spam',
    'misleading': 'misinformation',
    'false': 'misinformation',
    'copyright': 'copyright',
    'scam': 'scam',
    'fraud': 'scam',
    'profanity': 'harassment'
  };

  // Check if exact match exists
  if (validCategories.includes(lowerReason)) {
    return lowerReason;
  }

  // Check for keyword matches
  for (const [key, value] of Object.entries(reasonMap)) {
    if (lowerReason.includes(key)) {
      return value;
    }
  }

  // Default to 'other' if no match found
  return 'other';
};

// Helper function for getting user moderation history
const getUserModerationHistory = async (userAddress) => {
  try {
    // Get recent posts count (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentPostCount = await Post.countDocuments({
      authorId: userAddress,
      timestamp: { $gte: oneDayAgo }
    });

    // Get previous flags count
    const previousFlags = await AIModeration.countDocuments({
      authorAddress: userAddress,
      'analysis.flagged': true
    });

    // Calculate account age (days since first post)
    const firstPost = await Post.findOne(
      { authorId: userAddress },
      {},
      { sort: { timestamp: 1 } }
    );
    const accountAge = firstPost ?
      Math.floor((Date.now() - firstPost.timestamp.getTime()) / (24 * 60 * 60 * 1000)) : 0;

    return {
      recentPostCount,
      previousFlags,
      accountAge
    };
  } catch (error) {
    console.error('Error getting user history:', error);
    return {
      recentPostCount: 0,
      previousFlags: 0,
      accountAge: 0
    };
  }
};

// Upload file to IPFS
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Upload request received');
    
    if (!req.file) {
      console.error('❌ No file in request');
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }
    
    console.log('📦 File details:', {
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });
    
    console.log('🔄 Uploading to Pinata...');
    const ipfsHash = await ipfsService.uploadFile(
      req.file.buffer, 
      req.file.originalname
    );
    
    console.log('✅ Upload successful! CID:', ipfsHash);
    
    const ipfsUrls = ipfsService.getIpfsUrls(ipfsHash);
    
    res.json({ 
      success: true, 
      ipfsHash,
      ipfsUrls,
      fileName: req.file.originalname
    });
  } catch (err) {
    console.error('❌ IPFS upload error:', err.message);
    console.error('Full error:', err);
    res.status(500).json({ 
      success: false, 
      error: `IPFS upload failed: ${err.message}` 
    });
  }
});

// Upload JSON content to IPFS
router.post('/upload/json', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: 'No content provided' 
      });
    }
    
    const ipfsHash = await ipfsService.uploadJSON(content);
    const ipfsUrls = ipfsService.getIpfsUrls(ipfsHash);
    
    res.json({ 
      success: true, 
      ipfsHash,
      ipfsUrls
    });
  } catch (err) {
    console.error('IPFS JSON upload error:', err);
    res.status(500).json({ 
      success: false, 
      error: `IPFS JSON upload failed: ${err.message}` 
    });
  }
});

// Get all posts (paginated with AI-powered smart feed)
router.get("/posts", async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sort = 'smart',       // smart, latest, popular, trending
      filter = 'all',       // all, nft, ipfs
      following = 'false',  // true/false - show only followed users
      userId                // current user ID for personalization
    } = req.query;
    
    // Check if smart feed is requested and user is provided
    if (sort === 'smart' && userId) {
      console.log(`🤖 Generating smart feed for user: ${userId}`);
      
      try {
        const smartFeed = await smartFeedService.generatePersonalizedFeed(userId, {
          limit: Number(limit),
          page: Number(page),
          includeFollowing: following === 'true',
          includeTrending: true,
          includeRecommended: true
        });

        // Populate author information for smart feed posts
        const postsWithAuthorInfo = await Promise.all(
          smartFeed.posts.map(async (post) => {
            const postObj = post;
            
            // Get author info from User model
            const User = require('../models/User');
            const author = await User.findOne({ address: post.authorId });
            
            if (author) {
              postObj.author = {
                address: author.address,
                username: author.username,
                profileImage: author.profileImage || null,
                bio: author.bio || '',
                isVerified: author.isVerified || false
              };
            } else {
              postObj.author = {
                address: post.authorId,
                username: `User_${post.authorId.slice(0, 6)}`,
                profileImage: null,
                bio: '',
                isVerified: false
              };
            }

            return postObj;
          })
        );

        return res.json({
          success: true,
          posts: postsWithAuthorInfo,
          pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(smartFeed.metadata.totalCandidates / Number(limit)),
            totalPosts: smartFeed.metadata.totalCandidates,
            hasNextPage: postsWithAuthorInfo.length === Number(limit)
          },
          algorithm: smartFeed.metadata
        });

      } catch (smartFeedError) {
        console.error('❌ Smart feed error, falling back to traditional feed:', smartFeedError);
        // Fall through to traditional algorithm
      }
    }
    
    const skip = (page - 1) * limit;
    
    // Build query filters (traditional algorithm)
    const query = {
      isDeleted: { $ne: true } // Exclude deleted posts
    };
    
    // Filter by content type
    if (filter === 'nft') {
      query.isNFT = true;
    } else if (filter === 'ipfs') {
      query.contentCID = { $ne: '', $exists: true };
    }
    
    // Filter by following (if userId provided and following=true)
    if (following === 'true' && userId) {
      const Follow = require('../models/Follow');
      const followedUsers = await Follow.find({ followerId: userId }).select('followingId');
      const followedIds = followedUsers.map(f => f.followingId);
      query.authorId = { $in: followedIds };
    }
    
    // Build sort criteria
    let sortCriteria = {};
    switch (sort) {
      case 'popular':
        sortCriteria = { likesCount: -1, commentCount: -1, timestamp: -1 };
        break;
      case 'trending':
        // Trending: combination of recent + engagement
        // Posts from last 7 days, sorted by engagement
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        query.timestamp = { $gte: sevenDaysAgo };
        sortCriteria = { 
          likesCount: -1, 
          commentCount: -1, 
          timestamp: -1 
        };
        break;
      case 'smart':
      case 'latest':
      default:
        sortCriteria = { timestamp: -1 };
    }
    
    if (following === 'true' && userId) {
      const Follow = require('../models/Follow');
      const followedUsers = await Follow.find({ followerId: userId }).select('followingId');
      const followedIds = followedUsers.map(f => f.followingId);
      query.authorId = { $in: followedIds };
    }
    
    const totalPosts = await Post.countDocuments(query);
    let posts = await Post.find(query)
      .sort(sortCriteria)
      .skip(skip)
      .limit(Number(limit));
    
    // Populate author information from User model
    const User = require('../models/User');
    const Comment = require('../models/Comment');
    const postsWithAuthorInfo = await Promise.all(
      posts.map(async (post) => {
        const postObj = post.toObject();
        try {
          const user = await User.findOne({ walletAddress: post.authorId });
          if (user) {
            // Update post with latest user info
            postObj.authorName = user.username || user.displayName || '';
            postObj.authorAvatar = user.avatar || '';
            postObj.author = user.walletAddress; // Ensure author field is set
          } else {
            // Fallback if user not found
            postObj.author = post.authorId;
          }
        } catch (err) {
          console.error(`Error fetching user for post ${post._id}:`, err);
          postObj.author = post.authorId;
        }

        // Recalculate comment count from actual comments in database
        try {
          const actualCommentCount = await Comment.countDocuments({
            postId: post._id,
            status: { $ne: 'deleted' } // Don't count deleted comments
          });
          postObj.commentCount = actualCommentCount;
        } catch (err) {
          console.error(`Error calculating comment count for post ${post._id}:`, err);
          // Fall back to stored count if there's an error
        }

        return postObj;
      })
    );
    
    res.json({
      success: true,
      posts: postsWithAuthorInfo,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasNext: skip + posts.length < totalPosts,
        hasPrev: page > 1
      },
      filters: {
        sort,
        filter,
        following: following === 'true'
      }
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get post by ID with IPFS content retrieval
router.get("/posts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fetchFromIPFS = 'true' } = req.query; // Option to disable IPFS fetch
    
    const post = await Post.findById(id);
    if (!post || post.isDeleted) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    
    // Populate author information from User model
    const User = require('../models/User');
    const Comment = require('../models/Comment');
    const postObj = post.toObject();
    try {
      const user = await User.findOne({ walletAddress: post.authorId });
      if (user) {
        postObj.authorName = user.username || user.displayName || '';
        postObj.authorAvatar = user.avatar || '';
        postObj.author = user.walletAddress;
      } else {
        postObj.author = post.authorId;
      }
    } catch (err) {
      console.error(`Error fetching user for post ${post._id}:`, err);
      postObj.author = post.authorId;
    }

    // Recalculate comment count from actual comments in database
    try {
      const actualCommentCount = await Comment.countDocuments({
        postId: post._id,
        status: { $ne: 'deleted' } // Don't count deleted comments
      });
      postObj.commentCount = actualCommentCount;
    } catch (err) {
      console.error(`Error calculating comment count for post ${post._id}:`, err);
      // Fall back to stored count if there's an error
    }
    
    // If post has contentCID and IPFS fetch is enabled, try to get content from IPFS
    if (post.contentCID && fetchFromIPFS === 'true') {
      try {
        console.log(`🔄 Fetching post content from IPFS: ${post.contentCID}`);
        const ipfsContent = await ipfsService.fetchFromIPFS(post.contentCID);
        
        // Return post with IPFS content merged
        res.json({ 
          success: true, 
          post: {
            ...postObj,
            ipfsContent, // Full decentralized content
            source: 'ipfs'
          }
        });
        return;
      } catch (ipfsError) {
        console.warn(`⚠️ Failed to fetch from IPFS, using database fallback:`, ipfsError.message);
        // Continue to return database content as fallback
      }
    }
    
    // Return database content (fallback or when IPFS fetch disabled)
    res.json({ 
      success: true, 
      post: {
        ...postObj,
        source: post.contentCID ? 'database-fallback' : 'database'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new post with IPFS-first storage and AI moderation
router.post("/posts", enforceBanRestrictions, checkPostRestrictions, async (req, res) => {
  try {
    const {
      content,
      mediaUrl,
      mediaCID,
      mintNFT,
      author,
      authorName,
      transactionHash, // NFT transaction hash from blockchain
      ipfsHash, // Legacy field
      skipModeration = false // Admin override
    } = req.body;
    
    // Validate required fields
    if (!author) {
      return res.status(400).json({ 
        success: false, 
        error: "Author wallet address is required" 
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Post content is required" 
      });
    }

    // Find user to get their username and avatar
    const user = await User.findOne({ walletAddress: author });
    let displayName = authorName;
    let avatarUrl = '';
    
    if (user) {
      // Get display name
      if (user.username) {
        displayName = user.username;
      } else if (user.displayName) {
        displayName = user.displayName;
      }
      
      // Get avatar URL
      if (user.avatar) {
        avatarUrl = user.avatar;
      } else if (user.avatarIpfsHash) {
        avatarUrl = `https://gateway.pinata.cloud/ipfs/${user.avatarIpfsHash}`;
      } else {
        // Generate avatar from wallet address
        avatarUrl = `https://avatars.dicebear.com/api/identicon/${author}.svg`;
      }
    } else if (!displayName) {
      // Create a shortened version of the wallet address
      displayName = `${author.slice(0, 6)}...${author.slice(-4)}`;
      avatarUrl = `https://avatars.dicebear.com/api/identicon/${author}.svg`;
    }

    console.log('📝 Creating post:', {
      author,
      displayName,
      avatarUrl,
      contentLength: content.length,
      hasMedia: !!mediaUrl || !!mediaCID,
      isNFT: !!mintNFT
    });

    // ✨ NEW: AI MODERATION STEP
    let moderationResult = null;
    let postStatus = 'approved'; // default
    
    if (!skipModeration) {
      const startTime = Date.now();
      
      // Get user history for context
      const userHistory = await getUserModerationHistory(author);
      
      // Run AI moderation (text only)
      console.log('🤖 Running AI moderation for content...');
      moderationResult = await aiService.moderateContent(
        content, 
        userHistory
      );
      
      const processingTime = Date.now() - startTime;
      console.log('🤖 AI moderation result:', {
        action: moderationResult.action,
        flagged: moderationResult.flagged,
        confidence: moderationResult.confidence,
        method: moderationResult.method,
        processingTime: `${processingTime}ms`
      });

      // Determine post status based on AI result
      if (moderationResult.action === 'flag') {
        console.log('🚫 Content flagged - REJECTING POST');
        console.log(`   Reason: ${moderationResult.reason}`);
        console.log(`   Confidence: ${(moderationResult.confidence * 100).toFixed(1)}%`);

        // Warn user - don't save the post
        return res.status(400).json({
          success: false,
          error: 'Your content was flagged as inappropriate and cannot be posted',
          reason: moderationResult.reason,
          confidence: moderationResult.confidence,
          message: 'Please review your content and try again with different text'
        });
      } else if (moderationResult.action === 'review') {
        postStatus = 'review_needed';
        console.log('⚠️ Content marked for human review');
      } else {
        postStatus = 'approved';
        console.log('✅ Content approved by AI moderation');
      }
    } else {
      console.log('⚠️ AI moderation skipped (admin override)');
    }

    // ✨ Upload complete post content to IPFS
    let contentCID = '';
    try {
      const postData = {
        content,
        mediaCID: mediaCID || '',
        authorId: author,
        authorName: displayName,
        authorAvatar: avatarUrl,
        timestamp: new Date().toISOString(),
        isNFT: !!mintNFT,
        moderated: !skipModeration,
        status: postStatus
      };
      
      contentCID = await ipfsService.uploadPostContent(postData);
      console.log('✅ Complete post content uploaded to IPFS:', contentCID);
    } catch (ipfsError) {
      console.error('⚠️ Failed to upload post content to IPFS:', ipfsError.message);
      // Continue - content will be stored in database as fallback
    }

    const post = new Post({
      authorId: author,
      contentCID: contentCID, // Primary: IPFS CID for complete post JSON
      content: content, // Cache: for search and fallback
      mediaCID: mediaCID || '', // IPFS CID for media file
      mediaUrl: mediaUrl || "", // Legacy/fallback
      ipfsHash: ipfsHash || contentCID, // Legacy field
      isNFT: mintNFT || false,
      transactionHash: transactionHash || "", // NFT transaction hash
      authorName: displayName,
      authorAvatar: avatarUrl,
      status: postStatus, // Add moderation status
      flagged: moderationResult?.flagged || false
    });
    
    await post.save();
    
    // ✨ Save AI moderation result to database
    if (moderationResult && !skipModeration) {
      const aiModerationRecord = new AIModeration({
        contentId: post._id,
        contentType: 'post',
        contentText: content,
        contentImageUrl: mediaUrl || (mediaCID ? `https://gateway.pinata.cloud/ipfs/${mediaCID}` : null),
        authorAddress: author,
        analysis: {
          action: moderationResult.action,
          confidence: moderationResult.confidence,
          approved: postStatus === 'approved',
          flagged: moderationResult.action === 'flag',
          provider: moderationResult.provider || 'multi-tier',
          primaryReason: moderationResult.reason,
          details: moderationResult.details || {
            rules: {},
            huggingFace: {}
          },
          processingTime: Date.now()
        }
      });

      await aiModerationRecord.save();
      console.log('📊 AI moderation record saved:', aiModerationRecord._id);
    }

    // ✨ Create moderation flag if content was flagged
    if ((postStatus === 'flagged' || postStatus === 'review_needed') && moderationResult) {
      // Map AI reason to valid category - default to 'other' if no reason
      let categoryToUse = 'other';
      if (moderationResult.reason) {
        categoryToUse = mapReasonToCategory(moderationResult.reason);
      }

      // Ensure category is valid (safety check)
      const validCategories = ['spam', 'harassment', 'hate_speech', 'violence', 'adult_content', 'misinformation', 'copyright', 'scam', 'off_topic', 'duplicate_content', 'other'];
      if (!validCategories.includes(categoryToUse)) {
        categoryToUse = 'other';
      }

      const moderationFlag = new ModerationFlag({
        contentId: post._id,
        contentType: 'post',
        contentSnapshot: {
          text: content,
          imageUrl: mediaUrl || (mediaCID ? `https://gateway.pinata.cloud/ipfs/${mediaCID}` : null),
          author: {
            address: author,
            username: displayName,
            avatarCID: user?.avatarIpfsHash || null
          },
          originalCreatedAt: post.createdAt
        },
        flaggedBy: {
          source: 'ai_automatic',
          aiModerationId: null
        },
        severity: moderationResult.confidence > 0.8 ? 'high' :
                  moderationResult.confidence > 0.6 ? 'medium' : 'low',
        categories: [categoryToUse],
        description: `AI detected: ${moderationResult.reason || 'Content requires review'}${
          moderationResult.details?.flag_reasons ?
          ' - ' + (Array.isArray(moderationResult.details.flag_reasons) ?
            moderationResult.details.flag_reasons.join(', ') :
            moderationResult.details.flag_reasons.toString())
          : ''
        }`,
        evidence: {
          aiAnalysis: moderationResult,
          userReports: [],
          similarContent: []
        },
        status: 'pending',
        priority: moderationResult.confidence > 0.8 ? 8 : 5,
        review: {
          requiresCommunityVote: moderationResult.confidence < 0.9
        }
      });

      await moderationFlag.save();
      console.log('🚩 Moderation flag created:', moderationFlag._id);

      // ✨ AI-GOVERNANCE BRIDGE: Check if governance proposal should be created
      const userHistory = {
        postCount: await Post.countDocuments({ author: author }),
        reputation: 75, // Default reputation, could be calculated
        previousFlags: await ModerationFlag.countDocuments({
          'contentSnapshot.author.address': author,
          status: { $in: ['upheld', 'upheld_by_community'] }
        })
      };

      // Check if this flagging should trigger a governance proposal
      // TODO: Implement governance proposal functionality
      /*
      if (aiService.shouldCreateGovernanceProposal(moderationResult, userHistory)) {
        console.log('🏛️ AI flagging triggered governance proposal creation');
        
        try {
          const proposal = await aiService.createModerationProposal(moderationFlag);
          if (proposal) {
            console.log('✅ Governance proposal created:', proposal._id);
            
            // Update the moderation flag to reference the proposal
            moderationFlag.proposal = proposal._id;
            moderationFlag.communityReview = true;
            await moderationFlag.save();
            
            // Add proposal info to response
            response.governance = {
              proposalCreated: true,
              proposalId: proposal._id,
              message: 'Community vote triggered for this moderation decision'
            };
          }
        } catch (error) {
          console.error('❌ Failed to create governance proposal:', error);
          // Don't fail the post creation, just log the error
        }
      } else {
        console.log('ℹ️ Governance proposal not needed for this flag');
      }
      */
    }
    
    console.log('✅ Post saved to database:', post._id);
    console.log('   - ContentCID:', contentCID);
    console.log('   - MediaCID:', mediaCID);
    console.log('   - Status:', postStatus);
    
    const response = { 
      success: true, 
      post,
      contentCID,
      ipfsUrls: contentCID ? ipfsService.getIpfsUrls(contentCID) : [],
      moderation: {
        status: postStatus,
        flagged: moderationResult?.flagged || false,
        confidence: moderationResult?.confidence || null,
        method: moderationResult?.method || 'none'
      }
    };

    // Add warning message for flagged content
    if (postStatus === 'flagged') {
      response.message = 'Your post has been flagged for community review. You will be notified of the decision.';
      response.canAppeal = true;
    }

    res.status(201).json(response);
    
  } catch (error) {
    console.error('❌ Error creating post:', error);
    console.error('Error stack:', error.stack);
    console.error('Error type:', error.constructor.name);
    res.status(500).json({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      details: process.env.NODE_ENV !== 'production' ? error.stack : 'See server logs'
    });
  }
});

// Like a post (with user tracking)
router.post("/posts/:id/like", enforceBanRestrictions, async (req, res) => {
  try {
    const { id } = req.params;
    const { userAddress } = req.body;
    
    if (!userAddress) {
      return res.status(400).json({ 
        success: false, 
        error: "User address is required" 
      });
    }
    
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    
    // Check if user already liked this post
    const existingLike = await Like.findOne({ postId: id, userId: userAddress });
    if (existingLike) {
      return res.status(400).json({ 
        success: false, 
        error: "You have already liked this post" 
      });
    }
    
    // Create new like
    const like = new Like({
      postId: id,
      userId: userAddress
    });
    await like.save();
    
    // Update post likes count
    post.likesCount = (post.likesCount || 0) + 1;
    await post.save();
    
    console.log(`👍 User ${userAddress.slice(0, 8)}... liked post ${id}`);
    // Create notification for post author
    try {
      if (post.authorId) {
        // Fetch user info for the person who liked
        const liker = await User.findOne({ walletAddress: userAddress.toLowerCase() });
        const likerInfo = {
          address: userAddress,
          username: liker?.username || liker?.displayName || userAddress.slice(0, 8) + '...',
          avatar: liker?.avatar || `https://avatars.dicebear.com/api/identicon/${userAddress}.svg`
        };
        
        await notificationService.createNotification({
          type: 'like',
          recipient: post.authorId,
          sender: likerInfo,
          content: { postId: post._id }
        });
      }
    } catch (nerr) {
      console.error('Notification error (like):', nerr);
    }

    res.json({ 
      success: true, 
      likesCount: post.likesCount,
      hasLiked: true
    });
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unlike a post
router.delete("/posts/:id/like", enforceBanRestrictions, async (req, res) => {
  try {
    const { id } = req.params;
    const { userAddress } = req.body;
    
    if (!userAddress) {
      return res.status(400).json({ 
        success: false, 
        error: "User address is required" 
      });
    }
    
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    
    // Find and delete the like
    const like = await Like.findOneAndDelete({ postId: id, userId: userAddress });
    if (!like) {
      return res.status(404).json({ 
        success: false, 
        error: "Like not found" 
      });
    }
    
    // Update post likes count
    post.likesCount = Math.max((post.likesCount || 0) - 1, 0);
    await post.save();
    
    console.log(`👎 User ${userAddress.slice(0, 8)}... unliked post ${id}`);
    
    res.json({ 
      success: true, 
      likesCount: post.likesCount,
      hasLiked: false
    });
  } catch (error) {
    console.error("Error unliking post:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check if user has liked a post
router.get("/posts/:id/like/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { userAddress } = req.query;
    
    if (!userAddress) {
      return res.json({ success: true, hasLiked: false });
    }
    
    const like = await Like.findOne({ postId: id, userId: userAddress });
    res.json({ 
      success: true, 
      hasLiked: !!like 
    });
  } catch (error) {
    console.error("Error checking like status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a comment on a post
router.post("/posts/:id/comments", enforceBanRestrictions, checkCommentRestrictions, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, authorAddress, authorName } = req.body;
    
    if (!authorAddress) {
      return res.status(400).json({ 
        success: false, 
        error: "Author address is required" 
      });
    }
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Comment content is required" 
      });
    }
    
    if (content.length > 500) {
      return res.status(400).json({ 
        success: false, 
        error: "Comment is too long (max 500 characters)" 
      });
    }
    
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    
    // Get user info
    const user = await User.findOne({ walletAddress: authorAddress });
    let displayName = authorName || '';
    let avatarUrl = '';
    
    if (user) {
      displayName = user.username || user.displayName || displayName;
      avatarUrl = user.avatar || user.avatarIpfsHash ? 
        `https://gateway.pinata.cloud/ipfs/${user.avatarIpfsHash}` : 
        `https://avatars.dicebear.com/api/identicon/${authorAddress}.svg`;
    } else {
      displayName = displayName || `${authorAddress.slice(0, 6)}...${authorAddress.slice(-4)}`;
      avatarUrl = `https://avatars.dicebear.com/api/identicon/${authorAddress}.svg`;
    }
    
    // 🤖 AI MODERATION FOR COMMENTS
    console.log('🤖 Running AI moderation for comment...');
    const moderationResult = await aiService.moderateContent(content.trim());
    
    console.log('🤖 Comment moderation result:', {
      action: moderationResult.action,
      flagged: moderationResult.action === 'flag',
      confidence: moderationResult.confidence,
      provider: moderationResult.provider
    });

    // Determine comment status based on moderation result
    let commentStatus = 'approved';
    if (moderationResult.action === 'flag') {
      commentStatus = 'flagged';
    }

    // Create comment with moderation data
    const comment = new Comment({
      postId: id,
      authorId: authorAddress,
      authorName: displayName,
      authorAvatar: avatarUrl,
      content: content.trim(),
      status: commentStatus,
      flagged: moderationResult.action === 'flag',
      moderationScore: moderationResult.confidence,
      moderationProvider: moderationResult.provider,
      moderationReason: moderationResult.reason
    });

    await comment.save();
    
    // 🚩 PROCESS VIOLATIONS AND USER CONSEQUENCES
    let violationResult = null;
    if (moderationResult.action === 'flag') {
      console.log('🚩 Processing user violation for flagged comment...');
      violationResult = await processModerationViolation(
        authorAddress,
        comment._id,
        'comment',
        moderationResult,
        content.trim()
      );
      
      if (violationResult) {
        console.log(`⚠️ User violation processed: ${violationResult.consequenceLevel}`);
        
        // 📧 CREATE MODERATION NOTIFICATION
        try {
          await createModerationNotification(
            authorAddress,
            violationResult.consequenceLevel,
            comment._id,
            'comment',
            content.trim(),
            moderationResult
          );
        } catch (notifError) {
          console.error('Failed to create moderation notification:', notifError);
        }
      }
    }
    
    // Update post comment count (only for approved comments)
    if (commentStatus === 'approved') {
      post.commentCount = (post.commentCount || 0) + 1;
      await post.save();
    }
    
    console.log(`💬 Comment ${commentStatus} for post ${id} by ${authorAddress.slice(0, 8)}...`);
    
    // Create notification for post author (only for approved comments)
    if (commentStatus === 'approved' && post.authorId && post.authorId !== authorAddress) {
      try {
        await notificationService.createNotification({
          type: 'comment',
          recipient: post.authorId,
          sender: { address: authorAddress, username: displayName, avatar: avatarUrl },
          content: { postId: post._id, commentId: comment._id, commentText: comment.content }
        });
      } catch (nerr) {
        console.error('Notification error (comment):', nerr);
      }
    }

    // Prepare response based on comment status
    if (commentStatus === 'flagged') {
      // Enhanced user notification for flagged content
      let banMessage = 'Your comment has been flagged for violating community guidelines and will not be visible.';
      let actionSteps = [
        'Review our community guidelines',
        'Future violations may result in account restrictions'
      ];
      let appealInfo = null;
      let notificationType = 'warning';
      
      if (violationResult) {
        switch (violationResult.consequenceLevel) {
          case 'warning':
            banMessage = '⚠️ Warning: Your comment violated our community guidelines and has been removed. This is your first warning.';
            actionSteps = [
              'This is a formal warning for inappropriate content',
              'Review our community guidelines to understand acceptable behavior',
              'Future violations may result in temporary or permanent restrictions',
              'You can appeal this decision if you believe it was made in error'
            ];
            notificationType = 'warning';
            break;
            
          case 'temp_restriction':
            const hours = Math.ceil((new Date(violationResult.restrictionDetails?.restrictedUntil) - new Date()) / (1000 * 60 * 60));
            banMessage = `🚫 Your account has been temporarily restricted for ${hours} hour(s) due to repeated community guideline violations.`;
            actionSteps = [
              'Your comment has been removed and flagged as inappropriate',
              `You cannot post or comment for ${hours} hour(s)`,
              'This restriction is due to repeated violations of our guidelines',
              'Use this time to review our community standards',
              'You can appeal this decision through the appeals process'
            ];
            appealInfo = {
              canAppeal: true,
              appealDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              instructions: 'Submit an appeal explaining why you believe this restriction was applied incorrectly'
            };
            notificationType = 'restriction';
            break;
            
          case 'permanent_ban':
            banMessage = '🔒 Your account has been permanently restricted from posting and commenting due to severe or repeated violations of our community guidelines.';
            actionSteps = [
              'Your comment contained content that severely violates our community standards',
              'This permanent restriction affects your ability to post and comment',
              'Common violations include hate speech, harassment, threats, or spam',
              'You have 30 days to appeal this decision',
              'Appeals are reviewed by human moderators',
              'Creating new accounts to circumvent this ban is prohibited'
            ];
            appealInfo = {
              canAppeal: true,
              appealDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              instructions: 'Submit a detailed appeal explaining your case. Include context and evidence that supports your appeal.',
              email: 'appeals@cribsocial.com',
              formUrl: '/appeals/submit'
            };
            notificationType = 'ban';
            break;
        }
      }
      
      const response = {
        success: false,
        error: 'Comment blocked',
        message: banMessage,
        moderation: {
          status: commentStatus,
          flagged: true,
          confidence: moderationResult.confidence,
          provider: moderationResult.provider,
          violationType: moderationResult.reason || 'Community guidelines violation',
          detectedContent: 'Inappropriate content detected by AI moderation'
        },
        userGuidance: {
          type: notificationType,
          actionSteps: actionSteps,
          appeal: appealInfo,
          resources: {
            guidelines: '/community-guidelines',
            appeals: '/appeals',
            support: 'support@cribsocial.com',
            faq: '/help/content-policy'
          }
        }
      };
      
      // Add detailed violation info if applicable
      if (violationResult) {
        response.violation = {
          level: violationResult.consequenceLevel,
          violationId: violationResult.violationId,
          restrictionDetails: violationResult.restrictionDetails,
          canAppeal: appealInfo?.canAppeal || false,
          appealDeadline: appealInfo?.appealDeadline || null
        };
      }
      
      return res.status(400).json(response);
    }
    
    // For approved comments, return normal response
    const response = { 
      success: true, 
      comment,
      commentCount: post.commentCount,
      moderation: {
        status: commentStatus,
        flagged: false,
        confidence: moderationResult.confidence,
        provider: moderationResult.provider
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function for consequence messages
function getConsequenceMessage(level, restrictions) {
  switch (level) {
    case 'warning':
      return 'You have received a warning for violating community guidelines. Please review our guidelines to avoid further violations.';
    case 'temp_restriction':
      const hours = Math.ceil((new Date(restrictions.restrictedUntil) - new Date()) / (1000 * 60 * 60));
      return `You have been temporarily restricted from posting and commenting for ${hours} hour(s) due to repeated violations.`;
    case 'suspension':
    case 'permanent_ban':
      return 'Your account has been suspended for severe or repeated violations of community guidelines. You may appeal this decision.';
    default:
      return 'Please follow community guidelines to maintain a positive environment for all users.';
  }
}

// Update post NFT status after minting
router.patch("/posts/:id/nft", enforceBanRestrictions, async (req, res) => {
  try {
    const { id } = req.params;
    const { nftTokenId, transactionHash } = req.body;

    console.log(`🎯 NFT Update Request - Post ID: ${id}`);
    console.log(`   nftTokenId: ${nftTokenId}`);
    console.log(`   transactionHash: ${transactionHash}`);

    if (!nftTokenId || !transactionHash) {
      console.error('❌ Missing NFT data:', { nftTokenId, transactionHash });
      return res.status(400).json({
        success: false,
        error: "nftTokenId and transactionHash are required"
      });
    }

    const post = await Post.findById(id);
    if (!post) {
      console.error(`❌ Post not found: ${id}`);
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    // Update NFT fields
    post.isNFT = true;
    post.nftTokenId = nftTokenId;
    post.transactionHash = transactionHash;
    await post.save();

    console.log(`✅ Post ${id} updated as NFT - Token ID: ${nftTokenId}, TX: ${transactionHash}`);

    res.json({
      success: true,
      post: {
        _id: post._id,
        isNFT: post.isNFT,
        nftTokenId: post.nftTokenId,
        transactionHash: post.transactionHash
      }
    });
  } catch (error) {
    console.error('Error updating NFT status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get comments for a post
router.get("/posts/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }
    
    const skip = (page - 1) * limit;
    // Only count and return approved comments (hide flagged/hidden comments)
    const totalComments = await Comment.countDocuments({ 
      postId: id, 
      status: 'approved' 
    });
    const comments = await Comment.find({ 
      postId: id, 
      status: 'approved' 
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    res.json({
      success: true,
      comments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / limit),
        totalComments,
        hasNext: skip + comments.length < totalComments,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a comment
router.delete("/comments/:commentId", enforceBanRestrictions, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userAddress } = req.body;
    
    if (!userAddress) {
      return res.status(400).json({ 
        success: false, 
        error: "User address is required" 
      });
    }
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: "Comment not found" });
    }
    
    // Check if user is the author
    if (comment.authorId !== userAddress) {
      return res.status(403).json({ 
        success: false, 
        error: "You can only delete your own comments" 
      });
    }
    
    const postId = comment.postId;
    await Comment.findByIdAndDelete(commentId);
    
    // Clean up related governance cases
    try {
      const governanceCleanupService = require('../services/governanceCleanupService');
      
      const cleanupResult = await governanceCleanupService.cleanupCasesForDeletedContent(
        commentId, 
        'comment', 
        'Comment deleted by author', 
        userAddress
      );

      if (cleanupResult.cleanedUpCases > 0) {
        console.log(`✅ Comment governance cleanup: ${cleanupResult.cleanedUpCases} cases resolved, ${cleanupResult.deletedVotes} votes removed`);
      }
      
    } catch (governanceError) {
      console.error('❌ Error cleaning up governance cases for comment:', governanceError);
      // Continue with comment deletion even if governance cleanup fails
    }
    
    // Update post comment count
    const post = await Post.findById(postId);
    if (post) {
      post.commentCount = Math.max((post.commentCount || 0) - 1, 0);
      await post.save();
    }
    
    console.log(`🗑️ Comment ${commentId} deleted by ${userAddress.slice(0, 8)}...`);
    
    res.json({ 
      success: true, 
      message: "Comment deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get posts by author
router.get("/posts/author/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const totalPosts = await Post.countDocuments({ authorId: address, isDeleted: { $ne: true } });
    let posts = await Post.find({ authorId: address, isDeleted: { $ne: true } }).sort({ timestamp: -1 }).skip(skip).limit(Number(limit));
    
    // Populate author information from User model
    const User = require('../models/User');
    const postsWithAuthorInfo = await Promise.all(
      posts.map(async (post) => {
        const postObj = post.toObject();
        try {
          const user = await User.findOne({ walletAddress: post.authorId });
          if (user) {
            postObj.authorName = user.username || user.displayName || '';
            postObj.authorAvatar = user.avatar || '';
            postObj.author = user.walletAddress;
          } else {
            postObj.author = post.authorId;
          }
        } catch (err) {
          console.error(`Error fetching user for post ${post._id}:`, err);
          postObj.author = post.authorId;
        }
        return postObj;
      })
    );
    
    res.json({
      success: true,
      posts: postsWithAuthorInfo,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search posts
router.get("/search", async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    if (!q) {
      return res.status(400).json({ 
        success: false, 
        error: "Search query is required" 
      });
    }
    const skip = (page - 1) * limit;
    const query = {
      $and: [
        { isDeleted: { $ne: true } }, // Exclude deleted posts
        {
          $or: [
            { content: { $regex: q, $options: 'i' } },
            { authorName: { $regex: q, $options: 'i' } }
          ]
        }
      ]
    };
    const totalResults = await Post.countDocuments(query);
    const posts = await Post.find(query).sort({ timestamp: -1 }).skip(skip).limit(Number(limit));
    res.json({
      success: true,
      posts,
      query: q,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalResults / limit),
        totalResults
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create moderation notification for user violations
 */
async function createModerationNotification(userAddress, consequenceLevel, contentId, contentType, content, moderationResult) {
  try {
    // Get user violation record to get violation details
    const userRecord = await UserViolation.findOne({ userAddress });
    const latestViolation = userRecord?.violations[userRecord.violations.length - 1];
    
    const violationData = {
      contentId,
      contentType,
      violationType: latestViolation?.violationType || 'toxic_language',
      violatingContent: content,
      severity: latestViolation?.severity || 'medium'
    };

    // Use the new escalation-specific notification methods
    switch (consequenceLevel) {
      case 'warning':
        if (typeof notificationService.notifyModerationWarning === 'function') {
          await notificationService.notifyModerationWarning(userAddress, violationData);
          console.log(`📧 Warning notification sent to ${userAddress.slice(0, 12)}... (1st strike)`);
        } else {
          console.error('❌ notifyModerationWarning method not found');
        }
        break;
        
      case 'temp_ban':
        const banDetails = {
          banHours: userRecord?.restrictions?.tempBanHours || 24,
          restrictedUntil: userRecord?.restrictions?.restrictedUntil
        };
        if (typeof notificationService.notifyModerationTempBan === 'function') {
          await notificationService.notifyModerationTempBan(userAddress, violationData, banDetails);
          console.log(`📧 Temporary ban notification sent to ${userAddress.slice(0, 12)}... (2nd strike - ${banDetails.banHours}h ban)`);
        } else {
          console.error('❌ notifyModerationTempBan method not found');
        }
        break;
        
      case 'permanent_ban':
        if (typeof notificationService.notifyModerationPermanentBan === 'function') {
          await notificationService.notifyModerationPermanentBan(userAddress, violationData);
          console.log(`📧 Permanent ban notification sent to ${userAddress.slice(0, 12)}... (3rd strike - permanent)`);
        } else {
          console.error('❌ notifyModerationPermanentBan method not found');
        }
        break;
        
      // Legacy support for old system
      case 'temp_restriction':
        const legacyBanDetails = {
          banHours: 24,
          restrictedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
        await notificationService.notifyModerationTempBan(userAddress, violationData, legacyBanDetails);
        console.log(`📧 Legacy temp restriction notification sent to ${userAddress.slice(0, 12)}...`);
        break;
        
      default:
        console.warn(`⚠️ Unknown consequence level: ${consequenceLevel}, falling back to warning`);
        await notificationService.notifyModerationWarning(userAddress, violationData);
        break;
    }
    
    return { success: true, consequenceLevel, escalationLevel: getEscalationLevel(consequenceLevel) };
  } catch (error) {
    console.error('Error creating moderation notification:', error);
    throw error;
  }
}

// Helper function to map consequence levels to escalation levels
function getEscalationLevel(consequenceLevel) {
  switch (consequenceLevel) {
    case 'warning': return 1;
    case 'temp_ban':
    case 'temp_restriction': return 2;
    case 'permanent_ban': return 3;
    default: return 1;
  }
}

// DELETE POST ENDPOINT
router.delete("/posts/:id", auth, enforceBanRestrictions, async (req, res) => {
  try {
    const { id } = req.params;

    // Get user wallet address from middleware or request body
    const userId = req.user?.address ||
                   req.headers['x-wallet-address'] ||
                   req.headers['x-user-address'] ||
                   req.body.userId ||
                   req.body.walletAddress ||
                   req.body.userAddress ||
                   req.body.authorAddress ||
                   req.body.author;

    if (!userId) {
      console.error('❌ No userId found in request');
      console.log('   req.user:', req.user);
      console.log('   req.body:', req.body);
      console.log('   req.headers:', Object.keys(req.headers));
      return res.status(401).json({
        success: false,
        error: "User authentication required",
        details: "Could not determine user identity"
      });
    }

    console.log(`🗑️ Delete request for post ${id} from user ${userId}`);

    // Find the post
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found"
      });
    }

    // Check if user owns the post (case-insensitive comparison)
    const normalizedAuthorId = post.authorId?.toLowerCase();
    const normalizedUserId = userId.toLowerCase();

    console.log(`   Post author: ${normalizedAuthorId}, Request user: ${normalizedUserId}`);

    if (normalizedAuthorId !== normalizedUserId) {
      return res.status(403).json({
        success: false,
        error: "You can only delete your own posts"
      });
    }

    // Check if post is already deleted
    if (post.isDeleted) {
      return res.status(409).json({
        success: false,
        error: "Post is already deleted"
      });
    }

    // Soft delete the post (mark as deleted instead of removing from DB)
    await Post.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedReason: 'User deletion'
    });

    // Clean up related governance cases
    try {
      const governanceCleanupService = require('../services/governanceCleanupService');

      const cleanupResult = await governanceCleanupService.cleanupCasesForDeletedContent(
        id,
        'post',
        'Content deleted by author',
        userId
      );

      if (cleanupResult.cleanedUpCases > 0) {
        console.log(`✅ Governance cleanup completed: ${cleanupResult.cleanedUpCases} cases resolved, ${cleanupResult.deletedVotes} votes removed`);
      }

    } catch (governanceError) {
      console.error('❌ Error cleaning up governance cases:', governanceError);
      // Continue with post deletion even if governance cleanup fails
    }

    // Optional: Delete associated files from IPFS/Pinata
    try {
      const cidsToDelete = [
        post.mediaCID,
        post.contentCID, 
        post.metadataCID,
        post.ipfsHash
      ].filter(cid => cid && cid.trim() !== '');

      if (cidsToDelete.length > 0 && process.env.PINATA_JWT) {
        const axios = require('axios');
        for (const cid of cidsToDelete) {
          try {
            await axios.delete(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
              headers: {
                'Authorization': `Bearer ${process.env.PINATA_JWT}`,
                'Content-Type': 'application/json'
              }
            });
            console.log(`🗑️ Deleted CID ${cid} from Pinata`);
          } catch (pinataError) {
            console.log(`⚠️ Could not delete CID ${cid} from Pinata:`, pinataError.response?.data?.error || pinataError.message);
          }
        }
      }
    } catch (cleanupError) {
      console.warn('⚠️ Error cleaning up IPFS files:', cleanupError);
      // Continue with post deletion even if cleanup fails
    }

    // Send success response
    res.json({
      success: true,
      message: "Post deleted successfully",
      postId: id
    });

  } catch (error) {
    console.error('❌ Error deleting post:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: "Failed to delete post",
      details: error.message,
      errorType: error.constructor.name
    });
  }
});

module.exports = router;
