const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Admin Utility Script: Unban All Users
 * This script removes bans from all users in the database
 */

async function unbanAllUsers() {
  try {
    console.log('🔍 Searching for banned users...');
    
    // Find all users and check their moderation status
    const allUsers = await User.find({}).select('walletAddress username moderation banned bannedAt bannedReason');
    console.log(`📊 Total users in database: ${allUsers.length}`);
    
    // Check for users banned in different field structures
    const bannedUsers1 = await User.find({
      'moderation.banned': true
    }).select('walletAddress username moderation');
    
    const bannedUsers2 = await User.find({
      'banned': true
    }).select('walletAddress username banned bannedAt bannedReason');
    
    // Also check for any users with ban-related fields
    const usersWithBanData = await User.find({
      $or: [
        { 'moderation.banned': true },
        { 'banned': true },
        { 'moderation.bannedAt': { $exists: true } },
        { 'bannedAt': { $exists: true } }
      ]
    }).select('walletAddress username moderation banned bannedAt bannedReason');
    
    console.log(`� Found banned users structure 1 (moderation.banned): ${bannedUsers1.length}`);
    console.log(`🔍 Found banned users structure 2 (banned): ${bannedUsers2.length}`);
    console.log(`🔍 Found users with any ban data: ${usersWithBanData.length}`);
    
    // Combine all potentially banned users
    const allBannedUsers = [...bannedUsers1, ...bannedUsers2];
    const uniqueBannedUsers = allBannedUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.walletAddress === user.walletAddress)
    );
    
    console.log(`📋 Total unique banned users found: ${uniqueBannedUsers.length}`);
    
    if (uniqueBannedUsers.length === 0 && usersWithBanData.length === 0) {
      console.log('✅ No banned users found. Nothing to do.');
      
      // Show some sample users for debugging
      console.log('\n📋 Sample users in database:');
      allUsers.slice(0, 3).forEach((user, index) => {
        console.log(`${index + 1}. ${user.username || 'Unknown'} (${user.walletAddress})`);
        console.log(`   - Moderation: ${JSON.stringify(user.moderation)}`);
        console.log(`   - Banned field: ${user.banned}`);
      });
      
      return { success: true, message: 'No banned users found', unbannedCount: 0 };
    }
    
    if (usersWithBanData.length > 0) {
      console.log('\n📋 Users with ban-related data:');
      usersWithBanData.forEach((user, index) => {
        console.log(`${index + 1}. ${user.username || 'Unknown'} (${user.walletAddress})`);
        console.log(`   - moderation.banned: ${user.moderation?.banned}`);
        console.log(`   - banned: ${user.banned}`);
        console.log(`   - moderation.bannedAt: ${user.moderation?.bannedAt}`);
        console.log(`   - bannedAt: ${user.bannedAt}`);
      });
    }
    
    console.log('\n🔧 Unbanning all users...');
    
    // Unban all users with comprehensive field clearing
    const result = await User.updateMany(
      {
        $or: [
          { 'moderation.banned': true },
          { 'banned': true },
          { 'moderation.bannedAt': { $exists: true } },
          { 'bannedAt': { $exists: true } }
        ]
      },
      {
        $set: {
          'moderation.banned': false,
          'moderation.bannedAt': null,
          'moderation.bannedReason': null,
          'moderation.bannedBy': null,
          'moderation.permanent': false,
          'banned': false,
          'bannedAt': null,
          'bannedReason': null,
          'bannedBy': null
        },
        $push: {
          'moderation.moderationHistory': {
            action: 'unbanned',
            reason: 'Mass unban by administrator',
            issuedAt: new Date(),
            issuedBy: 'ADMIN_SCRIPT',
            caseId: null
          }
        }
      }
    );
    
    console.log(`✅ Successfully processed ${result.modifiedCount} users for unbanning`);
    
    return {
      success: true,
      message: `Successfully processed ${result.modifiedCount} users for unbanning`,
      unbannedCount: result.modifiedCount,
      previouslyBannedUsers: usersWithBanData.map(user => ({
        walletAddress: user.walletAddress,
        username: user.username,
        moderationBanned: user.moderation?.banned,
        banned: user.banned,
        bannedAt: user.moderation?.bannedAt || user.bannedAt,
        bannedReason: user.moderation?.bannedReason || user.bannedReason
      }))
    };
    
  } catch (error) {
    console.error('❌ Error unbanning users:', error);
    return {
      success: false,
      message: 'Failed to unban users',
      error: error.message
    };
  }
}

module.exports = { unbanAllUsers };