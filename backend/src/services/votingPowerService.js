const { ethers } = require('ethers');
const CommunityMember = require('../models/CommunityMember');

/**
 * Voting Power Calculation Service
 * Calculates user voting power based on multiple weighted factors
 */

// Configuration constants
const VOTING_POWER_CONFIG = {
  // Weight distribution (must sum to 100%)
  WEIGHTS: {
    BASE_POWER: 0.20,        // 20% - Minimum democratic participation
    TRANSACTION_HISTORY: 0.30, // 30% - Blockchain activity
    ACCOUNT_AGE: 0.25,       // 25% - Account stability
    COMMUNITY_PARTICIPATION: 0.25 // 25% - Governance engagement
  },
  
  // Maximum voting power caps
  MAX_POWER: {
    TOTAL: 1000,             // Maximum total voting power
    TRANSACTION: 400,        // Max from transaction history
    AGE: 300,                // Max from account age
    PARTICIPATION: 400       // Max from community participation
  },
  
  // Minimum requirements
  MIN_POWER: {
    BASE: 50,               // Minimum voting power for new users
    TRANSACTION_THRESHOLD: 5 // Minimum transactions to get bonus
  },
  
  // Time periods (in days)
  TIME_PERIODS: {
    RECENT_ACTIVITY: 30,    // Recent activity window
    ACCOUNT_AGE_MAX: 365,   // Max account age bonus (1 year)
    PARTICIPATION_WINDOW: 90 // Participation calculation window
  }
};

/**
 * Get blockchain provider for the specified network
 */
function getProvider() {
  const rpcUrl = process.env.RPC_URL || 'https://rpc-amoy.polygon.technology';
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Calculate transaction history score
 * Analyzes on-chain activity to determine engagement
 */
async function calculateTransactionScore(walletAddress) {
  try {
    const provider = getProvider();
    
    // Get current block number
    const currentBlock = await provider.getBlockNumber();
    
    // Calculate blocks for recent activity (approximately 30 days)
    const blocksPerDay = 43200; // Polygon ~2 second block time
    const recentBlocks = VOTING_POWER_CONFIG.TIME_PERIODS.RECENT_ACTIVITY * blocksPerDay;
    const fromBlock = Math.max(0, currentBlock - recentBlocks);
    
    // Get transaction count
    const totalTxCount = await provider.getTransactionCount(walletAddress);
    
    // Get recent transactions (limited for performance)
    let recentTxCount = 0;
    try {
      // This is a simplified approach - in production you'd use event filters or indexing
      // For now, we'll estimate based on total transactions
      recentTxCount = Math.min(totalTxCount, Math.floor(totalTxCount * 0.1)); // Estimate 10% are recent
    } catch (error) {
      console.warn('Could not fetch recent transactions:', error.message);
      recentTxCount = Math.min(totalTxCount, 10); // Conservative estimate
    }
    
    // Calculate score
    const transactionScore = Math.min(
      VOTING_POWER_CONFIG.MAX_POWER.TRANSACTION,
      Math.sqrt(totalTxCount) * 10 + recentTxCount * 5
    );
    
    return {
      totalTransactions: totalTxCount,
      recentTransactions: recentTxCount,
      score: Math.round(transactionScore),
      maxPossible: VOTING_POWER_CONFIG.MAX_POWER.TRANSACTION
    };
    
  } catch (error) {
    console.error('Error calculating transaction score:', error);
    return {
      totalTransactions: 0,
      recentTransactions: 0,
      score: 0,
      maxPossible: VOTING_POWER_CONFIG.MAX_POWER.TRANSACTION,
      error: error.message
    };
  }
}

/**
 * Calculate account age score
 * Rewards account stability and long-term commitment
 */
async function calculateAccountAgeScore(walletAddress) {
  try {
    const provider = getProvider();
    
    // Get the first transaction to estimate account age
    const balance = await provider.getBalance(walletAddress);
    const txCount = await provider.getTransactionCount(walletAddress);
    
    if (txCount === 0) {
      return {
        estimatedAge: 0,
        score: 0,
        maxPossible: VOTING_POWER_CONFIG.MAX_POWER.AGE
      };
    }
    
    // Simplified age calculation - in production you'd use transaction history
    // For now, use a heuristic based on transaction count and balance
    const estimatedDays = Math.min(
      VOTING_POWER_CONFIG.TIME_PERIODS.ACCOUNT_AGE_MAX,
      Math.sqrt(txCount) * 5 + (balance > 0n ? 30 : 0)
    );
    
    // Linear bonus up to max period
    const ageScore = Math.min(
      VOTING_POWER_CONFIG.MAX_POWER.AGE,
      (estimatedDays / VOTING_POWER_CONFIG.TIME_PERIODS.ACCOUNT_AGE_MAX) * 
      VOTING_POWER_CONFIG.MAX_POWER.AGE
    );
    
    return {
      estimatedAge: Math.round(estimatedDays),
      score: Math.round(ageScore),
      maxPossible: VOTING_POWER_CONFIG.MAX_POWER.AGE
    };
    
  } catch (error) {
    console.error('Error calculating account age score:', error);
    return {
      estimatedAge: 0,
      score: 0,
      maxPossible: VOTING_POWER_CONFIG.MAX_POWER.AGE,
      error: error.message
    };
  }
}

/**
 * Calculate community participation score
 * Rewards active governance engagement
 */
async function calculateParticipationScore(walletAddress) {
  try {
    const member = await CommunityMember.findOne({ walletAddress: walletAddress.toLowerCase() });
    
    if (!member) {
      return {
        totalVotes: 0,
        totalProposals: 0,
        accuracyRating: 0,
        score: 0,
        maxPossible: VOTING_POWER_CONFIG.MAX_POWER.PARTICIPATION
      };
    }
    
    const profile = member.governanceProfile;
    
    // Calculate participation score based on multiple factors
    const voteBonus = Math.min(200, profile.totalVotes * 5);
    const proposalBonus = Math.min(100, profile.totalProposals * 20);
    const accuracyBonus = Math.min(100, profile.accuracyRating || 0);
    const helpfulnessBonus = Math.min(50, profile.helpfulVotes * 2);
    
    const participationScore = Math.min(
      VOTING_POWER_CONFIG.MAX_POWER.PARTICIPATION,
      voteBonus + proposalBonus + accuracyBonus + helpfulnessBonus
    );
    
    return {
      totalVotes: profile.totalVotes || 0,
      totalProposals: profile.totalProposals || 0,
      accuracyRating: profile.accuracyRating || 0,
      helpfulVotes: profile.helpfulVotes || 0,
      score: Math.round(participationScore),
      maxPossible: VOTING_POWER_CONFIG.MAX_POWER.PARTICIPATION
    };
    
  } catch (error) {
    console.error('Error calculating participation score:', error);
    return {
      totalVotes: 0,
      totalProposals: 0,
      accuracyRating: 0,
      score: 0,
      maxPossible: VOTING_POWER_CONFIG.MAX_POWER.PARTICIPATION,
      error: error.message
    };
  }
}

/**
 * Calculate total voting power for a wallet address
 * Combines all factors using weighted formula
 */
async function calculateVotingPower(walletAddress) {
  try {
    console.log(`Calculating voting power for: ${walletAddress}`);
    
    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();
    
    // Calculate all components in parallel
    const [transactionData, ageData, participationData] = await Promise.all([
      calculateTransactionScore(normalizedAddress),
      calculateAccountAgeScore(normalizedAddress),
      calculateParticipationScore(normalizedAddress)
    ]);
    
    // Base power (everyone gets minimum)
    const basePower = VOTING_POWER_CONFIG.MIN_POWER.BASE;
    
    // Apply weights to each component
    const weightedTransaction = transactionData.score * VOTING_POWER_CONFIG.WEIGHTS.TRANSACTION_HISTORY;
    const weightedAge = ageData.score * VOTING_POWER_CONFIG.WEIGHTS.ACCOUNT_AGE;
    const weightedParticipation = participationData.score * VOTING_POWER_CONFIG.WEIGHTS.COMMUNITY_PARTICIPATION;
    const weightedBase = basePower * VOTING_POWER_CONFIG.WEIGHTS.BASE_POWER;
    
    // Calculate total voting power
    const totalPower = Math.min(
      VOTING_POWER_CONFIG.MAX_POWER.TOTAL,
      weightedBase + weightedTransaction + weightedAge + weightedParticipation
    );
    
    // Calculate breakdown percentages
    const breakdown = {
      base: {
        raw: basePower,
        weighted: Math.round(weightedBase),
        percentage: VOTING_POWER_CONFIG.WEIGHTS.BASE_POWER * 100
      },
      transactions: {
        raw: transactionData.score,
        weighted: Math.round(weightedTransaction),
        percentage: VOTING_POWER_CONFIG.WEIGHTS.TRANSACTION_HISTORY * 100,
        details: transactionData
      },
      accountAge: {
        raw: ageData.score,
        weighted: Math.round(weightedAge),
        percentage: VOTING_POWER_CONFIG.WEIGHTS.ACCOUNT_AGE * 100,
        details: ageData
      },
      participation: {
        raw: participationData.score,
        weighted: Math.round(weightedParticipation),
        percentage: VOTING_POWER_CONFIG.WEIGHTS.COMMUNITY_PARTICIPATION * 100,
        details: participationData
      }
    };
    
    const result = {
      walletAddress: normalizedAddress,
      totalVotingPower: Math.round(totalPower),
      maxPossiblePower: VOTING_POWER_CONFIG.MAX_POWER.TOTAL,
      powerLevel: calculatePowerLevel(totalPower),
      breakdown: breakdown,
      calculatedAt: new Date(),
      isEligibleToVote: totalPower >= VOTING_POWER_CONFIG.MIN_POWER.BASE
    };
    
    console.log(`Voting power calculated: ${result.totalVotingPower}/${result.maxPossiblePower} (${result.powerLevel})`);
    return result;
    
  } catch (error) {
    console.error('Error in calculateVotingPower:', error);
    return {
      walletAddress: walletAddress.toLowerCase(),
      totalVotingPower: VOTING_POWER_CONFIG.MIN_POWER.BASE,
      maxPossiblePower: VOTING_POWER_CONFIG.MAX_POWER.TOTAL,
      powerLevel: 'NEWCOMER',
      breakdown: null,
      calculatedAt: new Date(),
      isEligibleToVote: true,
      error: error.message
    };
  }
}

/**
 * Calculate power level based on total voting power
 */
function calculatePowerLevel(totalPower) {
  if (totalPower >= 800) return 'GOVERNANCE_EXPERT';
  if (totalPower >= 600) return 'SENIOR_MEMBER';
  if (totalPower >= 400) return 'ACTIVE_MEMBER';
  if (totalPower >= 200) return 'REGULAR_MEMBER';
  if (totalPower >= 100) return 'PARTICIPANT';
  return 'NEWCOMER';
}

/**
 * Update community member with calculated voting power
 */
async function updateMemberVotingPower(walletAddress) {
  try {
    const votingPowerData = await calculateVotingPower(walletAddress);
    
    const member = await CommunityMember.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      {
        $set: {
          'governanceProfile.totalVotingPower': votingPowerData.totalVotingPower,
          'governanceProfile.powerLevel': votingPowerData.powerLevel,
          'governanceProfile.lastPowerCalculation': votingPowerData.calculatedAt,
          'governanceProfile.powerBreakdown': votingPowerData.breakdown
        }
      },
      { new: true, upsert: false }
    );
    
    return {
      success: true,
      member: member,
      votingPower: votingPowerData
    };
    
  } catch (error) {
    console.error('Error updating member voting power:', error);
    return {
      success: false,
      error: error.message,
      votingPower: null
    };
  }
}

/**
 * Batch update voting power for multiple members
 */
async function batchUpdateVotingPower(walletAddresses) {
  const results = [];
  
  for (const address of walletAddresses) {
    try {
      const result = await updateMemberVotingPower(address);
      results.push(result);
      
      // Small delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.push({
        success: false,
        walletAddress: address,
        error: error.message
      });
    }
  }
  
  return results;
}

module.exports = {
  calculateVotingPower,
  calculateTransactionScore,
  calculateAccountAgeScore,
  calculateParticipationScore,
  updateMemberVotingPower,
  batchUpdateVotingPower,
  calculatePowerLevel,
  VOTING_POWER_CONFIG
};