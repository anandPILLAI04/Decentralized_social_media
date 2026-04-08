const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Follow = require('../models/Follow');
const { auth } = require('../middleware/auth');
const { generateToken, generateNonce, verifyWalletSignature } = require('../middleware/auth');
const { enforceBanRestrictions } = require('../middleware/banEnforcement');
const { isValidWalletAddress, isValidUsername, isNonEmptyString, sanitizeString } = require('../utils/validators');

const multer = require('multer');
const ipfsService = require('../services/ipfsService');

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
  }
});

// POST /api/auth/nonce — Get a challenge nonce for wallet signature auth
router.post('/nonce', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required.' });
    }
    if (!isValidWalletAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format. Must be a 42-character hex string starting with 0x.' });
    }
    const { nonce, message } = generateNonce(walletAddress);
    res.json({ nonce, message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { walletAddress, username, signature, message, avatar, avatarIpfsHash, bio, email, displayName, location, website, twitter } = req.body;
    if (!walletAddress || !username) {
      return res.status(400).json({ error: 'walletAddress and username are required.' });
    }

    // Validate wallet address format
    if (!isValidWalletAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format. Must be a 42-character hex string starting with 0x.' });
    }

    // Validate username format
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Invalid username. Must be 3-30 characters, alphanumeric and underscores only.' });
    }

    // Validate signature is present
    if (!isNonEmptyString(signature)) {
      return res.status(400).json({ error: 'signature is required for wallet verification.' });
    }

    // Verify wallet ownership via signature
    if (!signature || !message) {
      return res.status(400).json({ error: 'signature and message are required for wallet verification.' });
    }
    const isValid = verifyWalletSignature(message, signature, walletAddress);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid wallet signature. Please sign the challenge message with your wallet.' });
    }

    // Check if user already exists
    const existing = await User.findOne({ walletAddress });
    if (existing) {
      return res.status(409).json({ error: 'User already exists.' });
    }

    // Check if username is taken
    const usernameTaken = await User.findOne({ username });
    if (usernameTaken) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    // Create new user
    const user = new User({
      walletAddress,
      username,
      avatar: avatar || '',
      avatarIpfsHash: avatarIpfsHash || '',
      bio: bio || '',
      email: email || '',
      displayName: displayName || username,
      location: location || '',
      website: website || '',
      twitter: twitter || '',
      isFirstLogin: true
    });
    await user.save();

    // ✨ AUTO-ADD NEW USER TO COMMUNITY MEMBERS
    try {
      const CommunityMember = require('../models/CommunityMember');
      const communityMember = new CommunityMember({
        walletAddress: walletAddress.toLowerCase(),
        username: username,
        user: user._id,
        status: {
          active: true,
          verified: false,
          featured: false,
          suspended: false,
          lastSeen: new Date(),
          joinedGovernanceAt: new Date()
        },
        governanceProfile: {
          totalVotes: 0,
          totalProposals: 0,
          reputationBonus: 0,
          stakeBonus: 0,
          expertiseBonus: 0
        },
        votingPower: 1
      });
      await communityMember.save();
      console.log(`✅ ${username} automatically added as community member (eligible for governance voting)`);
    } catch (communityError) {
      console.error(`⚠️ Failed to add ${username} to community members:`, communityError.message);
      // Don't fail signup if community member creation fails
    }

    const token = generateToken(walletAddress);
    res.status(201).json({
      message: 'User created successfully and added to community members for governance voting',
      user,
      token,
      communityMember: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required.' });
    }

    // Validate wallet address format
    if (!isValidWalletAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format. Must be a 42-character hex string starting with 0x.' });
    }

    // Validate signature is present and non-empty
    if (!isNonEmptyString(signature)) {
      return res.status(400).json({ error: 'signature is required for wallet verification.' });
    }

    // Verify wallet ownership via signature
    if (!signature || !message) {
      return res.status(400).json({ error: 'signature and message are required for wallet verification.' });
    }
    const isValid = verifyWalletSignature(message, signature, walletAddress);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid wallet signature. Please sign the challenge message with your wallet.' });
    }

    const user = await User.findOne({ walletAddress });
    if (!user) {
      return res.status(404).json({ error: 'User not found.', isNewUser: true });
    }

    // Update last login
    user.lastLogin = new Date();
    if (user.isFirstLogin) {
      user.isFirstLogin = false;
    }
    await user.save();
    const token = generateToken(walletAddress);
    res.json({ message: 'Login successful', user, token, isFirstLogin: user.isFirstLogin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/user/:walletAddress
router.get('/user/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    const user = await User.findOne({ walletAddress });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    // Return public profile fields only — omit sensitive data
    const publicProfile = {
      walletAddress: user.walletAddress,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      avatarIpfsHash: user.avatarIpfsHash,
      bio: user.bio,
      dateJoined: user.dateJoined,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
      postsCount: user.postsCount,
      role: user.role,
      // Include moderation status for client-side ban enforcement
      moderation: {
        banned: user.moderation?.banned || false,
        suspended: user.moderation?.suspended || false,
        suspensionEnd: user.moderation?.suspensionEnd || null
      }
    };
    res.json({ user: publicProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/user/:walletAddress
router.put('/user/:walletAddress', auth, async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // Validate wallet address format from URL param
    if (!isValidWalletAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format. Must be a 42-character hex string starting with 0x.' });
    }

    // Ensure the authenticated user can only update their own profile
    if (req.user.address !== walletAddress.toLowerCase()) {
      return res.status(403).json({ error: 'You can only update your own profile.' });
    }

    const updates = req.body;

    // Validate username format if it is being updated
    if (updates.username !== undefined) {
      if (!isValidUsername(updates.username)) {
        return res.status(400).json({ error: 'Invalid username. Must be 3-30 characters, alphanumeric and underscores only.' });
      }
    }

    // Sanitize string fields that are being updated
    if (updates.bio !== undefined) updates.bio = sanitizeString(updates.bio, 500);
    if (updates.displayName !== undefined) updates.displayName = sanitizeString(updates.displayName, 50);
    if (updates.location !== undefined) updates.location = sanitizeString(updates.location, 100);
    if (updates.website !== undefined) updates.website = sanitizeString(updates.website, 200);
    if (updates.twitter !== undefined) updates.twitter = sanitizeString(updates.twitter, 50);
    if (updates.email !== undefined) updates.email = sanitizeString(updates.email, 254);

    // Don't allow walletAddress to be changed
    delete updates.walletAddress;
    delete updates.dateJoined;
    // Prevent users from clearing moderation/security fields
    delete updates.moderation;
    delete updates.banned;
    delete updates.bannedAt;
    delete updates.bannedReason;
    delete updates.bannedBy;
    delete updates.warningCount;
    delete updates.role;
    delete updates.contentPreferences;
    
    // Check if username is being changed and if it's taken
    if (updates.username) {
      const usernameTaken = await User.findOne({ 
        username: updates.username, 
        walletAddress: { $ne: walletAddress } 
      });
      if (usernameTaken) {
        return res.status(409).json({ error: 'Username already taken.' });
      }
    }
    
    const user = await User.findOneAndUpdate(
      { walletAddress },
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    res.json({ message: 'User updated successfully', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/upload-avatar (works with or without auth)
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Get wallet address from auth token OR from body (for signup)
    const walletAddress = req.user?.address || req.body?.walletAddress;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress is required'
      });
    }

    console.log(`📸 Uploading avatar for wallet: ${walletAddress.slice(0, 10)}...`);

    // Upload to IPFS
    const ipfsHash = await ipfsService.uploadFile(
      req.file.buffer,
      req.file.originalname
    );

    const ipfsUrls = ipfsService.getIpfsUrls(ipfsHash);
    console.log(`✅ Avatar uploaded to IPFS: ${ipfsHash}`);

    // Try to update user with new avatar if they already exist
    const user = await User.findOneAndUpdate(
      { walletAddress },
      {
        $set: {
          avatarIpfsHash: ipfsHash,
          avatar: ipfsUrls[0] // Use first gateway URL
        }
      },
      { new: true }
    );

    if (user) {
      console.log(`✅ Avatar updated for existing user: ${user.username}`);
    } else {
      console.log(`📸 Avatar uploaded to IPFS for new user (signup): ${ipfsHash}`);
    }

    // Return IPFS info (for both new and existing users)
    return res.json({
      success: true,
      ipfsHash,
      ipfsUrls,
      avatar: ipfsUrls[0],
      message: user ? 'Avatar updated successfully' : 'Avatar uploaded, ready for signup'
    });

  } catch (error) {
    console.error('❌ Avatar upload error:', error.message || error);

    // Safely extract error message without circular references
    let errorMsg = 'Failed to upload avatar';
    if (error && error.message) {
      errorMsg = error.message;
    } else if (error instanceof Error) {
      errorMsg = error.toString();
    }

    res.status(500).json({
      success: false,
      error: errorMsg
    });
  }
});

// Follow a user
router.post('/users/:address/follow', auth, enforceBanRestrictions, async (req, res) => {
  try {
    const { address } = req.params; // User to follow
    const followerAddress = req.user.address; // From JWT
    
    if (!followerAddress) {
      return res.status(400).json({ 
        success: false, 
        error: "Follower address is required" 
      });
    }
    
    if (address === followerAddress) {
      return res.status(400).json({ 
        success: false, 
        error: "You cannot follow yourself" 
      });
    }
    
    // Check if both users exist
    const userToFollow = await User.findOne({ walletAddress: address });
    const follower = await User.findOne({ walletAddress: followerAddress });
    
    if (!userToFollow) {
      return res.status(404).json({ 
        success: false, 
        error: "User to follow not found" 
      });
    }
    
    // Check if already following
    const existingFollow = await Follow.findOne({ 
      followerId: followerAddress, 
      followingId: address 
    });
    
    if (existingFollow) {
      return res.status(400).json({ 
        success: false, 
        error: "Already following this user" 
      });
    }
    
    // Create follow relationship
    const follow = new Follow({
      followerId: followerAddress,
      followingId: address
    });
    await follow.save();
    
    // Update follower counts
    userToFollow.followersCount = (userToFollow.followersCount || 0) + 1;
    await userToFollow.save();
    
    if (follower) {
      follower.followingCount = (follower.followingCount || 0) + 1;
      await follower.save();
    }
    
    console.log(`👥 ${followerAddress.slice(0, 8)}... followed ${address.slice(0, 8)}...`);

    // Create a follow notification for the user being followed
    try {
      // Lazy-require to avoid circular deps during initial require
      const notificationService = require('../services/notificationService');

      // Prepare sender info when available
      const senderInfo = {
        address: followerAddress
      };
      if (follower) {
        senderInfo.username = follower.username || null;
        senderInfo.avatar = follower.avatar || null;
      }

      // Avoid notifying if followerAddress equals the recipient (should be prevented above)
      if (followerAddress && followerAddress.toLowerCase() !== address.toLowerCase()) {
        await notificationService.createNotification({
          type: 'follow',
          recipient: address,
          sender: senderInfo,
          content: {}
        });
      }
    } catch (notifErr) {
      console.error('Failed to create follow notification:', notifErr);
      // Do not block the follow response on notification errors
    }
    
    res.json({ 
      success: true, 
      isFollowing: true,
      followersCount: userToFollow.followersCount
    });
  } catch (error) {
    console.error("Error following user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unfollow a user
router.delete('/users/:address/follow', auth, enforceBanRestrictions, async (req, res) => {
  try {
    const { address } = req.params; // User to unfollow
    const followerAddress = req.user.address; // From JWT
    
    if (!followerAddress) {
      return res.status(400).json({ 
        success: false, 
        error: "Follower address is required" 
      });
    }
    
    // Find and delete the follow relationship
    const follow = await Follow.findOneAndDelete({ 
      followerId: followerAddress, 
      followingId: address 
    });
    
    if (!follow) {
      return res.status(404).json({ 
        success: false, 
        error: "Follow relationship not found" 
      });
    }
    
    // Update follower counts
    const userToUnfollow = await User.findOne({ walletAddress: address });
    const follower = await User.findOne({ walletAddress: followerAddress });
    
    if (userToUnfollow) {
      userToUnfollow.followersCount = Math.max((userToUnfollow.followersCount || 0) - 1, 0);
      await userToUnfollow.save();
    }
    
    if (follower) {
      follower.followingCount = Math.max((follower.followingCount || 0) - 1, 0);
      await follower.save();
    }
    
    console.log(`👋 ${followerAddress.slice(0, 8)}... unfollowed ${address.slice(0, 8)}...`);
    
    res.json({ 
      success: true, 
      isFollowing: false,
      followersCount: userToUnfollow ? userToUnfollow.followersCount : 0
    });
  } catch (error) {
    console.error("Error unfollowing user:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check follow status
router.get('/users/:address/follow/status', async (req, res) => {
  try {
    const { address } = req.params;
    const { followerAddress } = req.query;
    
    if (!followerAddress) {
      return res.json({ success: true, isFollowing: false });
    }
    
    const follow = await Follow.findOne({ 
      followerId: followerAddress, 
      followingId: address 
    });
    
    res.json({ 
      success: true, 
      isFollowing: !!follow 
    });
  } catch (error) {
    console.error("Error checking follow status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get followers of a user
router.get('/users/:address/followers', async (req, res) => {
  try {
    const { address } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (page - 1) * limit;
    const totalFollowers = await Follow.countDocuments({ followingId: address });
    const follows = await Follow.find({ followingId: address })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    // Get follower user details
    const followerIds = follows.map(f => f.followerId);
    const followers = await User.find({ walletAddress: { $in: followerIds } })
      .select('walletAddress username displayName avatar avatarIpfsHash bio followersCount followingCount');
    
    res.json({
      success: true,
      followers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalFollowers / limit),
        totalFollowers
      }
    });
  } catch (error) {
    console.error("Error fetching followers:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get users that a user follows
router.get('/users/:address/following', async (req, res) => {
  try {
    const { address } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (page - 1) * limit;
    const totalFollowing = await Follow.countDocuments({ followerId: address });
    const follows = await Follow.find({ followerId: address })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    // Get following user details
    const followingIds = follows.map(f => f.followingId);
    const following = await User.find({ walletAddress: { $in: followingIds } })
      .select('walletAddress username displayName avatar avatarIpfsHash bio followersCount followingCount');
    
    res.json({
      success: true,
      following,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalFollowing / limit),
        totalFollowing
      }
    });
  } catch (error) {
    console.error("Error fetching following:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/auth/users/search - Search users by username or wallet address
router.get('/users/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.json({ success: true, users: [] });
    }
    
    const searchQuery = q.trim();

    // Escape regex special characters to prevent ReDoS attacks
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Search by username (case-insensitive) or wallet address (exact or partial match)
    const users = await User.find({
      $or: [
        { username: { $regex: escapedQuery, $options: 'i' } },
        { displayName: { $regex: escapedQuery, $options: 'i' } },
        { walletAddress: { $regex: escapedQuery, $options: 'i' } }
      ]
    })
    .select('username displayName walletAddress avatar bio followersCount followingCount dateJoined')
    .limit(parseInt(limit))
    .sort({ followersCount: -1 }); // Sort by follower count (more popular first)
    
    res.json({
      success: true,
      users,
      count: users.length
    });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
