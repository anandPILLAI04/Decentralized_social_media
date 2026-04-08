const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
  followerId: { 
    type: String, // Wallet address of the follower
    required: true,
    index: true 
  },
  followingId: { 
    type: String, // Wallet address being followed
    required: true,
    index: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Compound index to ensure one follow relationship per pair
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

// Index for getting all followers of a user
followSchema.index({ followingId: 1, timestamp: -1 });

// Index for getting all users that a user follows
followSchema.index({ followerId: 1, timestamp: -1 });

const Follow = mongoose.model('Follow', followSchema);

module.exports = Follow;
