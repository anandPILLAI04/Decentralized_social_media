/**
 * Smart Feed Algorithm Service
 * Advanced AI-powered content recommendations using collaborative filtering,
 * user behavior analysis, and engagement prediction
 */

const Post = require('../models/Post');
const User = require('../models/User');
const Like = require('../models/Like');
const Follow = require('../models/Follow');
const Comment = require('../models/Comment');
const AIModeration = require('../models/AIModeration');
const logger = require('../utils/logger');

class SmartFeedService {
  constructor() {
    this.ENGAGEMENT_WEIGHTS = {
      like: 1.0,
      comment: 2.0,
      share: 1.5,
      view: 0.1,
      follow_author: 3.0
    };

    this.TIME_DECAY_FACTOR = 0.5; // How much to decay scores over time
    this.CONTENT_QUALITY_WEIGHT = 0.25;
    this.SOCIAL_SIGNAL_WEIGHT = 0.30;
    this.FRESHNESS_WEIGHT = 0.25;
    this.QUALITY_WEIGHT = 0.20;
  }

  /**
   * Generate personalized feed for a user
   */
  async generatePersonalizedFeed(userId, options = {}) {
    const {
      limit = 20,
      page = 1,
      includeFollowing = true,
      includeTrending = true,
      includeRecommended = true
    } = options;

    logger.info(`🤖 Generating personalized feed for user: ${userId}`);

    try {
      // Get user's interaction history
      const userProfile = await this.buildUserProfile(userId);
      
      // Get candidate posts
      const candidates = await this.getCandidatePosts(userId, {
        includeFollowing,
        includeTrending,
        includeRecommended,
        limit: limit * 3 // Get more candidates for better filtering
      });

      // Score and rank posts
      const scoredPosts = await this.scoreAndRankPosts(candidates, userProfile);

      // Apply diversity and freshness
      const diversePosts = await this.applyDiversityFilter(scoredPosts, userProfile);

      // Paginate results
      const skip = (page - 1) * limit;
      const finalPosts = diversePosts.slice(skip, skip + limit);

      logger.info(`📊 Feed generated: ${finalPosts.length} posts`);
      
      return {
        posts: finalPosts,
        metadata: {
          algorithm: 'smart_feed_v1',
          userProfile: userProfile.summary,
          totalCandidates: candidates.length,
          finalCount: finalPosts.length
        }
      };

    } catch (error) {
      logger.error('❌ Smart feed generation error:', error);
      // Fallback to chronological feed
      return await this.getFallbackFeed(userId, { limit, page });
    }
  }

  /**
   * Build comprehensive user profile from interactions
   */
  async buildUserProfile(userId) {
    try {
      const profile = {
        userId,
        interests: {},
        authorPreferences: {},
        contentTypes: {},
        engagementPatterns: {},
        summary: {}
      };

      // Analyze liked posts
      const likedPosts = await Like.find({ userId: userId })
        .populate('postId')
        .limit(100)
        .sort({ timestamp: -1 });

      // Analyze comments
      const userComments = await Comment.find({ authorId: userId })
        .populate('postId')
        .limit(50)
        .sort({ timestamp: -1 });

      // Analyze followed users
      const following = await Follow.find({ followerId: userId })
        .limit(100);

      // Extract interests from content
      await this.extractInterests(profile, likedPosts, userComments);
      
      // Calculate author preferences
      await this.calculateAuthorPreferences(profile, likedPosts, following);
      
      // Analyze content type preferences
      await this.analyzeContentTypePreferences(profile, likedPosts);
      
      // Calculate engagement patterns
      await this.analyzeEngagementPatterns(profile, likedPosts, userComments);

      // Generate profile summary
      profile.summary = {
        totalInteractions: likedPosts.length + userComments.length,
        topInterests: Object.entries(profile.interests)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([interest]) => interest),
        preferredAuthors: Object.entries(profile.authorPreferences)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([author]) => author),
        engagementScore: this.calculateOverallEngagement(profile)
      };

      return profile;

    } catch (error) {
      logger.error('❌ Error building user profile:', error);
      return this.getDefaultProfile(userId);
    }
  }

  /**
   * Extract user interests from content interactions
   */
  async extractInterests(profile, likedPosts, comments) {
    const interests = {};

    // Analyze liked post content
    likedPosts.forEach(like => {
      if (like.postId) {
        const content = like.postId.content || '';
        const words = content.toLowerCase().match(/\b\w+\b/g) || [];
        
        words.forEach(word => {
          if (word.length > 3) { // Filter short words
            interests[word] = (interests[word] || 0) + 1;
          }
        });

        // Analyze hashtags
        const hashtags = content.match(/#[\w]+/g) || [];
        hashtags.forEach(tag => {
          interests[tag.toLowerCase()] = (interests[tag.toLowerCase()] || 0) + 2;
        });
      }
    });

    // Analyze comment content
    comments.forEach(comment => {
      if (comment.postId) {
        const content = comment.content || '';
        const words = content.toLowerCase().match(/\b\w+\b/g) || [];
        
        words.forEach(word => {
          if (word.length > 3) {
            interests[word] = (interests[word] || 0) + 0.5; // Comments weighted less
          }
        });
      }
    });

    profile.interests = interests;
  }

  /**
   * Calculate author preferences based on interactions
   */
  async calculateAuthorPreferences(profile, likedPosts, following) {
    const authorPrefs = {};

    // Weight from likes
    likedPosts.forEach(like => {
      if (like.postId && like.postId.authorId) {
        const author = like.postId.authorId;
        authorPrefs[author] = (authorPrefs[author] || 0) + 1;
      }
    });

    // Weight from follows (higher weight)
    following.forEach(follow => {
      const author = follow.followingId;
      authorPrefs[author] = (authorPrefs[author] || 0) + 5;
    });

    profile.authorPreferences = authorPrefs;
  }

  /**
   * Analyze content type preferences
   */
  async analyzeContentTypePreferences(profile, likedPosts) {
    const contentTypes = {
      text: 0,
      image: 0,
      nft: 0,
      ipfs: 0,
      short: 0, // < 100 chars
      medium: 0, // 100-500 chars
      long: 0 // > 500 chars
    };

    likedPosts.forEach(like => {
      if (like.postId) {
        const post = like.postId;
        
        if (post.imageCID) contentTypes.image++;
        if (post.isNFT) contentTypes.nft++;
        if (post.contentCID) contentTypes.ipfs++;
        
        const contentLength = (post.content || '').length;
        if (contentLength < 100) contentTypes.short++;
        else if (contentLength < 500) contentTypes.medium++;
        else contentTypes.long++;
        
        if (!post.imageCID && !post.isNFT) contentTypes.text++;
      }
    });

    profile.contentTypes = contentTypes;
  }

  /**
   * Analyze engagement patterns and timing
   */
  async analyzeEngagementPatterns(profile, likedPosts, comments) {
    const patterns = {
      timeOfDay: {},
      dayOfWeek: {},
      engagementTypes: {},
      responseTime: []
    };

    // Analyze like patterns
    likedPosts.forEach(like => {
      const date = new Date(like.timestamp);
      const hour = date.getHours();
      const day = date.getDay();
      
      patterns.timeOfDay[hour] = (patterns.timeOfDay[hour] || 0) + 1;
      patterns.dayOfWeek[day] = (patterns.dayOfWeek[day] || 0) + 1;
      patterns.engagementTypes.likes = (patterns.engagementTypes.likes || 0) + 1;
    });

    // Analyze comment patterns
    comments.forEach(comment => {
      const date = new Date(comment.timestamp);
      const hour = date.getHours();
      const day = date.getDay();
      
      patterns.timeOfDay[hour] = (patterns.timeOfDay[hour] || 0) + 2; // Comments weighted higher
      patterns.dayOfWeek[day] = (patterns.dayOfWeek[day] || 0) + 2;
      patterns.engagementTypes.comments = (patterns.engagementTypes.comments || 0) + 1;
    });

    profile.engagementPatterns = patterns;
  }

  /**
   * Get candidate posts for recommendation
   */
  async getCandidatePosts(userId, options) {
    const candidates = [];
    
    // Following feed (if enabled)
    if (options.includeFollowing) {
      const followingPosts = await this.getFollowingPosts(userId, options.limit);
      candidates.push(...followingPosts);
    }

    // Trending posts (if enabled)
    if (options.includeTrending) {
      const trendingPosts = await this.getTrendingPosts(options.limit);
      candidates.push(...trendingPosts);
    }

    // Recommended posts (if enabled)
    if (options.includeRecommended) {
      const recommendedPosts = await this.getRecommendedPosts(userId, options.limit);
      candidates.push(...recommendedPosts);
    }

    // Remove duplicates
    const uniquePosts = candidates.reduce((acc, post) => {
      if (!acc.some(p => p._id.toString() === post._id.toString())) {
        acc.push(post);
      }
      return acc;
    }, []);

    return uniquePosts;
  }

  /**
   * Get posts from followed users
   */
  async getFollowingPosts(userId, limit) {
    try {
      const following = await Follow.find({ followerId: userId });
      const followedIds = following.map(f => f.followingId);
      
      if (followedIds.length === 0) return [];

      const posts = await Post.find({ 
        authorId: { $in: followedIds },
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

      return posts.map(post => ({ ...post, source: 'following' }));

    } catch (error) {
      logger.error('❌ Error getting following posts:', error);
      return [];
    }
  }

  /**
   * Get trending posts based on engagement
   */
  async getTrendingPosts(limit) {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const posts = await Post.find({
        timestamp: { $gte: oneDayAgo }
      })
      .sort({ 
        likesCount: -1,
        commentCount: -1,
        timestamp: -1 
      })
      .limit(limit)
      .lean();

      return posts.map(post => ({ ...post, source: 'trending' }));

    } catch (error) {
      logger.error('❌ Error getting trending posts:', error);
      return [];
    }
  }

  /**
   * Get recommended posts based on collaborative filtering
   */
  async getRecommendedPosts(userId, limit) {
    try {
      // Find users with similar interests
      const similarUsers = await this.findSimilarUsers(userId, 10);
      
      if (similarUsers.length === 0) {
        return await this.getPopularPosts(limit);
      }

      // Get posts liked by similar users
      const similarUserIds = similarUsers.map(u => u.userId);
      const recentLikes = await Like.find({
        userId: { $in: similarUserIds },
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
      .populate('postId')
      .limit(limit * 2);

      // Filter out posts user already interacted with
      const userLikes = await Like.find({ userId: userId });
      const userLikedPostIds = new Set(userLikes.map(like => like.postId?.toString()));

      const recommendedPosts = recentLikes
        .filter(like => like.postId && !userLikedPostIds.has(like.postId._id.toString()))
        .map(like => ({ ...like.postId.toObject(), source: 'collaborative' }))
        .slice(0, limit);

      return recommendedPosts;

    } catch (error) {
      logger.error('❌ Error getting recommended posts:', error);
      return [];
    }
  }

  /**
   * Score and rank posts based on user profile
   */
  async scoreAndRankPosts(posts, userProfile) {
    // Batch-load moderation data to avoid N+1 queries (1 query instead of N)
    const postIds = posts.map(p => p._id).filter(Boolean);
    const moderationResults = await AIModeration.find({ postId: { $in: postIds } }).lean();
    const moderationMap = new Map();
    moderationResults.forEach(m => {
      moderationMap.set(m.postId.toString(), m);
    });

    const scoredPosts = posts.map(post => {
      const scores = {
        content: this.calculateContentScoreSync(post, userProfile),
        social: this.calculateSocialScoreSync(post),
        freshness: this.calculateFreshnessScore(post),
        quality: this.calculateQualityScoreFromCache(post, moderationMap.get(post._id?.toString()))
      };

      const totalScore = (
        scores.content * this.CONTENT_QUALITY_WEIGHT +
        scores.social * this.SOCIAL_SIGNAL_WEIGHT +
        scores.freshness * this.FRESHNESS_WEIGHT +
        scores.quality * this.QUALITY_WEIGHT
      );

      return {
        ...post,
        _scores: scores,
        _totalScore: totalScore
      };
    });

    return scoredPosts.sort((a, b) => b._totalScore - a._totalScore);
  }

  /**
   * Calculate content relevance score (sync version for batch processing)
   */
  calculateContentScoreSync(post, userProfile) {
    let score = 0;
    const content = (post.content || '').toLowerCase();
    const words = content.match(/\b\w+\b/g) || [];

    words.forEach(word => {
      if (userProfile.interests[word]) {
        score += userProfile.interests[word] * 0.1;
      }
    });

    const hashtags = content.match(/#[\w]+/g) || [];
    hashtags.forEach(tag => {
      if (userProfile.interests[tag.toLowerCase()]) {
        score += userProfile.interests[tag.toLowerCase()] * 0.2;
      }
    });

    if (userProfile.authorPreferences[post.authorId]) {
      score += userProfile.authorPreferences[post.authorId] * 0.3;
    }

    return Math.min(score / 10, 1);
  }

  /**
   * Calculate social signals score (sync version for batch processing)
   */
  calculateSocialScoreSync(post) {
    const engagementScore = (
      (post.likesCount || 0) * 1.0 +
      (post.commentCount || 0) * 2.0 +
      (post.shareCount || 0) * 1.5
    ) / 10;

    return Math.min(engagementScore, 1);
  }

  /**
   * Calculate quality score using pre-loaded moderation data (no DB query)
   */
  calculateQualityScoreFromCache(post, moderation) {
    let score = 0.5;

    if (moderation) {
      if (!moderation.analysis?.flagged) {
        score += 0.3;
      }
      if (moderation.analysis?.confidence > 0.8) {
        score += 0.2;
      }
    }

    const contentLength = (post.content || '').length;
    if (contentLength >= 50 && contentLength <= 500) {
      score += 0.1;
    }

    if (post.imageCID || post.isNFT) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Calculate content relevance score
   */
  async calculateContentScore(post, userProfile) {
    let score = 0;
    const content = (post.content || '').toLowerCase();
    const words = content.match(/\b\w+\b/g) || [];

    // Match against user interests
    words.forEach(word => {
      if (userProfile.interests[word]) {
        score += userProfile.interests[word] * 0.1;
      }
    });

    // Check hashtags
    const hashtags = content.match(/#[\w]+/g) || [];
    hashtags.forEach(tag => {
      if (userProfile.interests[tag.toLowerCase()]) {
        score += userProfile.interests[tag.toLowerCase()] * 0.2;
      }
    });

    // Author preference
    if (userProfile.authorPreferences[post.authorId]) {
      score += userProfile.authorPreferences[post.authorId] * 0.3;
    }

    return Math.min(score / 10, 1); // Normalize to 0-1
  }

  /**
   * Calculate social signals score
   */
  async calculateSocialScore(post, userProfile) {
    const engagementScore = (
      (post.likesCount || 0) * 1.0 +
      (post.commentCount || 0) * 2.0 +
      (post.shareCount || 0) * 1.5
    ) / 10;

    return Math.min(engagementScore, 1); // Normalize to 0-1
  }

  /**
   * Calculate freshness score based on post age
   */
  calculateFreshnessScore(post) {
    const now = Date.now();
    const postTime = new Date(post.timestamp).getTime();
    const ageInHours = (now - postTime) / (1000 * 60 * 60);
    
    // Exponential decay: newer posts get higher scores
    return Math.exp(-ageInHours * this.TIME_DECAY_FACTOR / 24);
  }

  /**
   * Calculate content quality score
   */
  async calculateQualityScore(post) {
    let score = 0.5; // Base score

    // Check AI moderation results
    try {
      const moderation = await AIModeration.findOne({ postId: post._id });
      if (moderation) {
        if (!moderation.analysis.flagged) {
          score += 0.3;
        }
        
        // Higher confidence in AI decisions = higher quality
        if (moderation.analysis.confidence > 0.8) {
          score += 0.2;
        }
      }
    } catch (error) {
      logger.info('Quality score calculation error:', error.message);
    }

    // Content length (sweet spot around 100-300 chars)
    const contentLength = (post.content || '').length;
    if (contentLength >= 50 && contentLength <= 500) {
      score += 0.1;
    }

    // Has media
    if (post.imageCID || post.isNFT) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Apply diversity filter to avoid echo chambers
   */
  async applyDiversityFilter(posts, userProfile) {
    const diversePosts = [];
    const authorCounts = {};
    const contentTypeCounts = {};
    
    for (const post of posts) {
      const author = post.authorId;
      const contentType = this.getContentType(post);
      
      // Limit posts per author
      if ((authorCounts[author] || 0) >= 3) continue;
      
      // Ensure content type diversity
      if ((contentTypeCounts[contentType] || 0) >= Math.ceil(posts.length * 0.4)) continue;
      
      diversePosts.push(post);
      authorCounts[author] = (authorCounts[author] || 0) + 1;
      contentTypeCounts[contentType] = (contentTypeCounts[contentType] || 0) + 1;
      
      if (diversePosts.length >= posts.length * 0.8) break; // Keep top 80%
    }

    return diversePosts;
  }

  /**
   * Find users with similar interests
   */
  async findSimilarUsers(userId, limit = 10) {
    try {
      // Get users who liked similar posts
      const userLikes = await Like.find({ userId: userId }).limit(50);
      const likedPostIds = userLikes.map(like => like.postId);

      if (likedPostIds.length === 0) return [];

      // Find other users who liked the same posts
      const similarLikes = await Like.find({
        postId: { $in: likedPostIds },
        userId: { $ne: userId }
      });

      // Count overlaps
      const userOverlaps = {};
      similarLikes.forEach(like => {
        userOverlaps[like.userId] = (userOverlaps[like.userId] || 0) + 1;
      });

      // Sort by overlap count
      const similarUsers = Object.entries(userOverlaps)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([userId, overlap]) => ({ userId, overlap }));

      return similarUsers;

    } catch (error) {
      logger.error('❌ Error finding similar users:', error);
      return [];
    }
  }

  /**
   * Get popular posts as fallback
   */
  async getPopularPosts(limit) {
    try {
      const posts = await Post.find({
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      })
      .sort({ likesCount: -1, commentCount: -1 })
      .limit(limit)
      .lean();

      return posts.map(post => ({ ...post, source: 'popular' }));

    } catch (error) {
      logger.error('❌ Error getting popular posts:', error);
      return [];
    }
  }

  /**
   * Fallback feed when smart algorithm fails
   */
  async getFallbackFeed(userId, options) {
    try {
      const posts = await Post.find({})
        .sort({ timestamp: -1 })
        .limit(options.limit)
        .skip((options.page - 1) * options.limit)
        .lean();

      return {
        posts: posts.map(post => ({ ...post, source: 'fallback' })),
        metadata: {
          algorithm: 'fallback_chronological',
          fallback: true
        }
      };

    } catch (error) {
      logger.error('❌ Fallback feed error:', error);
      return { posts: [], metadata: { error: true } };
    }
  }

  /**
   * Helper methods
   */
  getContentType(post) {
    if (post.isNFT) return 'nft';
    if (post.imageCID) return 'image';
    if (post.contentCID) return 'ipfs';
    return 'text';
  }

  calculateOverallEngagement(profile) {
    const totalInteractions = Object.values(profile.engagementPatterns.engagementTypes || {})
      .reduce((sum, count) => sum + count, 0);
    return Math.min(totalInteractions / 100, 1); // Normalize
  }

  getDefaultProfile(userId) {
    return {
      userId,
      interests: {},
      authorPreferences: {},
      contentTypes: {},
      engagementPatterns: {},
      summary: {
        totalInteractions: 0,
        topInterests: [],
        preferredAuthors: [],
        engagementScore: 0
      }
    };
  }
}

module.exports = new SmartFeedService();