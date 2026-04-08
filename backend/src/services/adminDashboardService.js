/**
 * Admin Dashboard Service
 * Provides comprehensive analytics and monitoring for platform administrators
 */

const Post = require('../models/Post');
const User = require('../models/User');
const AIModeration = require('../models/AIModeration');
const ModerationFlag = require('../models/ModerationFlag');
const GovernanceCase = require('../models/GovernanceCase');
const CommunityVote = require('../models/CommunityVote');
const Appeal = require('../models/Appeal');
const Notification = require('../models/Notification');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const Follow = require('../models/Follow');

class AdminDashboardService {
  constructor() {
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    this.cache = new Map();
  }

  /**
   * Get comprehensive platform overview
   */
  async getPlatformOverview(timeframe = '7d') {
    const cacheKey = `platform_overview_${timeframe}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    try {
      const timeframeDays = this.parseTimeframe(timeframe);
      const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

      console.log(`📊 Generating platform overview for ${timeframe}`);

      const [
        userStats,
        contentStats,
        moderationStats,
        governanceStats,
        engagementStats,
        systemHealth
      ] = await Promise.all([
        this.getUserStatistics(startDate),
        this.getContentStatistics(startDate),
        this.getModerationStatistics(startDate),
        this.getGovernanceStatistics(startDate),
        this.getEngagementStatistics(startDate),
        this.getSystemHealthMetrics()
      ]);

      const overview = {
        timestamp: new Date(),
        timeframe,
        summary: {
          totalUsers: userStats.total,
          activeUsers: userStats.active,
          totalPosts: contentStats.posts.total,
          dailyActiveUsers: userStats.dailyActive,
          moderationAccuracy: moderationStats.accuracy,
          governanceParticipation: governanceStats.participationRate
        },
        users: userStats,
        content: contentStats,
        moderation: moderationStats,
        governance: governanceStats,
        engagement: engagementStats,
        systemHealth
      };

      // Cache the result
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: overview
      });

      return overview;

    } catch (error) {
      console.error('❌ Error generating platform overview:', error);
      throw error;
    }
  }

  /**
   * Get detailed user analytics
   */
  async getUserStatistics(startDate) {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        newUsers,
        activeUsers,
        dailyActiveUsers,
        topContributors,
        userGrowth,
        retentionRate
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ createdAt: { $gte: startDate } }),
        this.getActiveUsers(startDate),
        this.getActiveUsers(oneDayAgo),
        this.getTopContributors(startDate),
        this.getUserGrowthTrend(startDate),
        this.calculateRetentionRate(startDate)
      ]);

      return {
        total: totalUsers,
        new: newUsers,
        active: activeUsers,
        dailyActive: dailyActiveUsers,
        growth: {
          newUsers,
          growthRate: totalUsers > 0 ? (newUsers / totalUsers) * 100 : 0,
          trend: userGrowth
        },
        retention: retentionRate,
        topContributors
      };

    } catch (error) {
      console.error('❌ Error getting user statistics:', error);
      return {};
    }
  }

  /**
   * Get content creation and distribution statistics
   */
  async getContentStatistics(startDate) {
    try {
      const [
        totalPosts,
        newPosts,
        totalComments,
        newComments,
        contentTypes,
        topPosts,
        contentQuality
      ] = await Promise.all([
        Post.countDocuments(),
        Post.countDocuments({ timestamp: { $gte: startDate } }),
        Comment.countDocuments(),
        Comment.countDocuments({ timestamp: { $gte: startDate } }),
        this.getContentTypeDistribution(startDate),
        this.getTopPerformingContent(startDate),
        this.getContentQualityMetrics(startDate)
      ]);

      return {
        posts: {
          total: totalPosts,
          new: newPosts,
          avgPerDay: Math.round(newPosts / this.parseTimeframe('7d'))
        },
        comments: {
          total: totalComments,
          new: newComments,
          avgPerDay: Math.round(newComments / this.parseTimeframe('7d'))
        },
        distribution: contentTypes,
        topContent: topPosts,
        quality: contentQuality
      };

    } catch (error) {
      console.error('❌ Error getting content statistics:', error);
      return {};
    }
  }

  /**
   * Get comprehensive moderation analytics
   */
  async getModerationStatistics(startDate) {
    try {
      const [
        totalModerations,
        flaggedContent,
        appealStats,
        accuracyMetrics,
        moderationTrends,
        aiPerformance
      ] = await Promise.all([
        AIModeration.countDocuments({ createdAt: { $gte: startDate } }),
        this.getFlaggedContentStats(startDate),
        this.getAppealStatistics(startDate),
        this.getModerationAccuracy(startDate),
        this.getModerationTrends(startDate),
        this.getAIPerformanceMetrics(startDate)
      ]);

      return {
        total: totalModerations,
        flagged: flaggedContent,
        appeals: appealStats,
        accuracy: accuracyMetrics.overall,
        trends: moderationTrends,
        aiPerformance,
        breakdown: {
          automated: totalModerations,
          humanReview: appealStats.total,
          escalatedToGovernance: appealStats.escalated
        }
      };

    } catch (error) {
      console.error('❌ Error getting moderation statistics:', error);
      return {};
    }
  }

  /**
   * Get moderation trends over time
   */
  async getModerationTrends(startDate) {
    try {
      const trends = await AIModeration.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt'
              }
            },
            total: { $sum: 1 },
            flagged: {
              $sum: { $cond: [{ $eq: ['$analysis.flagged', true] }, 1, 0] }
            },
            avgConfidence: { $avg: '$analysis.confidence' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      return trends;
    } catch (error) {
      console.error('Error getting moderation trends:', error);
      return [];
    }
  }

  /**
   * Get AI performance metrics
   */
  async getAIPerformanceMetrics(startDate) {
    try {
      const metrics = await AIModeration.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$method',
            count: { $sum: 1 },
            avgConfidence: { $avg: '$analysis.confidence' },
            flaggedRate: {
              $avg: { $cond: [{ $eq: ['$analysis.flagged', true] }, 1, 0] }
            }
          }
        }
      ]);

      return {
        byMethod: metrics,
        overall: {
          totalAnalyses: metrics.reduce((sum, m) => sum + m.count, 0),
          avgConfidence: metrics.reduce((sum, m) => sum + m.avgConfidence, 0) / metrics.length || 0,
          flaggedRate: metrics.reduce((sum, m) => sum + m.flaggedRate, 0) / metrics.length || 0
        }
      };
    } catch (error) {
      console.error('Error getting AI performance metrics:', error);
      return {
        byMethod: [],
        overall: { totalAnalyses: 0, avgConfidence: 0, flaggedRate: 0 }
      };
    }
  }

  /**
   * Get governance participation and effectiveness metrics
   */
  async getGovernanceStatistics(startDate) {
    try {
      const [
        totalCases,
        activeCases,
        totalVotes,
        participationMetrics,
        executionStats,
        topVoters
      ] = await Promise.all([
        GovernanceCase.countDocuments({ createdAt: { $gte: startDate } }),
        GovernanceCase.countDocuments({ status: 'VOTING_ACTIVE' }),
        CommunityVote.countDocuments({ createdAt: { $gte: startDate } }),
        this.getGovernanceParticipation(startDate),
        this.getExecutionStatistics(startDate),
        this.getTopVoters(startDate)
      ]);

      return {
        cases: {
          total: totalCases,
          active: activeCases,
          resolved: executionStats.resolved,
          rejected: executionStats.rejected
        },
        votes: {
          total: totalVotes,
          avgPerCase: totalCases > 0 ? Math.round(totalVotes / totalCases) : 0
        },
        participation: participationMetrics,
        execution: executionStats,
        topVoters,
        participationRate: participationMetrics.rate
      };

    } catch (error) {
      console.error('Error getting governance statistics:', error);
      return {};
    }
  }

  /**
   * Get user engagement metrics
   */
  async getEngagementStatistics(startDate) {
    try {
      const [
        totalLikes,
        totalShares,
        engagementRate,
        activeDiscussions,
        topEngaged
      ] = await Promise.all([
        Like.countDocuments({ timestamp: { $gte: startDate } }),
        this.getShareCount(startDate),
        this.calculateEngagementRate(startDate),
        this.getActiveDiscussions(startDate),
        this.getTopEngagedUsers(startDate)
      ]);

      return {
        likes: totalLikes,
        shares: totalShares,
        comments: await Comment.countDocuments({ timestamp: { $gte: startDate } }),
        rate: engagementRate,
        discussions: activeDiscussions,
        topEngaged
      };

    } catch (error) {
      console.error('❌ Error getting engagement statistics:', error);
      return {};
    }
  }

  /**
   * Get system health and performance metrics
   */
  async getSystemHealthMetrics() {
    try {
      const [
        dbHealth,
        apiPerformance,
        errorRates,
        resourceUsage
      ] = await Promise.all([
        this.checkDatabaseHealth(),
        this.getAPIPerformance(),
        this.getErrorRates(),
        this.getResourceUsage()
      ]);

      return {
        database: dbHealth,
        api: apiPerformance,
        errors: errorRates,
        resources: resourceUsage,
        overall: this.calculateOverallHealth(dbHealth, apiPerformance, errorRates)
      };

    } catch (error) {
      console.error('❌ Error getting system health metrics:', error);
      return {
        overall: 'unknown',
        error: error.message
      };
    }
  }

  /**
   * Get AI moderation performance analytics
   */
  async getAIModerationAnalytics(timeframe = '7d') {
    try {
      const timeframeDays = this.parseTimeframe(timeframe);
      const startDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

      const [
        accuracyMetrics,
        confidenceDistribution,
        flagReasons,
        falsePositives,
        processingTimes,
        appealOutcomes
      ] = await Promise.all([
        this.getDetailedAccuracyMetrics(startDate),
        this.getConfidenceDistribution(startDate),
        this.getFlagReasonBreakdown(startDate),
        this.getFalsePositiveRate(startDate),
        this.getProcessingTimeMetrics(startDate),
        this.getAppealOutcomeAnalysis(startDate)
      ]);

      return {
        accuracy: accuracyMetrics,
        confidence: confidenceDistribution,
        flagReasons,
        falsePositives,
        processingTimes,
        appeals: appealOutcomes,
        recommendations: this.generateAIRecommendations(accuracyMetrics, falsePositives, appealOutcomes)
      };

    } catch (error) {
      console.error('❌ Error getting AI moderation analytics:', error);
      throw error;
    }
  }

  /**
   * Get real-time platform alerts
   */
  async getPlatformAlerts() {
    try {
      const alerts = [];
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Check for unusual activity spikes
      const recentPosts = await Post.countDocuments({ timestamp: { $gte: oneHourAgo } });
      if (recentPosts > 100) { // Threshold for concern
        alerts.push({
          type: 'high_activity',
          severity: 'warning',
          message: `High post creation rate: ${recentPosts} posts in the last hour`,
          timestamp: now,
          metric: 'content_creation'
        });
      }

      // Check for moderation overload
      const recentModerations = await AIModeration.countDocuments({ 
        createdAt: { $gte: oneHourAgo },
        'analysis.flagged': true
      });
      if (recentModerations > 50) {
        alerts.push({
          type: 'moderation_overload',
          severity: 'high',
          message: `High moderation flag rate: ${recentModerations} flags in the last hour`,
          timestamp: now,
          metric: 'moderation'
        });
      }

      // Check for governance cases approaching deadline with low votes
      const urgentCases = await GovernanceCase.countDocuments({
        status: 'VOTING_ACTIVE',
        votingDeadline: {
          $lte: new Date(now.getTime() + 6 * 60 * 60 * 1000) // 6 hours
        }
      });
      if (urgentCases > 0) {
        alerts.push({
          type: 'governance_deadline',
          severity: 'medium',
          message: `${urgentCases} governance case(s) approaching deadline`,
          timestamp: now,
          metric: 'governance'
        });
      }

      // Check for appeal backlog
      const pendingAppeals = await Appeal.countDocuments({ 
        status: { $in: ['pending', 'under_review'] } 
      });
      if (pendingAppeals > 20) {
        alerts.push({
          type: 'appeal_backlog',
          severity: 'medium',
          message: `Appeal backlog: ${pendingAppeals} pending appeals`,
          timestamp: now,
          metric: 'appeals'
        });
      }

      return {
        alerts,
        count: alerts.length,
        lastUpdated: now
      };

    } catch (error) {
      console.error('❌ Error getting platform alerts:', error);
      return { alerts: [], count: 0, error: error.message };
    }
  }

  /**
   * Helper methods
   */

  async getActiveUsers(startDate) {
    const activeUsers = await Post.distinct('authorId', { timestamp: { $gte: startDate } });
    const activeCommenters = await Comment.distinct('authorId', { timestamp: { $gte: startDate } });
    const activeVoters = await CommunityVote.distinct('voterAddress', { createdAt: { $gte: startDate } });
    
    const allActive = new Set([...activeUsers, ...activeCommenters, ...activeVoters]);
    return allActive.size;
  }

  async getTopContributors(startDate, limit = 10) {
    const contributors = await Post.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: '$authorId',
          postCount: { $sum: 1 },
          totalLikes: { $sum: '$likesCount' },
          totalComments: { $sum: '$commentCount' }
        }
      },
      {
        $project: {
          address: '$_id',
          posts: '$postCount',
          engagement: { $add: ['$totalLikes', '$totalComments'] },
          score: {
            $add: [
              { $multiply: ['$postCount', 2] },
              '$totalLikes',
              { $multiply: ['$totalComments', 1.5] }
            ]
          }
        }
      },
      { $sort: { score: -1 } },
      { $limit: limit }
    ]);

    return contributors;
  }

  async getModerationAccuracy(startDate) {
    const appeals = await Appeal.find({
      submittedAt: { $gte: startDate },
      status: { $in: ['approved', 'rejected'] }
    });

    const total = appeals.length;
    if (total === 0) return { overall: 100, total: 0 };

    const overturned = appeals.filter(appeal => appeal.status === 'approved').length;
    const accuracy = ((total - overturned) / total) * 100;

    return {
      overall: Math.round(accuracy * 100) / 100,
      total,
      overturned,
      upheld: total - overturned
    };
  }

  async getFlaggedContentStats(startDate) {
    const flaggedStats = await AIModeration.aggregate([
      { $match: { createdAt: { $gte: startDate }, 'analysis.flagged': true } },
      {
        $group: {
          _id: '$analysis.reason',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$analysis.confidence' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return flaggedStats;
  }

  async getAppealStatistics(startDate) {
    const [total, pending, approved, rejected, escalated] = await Promise.all([
      Appeal.countDocuments({ submittedAt: { $gte: startDate } }),
      Appeal.countDocuments({ 
        submittedAt: { $gte: startDate }, 
        status: { $in: ['pending', 'under_review'] } 
      }),
      Appeal.countDocuments({ 
        submittedAt: { $gte: startDate }, 
        status: 'approved' 
      }),
      Appeal.countDocuments({ 
        submittedAt: { $gte: startDate }, 
        status: 'rejected' 
      }),
      Appeal.countDocuments({ 
        submittedAt: { $gte: startDate }, 
        status: 'community_vote' 
      })
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
      escalated,
      resolutionRate: total > 0 ? ((approved + rejected) / total) * 100 : 0
    };
  }

  parseTimeframe(timeframe) {
    const number = parseInt(timeframe);
    const unit = timeframe.slice(-1);
    
    switch (unit) {
      case 'd': return number;
      case 'w': return number * 7;
      case 'm': return number * 30;
      case 'y': return number * 365;
      default: return 7; // Default to 7 days
    }
  }

  // Placeholder methods for comprehensive analytics
  async getUserGrowthTrend(startDate) {
    try {
      const weeklyGrowth = await User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const totalNew = weeklyGrowth.reduce((sum, d) => sum + d.count, 0);
      const daysCount = weeklyGrowth.length || 1;
      const avgPerDay = totalNew / daysCount;
      const trend = avgPerDay > 1 ? 'growing' : avgPerDay > 0 ? 'stable' : 'declining';

      return { trend, weeklyGrowth };
    } catch (error) {
      console.error('Error getting user growth trend:', error);
      return { trend: 'unknown', weeklyGrowth: [] };
    }
  }

  async calculateRetentionRate(startDate) {
    try {
      // Users who signed up in the period
      const newUsers = await User.find({ createdAt: { $gte: startDate } }).select('walletAddress createdAt');
      if (newUsers.length === 0) return { week1: 0, week4: 0, week12: 0, sampleSize: 0 };

      const newAddresses = newUsers.map(u => u.walletAddress);
      const oneWeekLater = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const fourWeeksLater = new Date(startDate.getTime() + 28 * 24 * 60 * 60 * 1000);

      // Check how many posted within 1 week and 4 weeks of signup
      const week1Active = await Post.distinct('authorId', {
        authorId: { $in: newAddresses },
        timestamp: { $gte: startDate, $lte: oneWeekLater }
      });
      const week4Active = await Post.distinct('authorId', {
        authorId: { $in: newAddresses },
        timestamp: { $gte: startDate, $lte: fourWeeksLater }
      });

      return {
        week1: Math.round((week1Active.length / newUsers.length) * 100),
        week4: Math.round((week4Active.length / newUsers.length) * 100),
        week12: 0, // Not enough data for 12-week retention in most timeframes
        sampleSize: newUsers.length
      };
    } catch (error) {
      console.error('Error calculating retention rate:', error);
      return { week1: 0, week4: 0, week12: 0, sampleSize: 0 };
    }
  }

  async getContentTypeDistribution(startDate) {
    const distribution = await Post.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: {
            hasImage: { $toBool: '$imageCID' },
            isNFT: '$isNFT',
            hasIPFS: { $toBool: '$contentCID' }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    return distribution;
  }

  async getTopPerformingContent(startDate, limit = 10) {
    return await Post.find({ timestamp: { $gte: startDate } })
      .sort({ likesCount: -1, commentCount: -1 })
      .limit(limit)
      .select('content authorId likesCount commentCount timestamp');
  }

  async getContentQualityMetrics(startDate) {
    try {
      const result = await Post.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            avgLength: { $avg: { $strLenCP: { $ifNull: ['$content', ''] } } },
            totalPosts: { $sum: 1 }
          }
        }
      ]);

      const flaggedCount = await AIModeration.countDocuments({
        createdAt: { $gte: startDate },
        'analysis.flagged': true
      });
      const totalCount = result[0]?.totalPosts || 1;

      return {
        avgLength: Math.round(result[0]?.avgLength || 0),
        qualityScore: 0, // No meaningful aggregate quality score without per-post data
        spamRate: Math.round((flaggedCount / totalCount) * 100 * 10) / 10
      };
    } catch (error) {
      console.error('Error getting content quality metrics:', error);
      return { avgLength: 0, qualityScore: 0, spamRate: 0 };
    }
  }

  async getGovernanceParticipation(startDate) {
    try {
      const uniqueVoters = await CommunityVote.distinct('voterAddress', {
        createdAt: { $gte: startDate }
      });
      const totalVotes = await CommunityVote.countDocuments({ createdAt: { $gte: startDate } });
      const totalUsers = await User.countDocuments();
      const avgVotesPerUser = uniqueVoters.length > 0 ? totalVotes / uniqueVoters.length : 0;
      const rate = totalUsers > 0 ? (uniqueVoters.length / totalUsers) * 100 : 0;

      return {
        rate: Math.round(rate * 10) / 10,
        uniqueVoters: uniqueVoters.length,
        avgVotesPerUser: Math.round(avgVotesPerUser * 10) / 10
      };
    } catch (error) {
      console.error('Error getting governance participation:', error);
      return { rate: 0, uniqueVoters: 0, avgVotesPerUser: 0 };
    }
  }

  async getExecutionStatistics(startDate) {
    const [resolved, rejected, pending] = await Promise.all([
      GovernanceCase.countDocuments({ createdAt: { $gte: startDate }, status: 'RESOLVED' }),
      GovernanceCase.countDocuments({ createdAt: { $gte: startDate }, status: 'REJECTED' }),
      GovernanceCase.countDocuments({ createdAt: { $gte: startDate }, status: 'VOTING_ACTIVE' })
    ]);

    return { resolved, rejected, pending };
  }

  async getTopVoters(startDate, limit = 10) {
    const topVoters = await CommunityVote.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$voterAddress',
          voteCount: { $sum: 1 },
          totalWeight: { $sum: '$weight' }
        }
      },
      { $sort: { voteCount: -1 } },
      { $limit: limit }
    ]);

    return topVoters;
  }

  
  /**
   * Get comprehensive system health status
   */
  async getSystemHealth() {
    try {
      const [
        dbHealth,
        apiPerformance,
        errorRates,
        resourceUsage
      ] = await Promise.all([
        this.checkDatabaseHealth(),
        this.getAPIPerformance(),
        this.getErrorRates(),
        this.getResourceUsage()
      ]);

      const overallHealth = this.calculateOverallHealth(dbHealth, apiPerformance, errorRates);
      const alerts = await this.getSystemAlerts();

      return {
        health: {
          database: dbHealth,
          api: apiPerformance,
          errors: errorRates,
          resources: resourceUsage,
          overall: overallHealth
        },
        alerts: {
          alerts: alerts,
          count: alerts.length
        }
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      return {
        health: {
          database: 'unknown',
          api: { avgResponseTime: 0, uptime: 0 },
          errors: { rate: 100, critical: 1 },
          overall: 'unhealthy'
        },
        alerts: {
          alerts: [],
          count: 0
        }
      };
    }
  }

  /**
   * Get system alerts
   */
  async getSystemAlerts() {
    const alerts = [];
    
    try {
      // Check for high activity
      const recentPosts = await Post.countDocuments({
        timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
      });

      if (recentPosts > 100) {
        alerts.push({
          type: 'high_activity',
          severity: 'warning',
          message: `High post creation rate: ${recentPosts} posts in the last hour`,
          timestamp: new Date(),
          metric: 'content_creation'
        });
      }

      // Check for moderation backlog
      const pendingModerations = await AIModeration.countDocuments({
        'analysis.flagged': true,
        status: 'pending'
      });

      if (pendingModerations > 50) {
        alerts.push({
          type: 'moderation_backlog',
          severity: 'warning',
          message: `High moderation queue: ${pendingModerations} items pending`,
          timestamp: new Date(),
          metric: 'moderation'
        });
      }

    } catch (error) {
      console.error('Error getting alerts:', error);
    }

    return alerts;
  }

  // Additional analytics methods
  async getShareCount(startDate) {
    // No share tracking model exists yet; return 0
    return 0;
  }

  async calculateEngagementRate(startDate) {
    try {
      const totalPosts = await Post.countDocuments({ timestamp: { $gte: startDate } });
      if (totalPosts === 0) return 0;
      const totalLikes = await Like.countDocuments({ timestamp: { $gte: startDate } });
      const totalComments = await Comment.countDocuments({ timestamp: { $gte: startDate } });
      return Math.round(((totalLikes + totalComments) / totalPosts) * 100) / 100;
    } catch (error) {
      console.error('Error calculating engagement rate:', error);
      return 0;
    }
  }

  async getActiveDiscussions(startDate, limit = 10) {
    try {
      const discussions = await Comment.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$postId', commentCount: { $sum: 1 } } },
        { $sort: { commentCount: -1 } },
        { $limit: limit }
      ]);
      return discussions;
    } catch (error) {
      console.error('Error getting active discussions:', error);
      return [];
    }
  }

  async getTopEngagedUsers(startDate, limit = 10) {
    try {
      const users = await Like.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: '$userId', likeCount: { $sum: 1 } } },
        { $sort: { likeCount: -1 } },
        { $limit: limit }
      ]);
      return users;
    } catch (error) {
      console.error('Error getting top engaged users:', error);
      return [];
    }
  }

  async checkDatabaseHealth() {
    try {
      const mongoose = require('mongoose');
      const state = mongoose.connection.readyState;
      // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
      return state === 1 ? 'healthy' : state === 2 ? 'connecting' : 'unhealthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  async getAPIPerformance() {
    // Actual metrics require APM integration; return process uptime as a proxy
    const uptimeSeconds = process.uptime();
    return {
      avgResponseTime: 0, // Needs APM middleware to track
      uptime: Math.min(99.9, (uptimeSeconds / (uptimeSeconds + 1)) * 100)
    };
  }

  async getErrorRates() {
    // Without an error tracking store, we can't compute real rates
    return { rate: 0, critical: 0, note: 'Error tracking not instrumented' };
  }

  async getResourceUsage() {
    const mem = process.memoryUsage();
    return {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
      uptimeHours: Math.round(process.uptime() / 3600 * 10) / 10
    };
  }
  
  calculateOverallHealth(db, api, errors) {
    if (db === 'healthy' && api.uptime > 99 && errors.rate < 1) return 'healthy';
    if (db === 'healthy' && api.uptime > 95 && errors.rate < 5) return 'warning';
    return 'critical';
  }

  // AI-specific analytics methods
  async getDetailedAccuracyMetrics(startDate) {
    try {
      const accuracy = await this.getModerationAccuracy(startDate);
      return accuracy;
    } catch (error) {
      return { overall: 0, total: 0, overturned: 0, upheld: 0 };
    }
  }

  async getConfidenceDistribution(startDate) {
    try {
      const distribution = await AIModeration.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $bucket: {
            groupBy: '$analysis.confidence',
            boundaries: [0, 0.4, 0.7, 1.01],
            default: 'unknown',
            output: { count: { $sum: 1 } }
          }
        }
      ]);
      const total = distribution.reduce((s, d) => s + d.count, 0) || 1;
      const getCount = (min) => (distribution.find(d => d._id === min) || {}).count || 0;
      return {
        low: Math.round((getCount(0) / total) * 100),
        medium: Math.round((getCount(0.4) / total) * 100),
        high: Math.round((getCount(0.7) / total) * 100)
      };
    } catch (error) {
      return { high: 0, medium: 0, low: 0 };
    }
  }

  async getFlagReasonBreakdown(startDate) {
    return await this.getFlaggedContentStats(startDate);
  }

  async getFalsePositiveRate(startDate) {
    try {
      const accuracy = await this.getModerationAccuracy(startDate);
      return accuracy.total > 0 ? Math.round((accuracy.overturned / accuracy.total) * 100 * 10) / 10 : 0;
    } catch (error) {
      return 0;
    }
  }

  async getProcessingTimeMetrics(startDate) {
    // Processing time requires timestamps on moderation records; return 0 if not tracked
    return { avg: 0, p95: 0, note: 'Processing time tracking not instrumented' };
  }

  async getAppealOutcomeAnalysis(startDate) {
    return await this.getAppealStatistics(startDate);
  }
  
  generateAIRecommendations(accuracy, falsePositives, appeals) {
    const recommendations = [];
    
    if (accuracy.overall < 90) {
      recommendations.push({
        type: 'accuracy',
        priority: 'high',
        message: 'AI accuracy below threshold - consider retraining',
        action: 'retrain_model'
      });
    }
    
    if (falsePositives > 10) {
      recommendations.push({
        type: 'false_positives',
        priority: 'medium',
        message: 'High false positive rate detected',
        action: 'adjust_thresholds'
      });
    }
    
    return recommendations;
  }
}

module.exports = new AdminDashboardService();