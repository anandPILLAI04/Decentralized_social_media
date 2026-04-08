const cron = require('node-cron');
const governanceNotificationService = require('./governanceNotificationService');

/**
 * Governance Notification Scheduler
 * Handles periodic notifications like voting reminders and deadline alerts
 */

class GovernanceNotificationScheduler {
  constructor() {
    this.isRunning = false;
    this.jobs = [];
  }

  /**
   * Start all scheduled notification jobs
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Notification scheduler is already running');
      return;
    }

    console.log('🔔 Starting governance notification scheduler...');

    // Send voting reminders every 6 hours
    const votingReminderJob = cron.schedule('0 */6 * * *', async () => {
      try {
        console.log('⏰ Running voting reminder job...');
        await governanceNotificationService.sendVotingReminders();
      } catch (error) {
        console.error('❌ Error in voting reminder job:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Check for deadline approaching notifications every hour
    const deadlineReminderJob = cron.schedule('0 * * * *', async () => {
      try {
        console.log('⏰ Running deadline reminder job...');
        await this.sendDeadlineReminders();
      } catch (error) {
        console.error('❌ Error in deadline reminder job:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Clean up old notifications every day at 2 AM
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🧹 Running notification cleanup job...');
        await this.cleanupOldNotifications();
      } catch (error) {
        console.error('❌ Error in cleanup job:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Process digest notifications every day at 9 AM
    const digestJob = cron.schedule('0 9 * * *', async () => {
      try {
        console.log('📰 Running daily digest job...');
        await this.sendDigestNotifications('DAILY');
      } catch (error) {
        console.error('❌ Error in digest job:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Process weekly digest notifications every Monday at 9 AM
    const weeklyDigestJob = cron.schedule('0 9 * * 1', async () => {
      try {
        console.log('📊 Running weekly digest job...');
        await this.sendDigestNotifications('WEEKLY');
      } catch (error) {
        console.error('❌ Error in weekly digest job:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Store jobs for management
    this.jobs = [
      { name: 'votingReminders', job: votingReminderJob },
      { name: 'deadlineReminders', job: deadlineReminderJob },
      { name: 'cleanup', job: cleanupJob },
      { name: 'dailyDigest', job: digestJob },
      { name: 'weeklyDigest', job: weeklyDigestJob }
    ];

    // Start all jobs
    this.jobs.forEach(({ name, job }) => {
      job.start();
      console.log(`✅ Started job: ${name}`);
    });

    this.isRunning = true;
    console.log('🚀 Governance notification scheduler started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Notification scheduler is not running');
      return;
    }

    console.log('⏹️  Stopping governance notification scheduler...');

    this.jobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`⏹️  Stopped job: ${name}`);
    });

    this.isRunning = false;
    console.log('✅ Governance notification scheduler stopped');
  }

  /**
   * Send deadline approaching notifications
   */
  async sendDeadlineReminders() {
    try {
      const Notification = require('../models/Notification');
      const GovernanceCase = require('../models/GovernanceCase');
      
      // Find cases approaching deadline (next 24 hours)
      const deadline24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const deadline6h = new Date(Date.now() + 6 * 60 * 60 * 1000);
      
      const approachingCases = await GovernanceCase.find({
        status: 'VOTING_ACTIVE',
        votingEndTime: {
          $gt: new Date(),
          $lte: deadline24h
        }
      });

      let notificationsSent = 0;

      for (const governanceCase of approachingCases) {
        const timeLeft = Math.round((governanceCase.votingEndTime - new Date()) / (1000 * 60 * 60));
        
        // Check if we've already sent a reminder for this case
        const existingReminder = await Notification.findOne({
          type: 'governance_deadline_approaching',
          'governanceCase.caseId': governanceCase._id,
          timestamp: { $gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } // Last 12 hours
        });

        if (existingReminder) {
          continue; // Skip if reminder already sent recently
        }

        // Determine urgency based on time left
        let priority = 'NORMAL';
        if (timeLeft <= 6) {
          priority = 'HIGH';
        } else if (timeLeft <= 1) {
          priority = 'URGENT';
        }

        // Get eligible voters who haven't voted
        const eligibleVoters = await governanceNotificationService.getEligibleVoters(governanceCase);
        const votersWhoVoted = await governanceNotificationService.getVotersForCase(governanceCase._id);
        
        const nonVoters = eligibleVoters.filter(voter => 
          !votersWhoVoted.includes(voter.walletAddress)
        );

        // Send deadline notifications
        const notifications = await Promise.all(
          nonVoters.map(async (voter) => {
            return await governanceNotificationService.createGovernanceNotification({
              type: 'governance_deadline_approaching',
              recipient: voter.walletAddress,
              content: {
                title: `Voting Deadline Approaching`,
                message: `Only ${timeLeft} hours left to vote on "${governanceCase.title}". Don't miss your chance!`,
                caseId: governanceCase._id,
                caseTitle: governanceCase.title,
                hoursLeft: timeLeft,
                actionUrl: `/governance/case/${governanceCase._id}/vote`
              },
              governanceCase: {
                caseId: governanceCase._id,
                caseType: governanceCase.type,
                urgency: governanceCase.urgency
              },
              priority
            });
          })
        );

        notificationsSent += notifications.filter(n => n).length;
      }

      console.log(`📅 Sent ${notificationsSent} deadline reminder notifications`);
      return notificationsSent;

    } catch (error) {
      console.error('❌ Error sending deadline reminders:', error);
      return 0;
    }
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications() {
    try {
      const Notification = require('../models/Notification');
      
      // Delete notifications older than 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      const deleteResult = await Notification.deleteMany({
        timestamp: { $lt: ninetyDaysAgo },
        read: true
      });

      // Delete unread notifications older than 180 days
      const oneEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      
      const deleteUnreadResult = await Notification.deleteMany({
        timestamp: { $lt: oneEightyDaysAgo },
        read: false
      });

      const totalDeleted = deleteResult.deletedCount + deleteUnreadResult.deletedCount;
      console.log(`🧹 Cleaned up ${totalDeleted} old notifications`);
      
      return totalDeleted;

    } catch (error) {
      console.error('❌ Error cleaning up notifications:', error);
      return 0;
    }
  }

  /**
   * Send digest notifications
   */
  async sendDigestNotifications(frequency = 'DAILY') {
    try {
      const NotificationPreferences = require('../models/NotificationPreferences');
      const Notification = require('../models/Notification');
      
      // Find users with digest enabled for this frequency
      const usersWithDigest = await NotificationPreferences.find({
        'digest.enabled': true,
        'digest.frequency': frequency.toUpperCase()
      });

      let digestsSent = 0;

      for (const preferences of usersWithDigest) {
        try {
          // Calculate time period for digest
          const now = new Date();
          let startTime;
          
          if (frequency === 'DAILY') {
            startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          } else if (frequency === 'WEEKLY') {
            startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          } else {
            continue;
          }

          // Get notifications for this user in the time period
          const notifications = await Notification.find({
            recipient: preferences.userAddress,
            timestamp: { $gte: startTime, $lte: now },
            category: { 
              $in: Object.entries(preferences.digest.includeCategories)
                .filter(([_, enabled]) => enabled)
                .map(([category, _]) => category.toUpperCase())
            }
          })
          .sort({ timestamp: -1 })
          .limit(50);

          if (notifications.length === 0) {
            continue; // Skip if no notifications to digest
          }

          // Create digest notification
          const digestContent = this.createDigestContent(notifications, frequency);
          
          await governanceNotificationService.createGovernanceNotification({
            type: 'governance_community_update',
            recipient: preferences.userAddress,
            content: {
              title: `${frequency} Governance Digest`,
              message: digestContent.summary,
              digest: digestContent,
              actionUrl: '/governance/dashboard'
            },
            governanceCase: null,
            priority: 'LOW'
          });

          digestsSent++;

        } catch (userError) {
          console.error(`❌ Error creating digest for user ${preferences.userAddress}:`, userError);
        }
      }

      console.log(`📰 Sent ${digestsSent} ${frequency.toLowerCase()} digest notifications`);
      return digestsSent;

    } catch (error) {
      console.error('❌ Error sending digest notifications:', error);
      return 0;
    }
  }

  /**
   * Create digest content from notifications
   */
  createDigestContent(notifications, frequency) {
    const governanceNotifications = notifications.filter(n => n.category === 'GOVERNANCE');
    const socialNotifications = notifications.filter(n => n.category === 'SOCIAL');
    
    const summary = `Your ${frequency.toLowerCase()} summary: ${governanceNotifications.length} governance updates, ${socialNotifications.length} social notifications.`;
    
    return {
      summary,
      period: frequency.toLowerCase(),
      stats: {
        total: notifications.length,
        governance: governanceNotifications.length,
        social: socialNotifications.length,
        unread: notifications.filter(n => !n.read).length
      },
      topNotifications: notifications.slice(0, 10).map(n => ({
        type: n.type,
        title: n.content.title,
        message: n.content.message,
        timestamp: n.timestamp
      }))
    };
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: this.jobs.length,
      jobs: this.jobs.map(({ name }) => ({ name, status: this.isRunning ? 'running' : 'stopped' }))
    };
  }
}

// Create singleton instance
const notificationScheduler = new GovernanceNotificationScheduler();

// Auto-start if enabled in environment
if (process.env.ENABLE_NOTIFICATION_SCHEDULER !== 'false') {
  // Start after a short delay to allow other services to initialize
  setTimeout(() => {
    notificationScheduler.start();
  }, 5000);
}

module.exports = notificationScheduler;