/**
 * Governance Notification Scheduler
 * Handles scheduled governance notifications and reminders for case-based system
 */

const cron = require('node-cron');
const { notificationService } = require('./notificationService');
const GovernanceCase = require('../models/GovernanceCase');
const CommunityVote = require('../models/CommunityVote');
const logger = require('../utils/logger');

class GovernanceScheduler {
  constructor() {
    this.isRunning = false;
    this.scheduledJobs = new Map();
  }

  start() {
    if (this.isRunning) {
      logger.info('Governance scheduler already running');
      return;
    }

    logger.info('Starting governance notification scheduler');
    this.isRunning = true;

    // Schedule deadline reminders every hour
    const deadlineJob = cron.schedule('0 * * * *', async () => {
      await this.processDeadlineReminders();
    }, { scheduled: false, timezone: "UTC" });

    // Schedule cleanup of old notifications daily at midnight
    const cleanupJob = cron.schedule('0 0 * * *', async () => {
      await this.cleanupOldNotifications();
    }, { scheduled: false, timezone: "UTC" });

    deadlineJob.start();
    cleanupJob.start();

    this.scheduledJobs.set('deadlines', deadlineJob);
    this.scheduledJobs.set('cleanup', cleanupJob);

    logger.info('Governance scheduler started with 2 jobs');
  }

  stop() {
    if (!this.isRunning) {
      logger.info('Governance scheduler not running');
      return;
    }

    logger.info('Stopping governance notification scheduler');

    this.scheduledJobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped ${name} job`);
    });

    this.scheduledJobs.clear();
    this.isRunning = false;

    logger.info('Governance scheduler stopped');
  }

  async processDeadlineReminders() {
    try {
      logger.info('Processing governance deadline reminders...');
      await notificationService.scheduleGovernanceReminders();
    } catch (error) {
      logger.error('Error processing deadline reminders:', error);
    }
  }

  async cleanupOldNotifications() {
    try {
      logger.info('Cleaning up old notifications...');

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const Notification = require('../models/Notification');
      const result = await Notification.deleteMany({
        timestamp: { $lt: thirtyDaysAgo },
        read: true
      });

      logger.info(`Cleaned up ${result.deletedCount} old notifications`);

    } catch (error) {
      logger.error('Error cleaning up notifications:', error);
    }
  }

  async sendManualReminder(caseId) {
    try {
      const governanceCase = await GovernanceCase.findOne({ caseId });

      if (!governanceCase) {
        throw new Error(`Case ${caseId} not found`);
      }

      if (governanceCase.status !== 'VOTING_ACTIVE') {
        throw new Error(`Case ${caseId} is not in active voting`);
      }

      await notificationService.notifyDeadlineApproaching(governanceCase);

      logger.info(`Manual reminder sent for case: ${caseId}`);
      return { success: true };

    } catch (error) {
      logger.error(`Error sending manual reminder for ${caseId}:`, error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.scheduledJobs.keys()),
      jobCount: this.scheduledJobs.size,
      uptime: this.isRunning ? 'Running' : 'Stopped'
    };
  }

  async getGovernanceStats() {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const stats = {
        cases: {
          total: await GovernanceCase.countDocuments(),
          active: await GovernanceCase.countDocuments({ status: 'VOTING_ACTIVE' }),
          resolved: await GovernanceCase.countDocuments({ status: 'RESOLVED' }),
          rejected: await GovernanceCase.countDocuments({ status: 'REJECTED' }),
          lastDay: await GovernanceCase.countDocuments({ createdAt: { $gte: oneDayAgo } }),
          lastWeek: await GovernanceCase.countDocuments({ createdAt: { $gte: oneWeekAgo } })
        },
        votes: {
          total: await CommunityVote.countDocuments(),
          lastDay: await CommunityVote.countDocuments({ createdAt: { $gte: oneDayAgo } }),
          lastWeek: await CommunityVote.countDocuments({ createdAt: { $gte: oneWeekAgo } })
        },
        participation: {
          activeVoters: await CommunityVote.distinct('voterAddress', {
            createdAt: { $gte: oneWeekAgo }
          }).then(voters => voters.length),
          avgVotesPerCase: await this.getAverageVotesPerCase(),
          participationRate: await this.calculateParticipationRate()
        }
      };

      return stats;

    } catch (error) {
      logger.error('Error getting governance stats:', error);
      return null;
    }
  }

  async getAverageVotesPerCase() {
    try {
      const result = await GovernanceCase.aggregate([
        { $match: { status: { $ne: 'PENDING' } } },
        { $group: { _id: null, avgVotes: { $avg: '$voteCount' } } }
      ]);

      return result[0]?.avgVotes || 0;
    } catch (error) {
      return 0;
    }
  }

  async calculateParticipationRate() {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const activeCases = await GovernanceCase.countDocuments({
        status: 'VOTING_ACTIVE',
        createdAt: { $gte: oneWeekAgo }
      });

      const uniqueVoters = await CommunityVote.distinct('voterAddress', {
        createdAt: { $gte: oneWeekAgo }
      });

      return activeCases > 0 ? (uniqueVoters.length / (activeCases * 10)) : 0;

    } catch (error) {
      return 0;
    }
  }
}

const governanceScheduler = new GovernanceScheduler();

module.exports = governanceScheduler;
