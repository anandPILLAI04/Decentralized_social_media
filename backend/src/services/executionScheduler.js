const cron = require('node-cron');
const caseExecutionService = require('./caseExecutionService');
const GovernanceCase = require('../models/GovernanceCase');
const CommunityMember = require('../models/CommunityMember');
const logger = require('../utils/logger');

/**
 * Automated Case Execution Scheduler
 * Periodically checks for and executes approved governance cases
 */

let isSchedulerRunning = false;
let lastExecutionTime = null;
// Store active cron job references so they can be stopped
const activeJobs = new Map();
let executionStats = {
  totalRuns: 0,
  successfulExecutions: 0,
  failedExecutions: 0,
  lastRunTime: null,
  nextRunTime: null
};

/**
 * Check if a case is eligible for automatic execution
 */
function isCaseEligibleForExecution(governanceCase) {
  // Must be in approved or rejected status
  if (!['APPROVED', 'REJECTED'].includes(governanceCase.status)) {
    return false;
  }

  // Must not already be executed (only check 'executed' field, not execution.status)
  if (governanceCase.executed) {
    logger.info(`⏭️  Case ${governanceCase._id} already executed`);
    return false;
  }

  // Must meet quorum and approval thresholds for approved cases
  if (governanceCase.status === 'APPROVED') {
    const totalVotes = governanceCase.totalVotes || 0;
    const approveVotes = governanceCase.votes?.approve || 0;
    const rejectVotes = governanceCase.votes?.reject || 0;

    // Quorum: minimum 2 votes for small communities (testing), or 5% of voting weight for larger communities
    const quorumThreshold = Math.max(2, (governanceCase.totalVotingWeight || 0) * 0.05);

    logger.info(`🔍 Checking eligibility for case ${governanceCase._id}:`);
    logger.info(`   Total Votes: ${totalVotes}, Approve: ${approveVotes}, Reject: ${rejectVotes}`);
    logger.info(`   Quorum Threshold: ${quorumThreshold}`);

    if (totalVotes < quorumThreshold) {
      logger.info(`   ❌ Skipped: Not enough votes (${totalVotes} < ${quorumThreshold})`);
      return false;
    }

    if (approveVotes <= (totalVotes / 2)) {
      logger.info(`   ❌ Skipped: Approve votes not majority (${approveVotes} <= ${totalVotes / 2})`);
      return false;
    }

    logger.info(`   ✅ Eligible for execution`);
  }

  return true;
}

/**
 * Conclude voting for cases whose votingEndTime has passed.
 * ALSO conclude early if ALL eligible voters have voted.
 * Transitions ACTIVE_VOTING → APPROVED or REJECTED based on weighted vote counts.
 * IMMEDIATELY executes APPROVED cases (no wait for separate execution cycle)
 */
async function concludeExpiredVoting() {
  try {
    const now = new Date();

    // Find cases that either:
    // 1. Have voting time expired, OR
    // 2. Have all eligible voters already voted (early conclusion)
    const expiredCases = await GovernanceCase.find({
      status: 'ACTIVE_VOTING',
      $or: [
        { votingEndTime: { $lt: now } },  // Time expired
        { votedCount: { $gte: 0, $lte: 1000 }, totalEligibleVoters: { $gt: 0 } }  // Check voting completion below
      ]
    }).limit(50);

    let casesToConclude = [];
    for (const c of expiredCases) {
      // Check if voting time expired OR all eligible voters have voted
      if (c.votingEndTime < now || (c.votedCount && c.totalEligibleVoters && c.votedCount >= c.totalEligibleVoters)) {
        casesToConclude.push(c);
      }
    }

    if (casesToConclude.length === 0) return;

    logger.info(`⏳ Concluding ${casesToConclude.length} voting case(s) (time expired or all voted)...`);

    for (const governanceCase of casesToConclude) {
      try {
        // Check if this is an early conclusion (all voted) vs time expired
        const allVoted = governanceCase.votedCount >= governanceCase.totalEligibleVoters;

        const totalVotes = governanceCase.totalVotes || 0;
        const approveVotes = governanceCase.votes?.approve || 0;
        const rejectVotes = governanceCase.votes?.reject || 0;
        const totalWeight = governanceCase.totalVotingWeight || totalVotes;

        // Minimum quorum: 2 votes for small communities, or 5% of total weight (for larger ones)
        const quorumThreshold = Math.max(2, totalWeight * 0.05);
        const meetsQuorum = totalVotes >= quorumThreshold;

        // Majority is determined by weighted approve vs reject+partial counts
        const newStatus = meetsQuorum && approveVotes > rejectVotes ? 'APPROVED' : 'REJECTED';

        const logNote = allVoted ? '(early: all voted)' : '(time expired)';

        await GovernanceCase.findByIdAndUpdate(governanceCase._id, {
          $set: { status: newStatus }
        });

        logger.info(
          `📋 Case ${governanceCase._id} ("${governanceCase.title}"): ` +
          `${approveVotes} approve / ${rejectVotes} reject, quorum=${meetsQuorum} → ${newStatus} ${logNote}`
        );

        // IMMEDIATE EXECUTION for APPROVED cases (no 10-minute wait)
        if (newStatus === 'APPROVED') {
          logger.info(`⚡ Immediately executing APPROVED case: ${governanceCase._id}`);
          try {
            const executionResult = await caseExecutionService.executeGovernanceCase(
              governanceCase._id,
              'APPROVED',
              'AUTO_SCHEDULER_IMMEDIATE'
            );
            if (executionResult.success) {
              logger.info(`✅ Immediate execution successful for case ${governanceCase._id}`);
            } else {
              logger.warn(`⚠️ Immediate execution failed for case ${governanceCase._id}: ${executionResult.error}`);
            }
          } catch (execErr) {
            logger.error(`❌ Error in immediate execution for case ${governanceCase._id}:`, execErr);
          }
        }

      } catch (err) {
        logger.error(`Error concluding case ${governanceCase._id}:`, err);
      }
    }
  } catch (error) {
    logger.error('Error in concludeExpiredVoting:', error);
  }
}

/**
 * Execute a batch of eligible cases
 */
async function executeBatch() {
  try {
    logger.info('🔄 Starting automated case execution batch...');
    
    // Find eligible cases
    // APPROVED/REJECTED cases are ready for immediate execution (voting is conclusive)
    const eligibleCases = await GovernanceCase.find({
      $or: [
        {
          status: 'APPROVED',
          $or: [
            { 'execution.status': { $in: ['PENDING', null] } },
            { executed: { $ne: true } }
          ]
        },
        {
          status: 'REJECTED',
          $or: [
            { 'execution.status': { $in: ['PENDING', null] } },
            { executed: { $ne: true } }
          ]
        }
      ]
    })
    .limit(20) // Process max 20 cases per batch
    .sort({ votingEndTime: 1 }); // Oldest first
    
    logger.info(`Found ${eligibleCases.length} cases eligible for execution`);
    
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const governanceCase of eligibleCases) {
      try {
        // Double-check eligibility
        if (!isCaseEligibleForExecution(governanceCase)) {
          logger.info(`Skipping case ${governanceCase._id}: Not eligible`);
          continue;
        }
        
        logger.info(`Executing case: ${governanceCase._id} (${governanceCase.title})`);
        
        const result = await caseExecutionService.executeGovernanceCase(
          governanceCase._id,
          governanceCase.status,
          'AUTO_SCHEDULER'
        );
        
        if (result.success) {
          successCount++;
          logger.info(`✅ Successfully executed case ${governanceCase._id}`);
        } else {
          failureCount++;
          logger.info(`❌ Failed to execute case ${governanceCase._id}: ${result.error}`);
        }
        
        results.push({
          caseId: governanceCase._id,
          title: governanceCase.title,
          status: governanceCase.status,
          ...result
        });
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        failureCount++;
        logger.error(`Error executing case ${governanceCase._id}:`, error);
        
        results.push({
          caseId: governanceCase._id,
          title: governanceCase.title,
          success: false,
          error: error.message
        });
      }
    }
    
    // Update execution stats
    executionStats.totalRuns++;
    executionStats.successfulExecutions += successCount;
    executionStats.failedExecutions += failureCount;
    executionStats.lastRunTime = new Date();
    
    logger.info(`🏁 Batch execution completed: ${successCount} successful, ${failureCount} failed`);
    
    return {
      success: true,
      processed: eligibleCases.length,
      successful: successCount,
      failed: failureCount,
      results: results.slice(0, 5) // Limit logging
    };
    
  } catch (error) {
    logger.error('Error in automated execution batch:', error);
    executionStats.totalRuns++;
    executionStats.failedExecutions++;
    executionStats.lastRunTime = new Date();
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update voting power for active community members
 */
async function updateCommunityVotingPower() {
  try {
    logger.info('🔄 Updating community voting power...');
    
    // Get active community members (those who voted in the last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const activeMembers = await CommunityMember.find({
      'status.lastSeen': { $gte: thirtyDaysAgo }
    })
    .select('walletAddress username')
    .limit(50) // Update max 50 members per run
    .sort({ 'status.lastSeen': -1 });
    
    logger.info(`Updating voting power for ${activeMembers.length} active members`);
    
    const votingPowerService = require('./votingPowerService');
    let updateCount = 0;
    
    for (const member of activeMembers) {
      try {
        const result = await votingPowerService.updateMemberVotingPower(member.walletAddress);
        if (result.success) {
          updateCount++;
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        logger.error(`Error updating voting power for ${member.walletAddress}:`, error);
      }
    }
    
    logger.info(`✅ Updated voting power for ${updateCount}/${activeMembers.length} members`);
    
  } catch (error) {
    logger.error('Error updating community voting power:', error);
  }
}

/**
 * Cleanup old execution data
 */
async function cleanupOldData() {
  try {
    logger.info('🧹 Cleaning up old execution data...');
    
    // Archive cases older than 6 months that are completed
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    
    const archiveResult = await GovernanceCase.updateMany({
      executedAt: { $lt: sixMonthsAgo },
      'execution.status': 'COMPLETED',
      archived: { $ne: true }
    }, {
      $set: { archived: true, archivedAt: new Date() }
    });
    
    logger.info(`✅ Archived ${archiveResult.modifiedCount} old completed cases`);
    
  } catch (error) {
    logger.error('Error cleaning up old data:', error);
  }
}

/**
 * Start the automated execution scheduler
 */
function startScheduler(config = {}) {
  if (isSchedulerRunning) {
    logger.info('⚠️  Scheduler is already running');
    return;
  }
  
  const {
    executionCron = '*/10 * * * *',     // Every 10 minutes
    concludeVotingCron = '*/5 * * * *', // Every 5 minutes
    votingPowerCron = '0 */6 * * *',    // Every 6 hours
    cleanupCron = '0 2 * * 0'           // Weekly at 2 AM Sunday
  } = config;

  logger.info('🚀 Starting automated case execution scheduler...');
  logger.info(`   Conclude voting schedule: ${concludeVotingCron}`);
  logger.info(`   Execution schedule: ${executionCron}`);
  logger.info(`   Voting power update: ${votingPowerCron}`);
  logger.info(`   Cleanup schedule: ${cleanupCron}`);
  
  // Voting conclusion task — runs before execution so approved cases are ready
  const concludeVotingTask = cron.schedule(concludeVotingCron, async () => {
    logger.info('⏰ Voting conclusion check triggered');
    await concludeExpiredVoting();
  }, {
    scheduled: false,
    timezone: "UTC"
  });

  // Main execution task
  const executionTask = cron.schedule(executionCron, async () => {
    if (!process.env.GOVERNANCE_SCHEDULER_ENABLED) {
      logger.info('Auto-execution disabled (set GOVERNANCE_SCHEDULER_ENABLED=true to enable)');
      return;
    }
    
    logger.info('⏰ Automated execution triggered');
    await executeBatch();
  }, {
    scheduled: false,
    timezone: "UTC"
  });
  
  // Voting power update task
  const votingPowerTask = cron.schedule(votingPowerCron, async () => {
    logger.info('⏰ Voting power update triggered');
    await updateCommunityVotingPower();
  }, {
    scheduled: false,
    timezone: "UTC"
  });
  
  // Cleanup task
  const cleanupTask = cron.schedule(cleanupCron, async () => {
    logger.info('⏰ Cleanup task triggered');
    await cleanupOldData();
  }, {
    scheduled: false,
    timezone: "UTC"
  });
  
  // Start all tasks
  concludeVotingTask.start();
  executionTask.start();
  votingPowerTask.start();
  cleanupTask.start();

  // Store references so stopScheduler can call .stop() on them
  activeJobs.set('concludeVoting', concludeVotingTask);
  activeJobs.set('execution', executionTask);
  activeJobs.set('votingPower', votingPowerTask);
  activeJobs.set('cleanup', cleanupTask);

  isSchedulerRunning = true;
  lastExecutionTime = new Date();
  
  // Calculate next run time
  const nextMinute = new Date();
  nextMinute.setMinutes(nextMinute.getMinutes() + 10);
  executionStats.nextRunTime = nextMinute;
  
  logger.info('✅ Scheduler started successfully');
  
  return {
    concludeVotingTask,
    executionTask,
    votingPowerTask,
    cleanupTask
  };
}

/**
 * Stop the scheduler
 */
function stopScheduler() {
  if (!isSchedulerRunning) {
    logger.info('⚠️  Scheduler is not running');
    return;
  }

  logger.info('🛑 Stopping automated execution scheduler...');

  // Actually stop all active cron jobs
  activeJobs.forEach((job, name) => {
    job.stop();
    logger.info(`   🔴 Stopped ${name} job`);
  });
  activeJobs.clear();

  isSchedulerRunning = false;
  executionStats.nextRunTime = null;

  logger.info('✅ Scheduler stopped');
}

/**
 * Get scheduler status and statistics
 */
function getSchedulerStatus() {
  return {
    isRunning: isSchedulerRunning,
    lastExecutionTime,
    stats: executionStats,
    config: {
      autoExecutionEnabled: !!process.env.GOVERNANCE_SCHEDULER_ENABLED,
      concludeVotingInterval: '5 minutes',
      executionInterval: '10 minutes',
      votingPowerInterval: '6 hours',
      cleanupInterval: '1 week'
    }
  };
}

/**
 * Manual trigger for execution batch (for testing/admin use)
 */
async function triggerManualExecution() {
  if (isSchedulerRunning) {
    logger.info('Manual execution triggered while scheduler is running');
  }
  
  return await executeBatch();
}

module.exports = {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  triggerManualExecution,
  executeBatch,
  concludeExpiredVoting,
  updateCommunityVotingPower,
  cleanupOldData,
  executionStats
};