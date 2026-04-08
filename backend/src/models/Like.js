const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  postId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Post', 
    required: true,
    index: true 
  },
  userId: { 
    type: String, // Wallet address
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

// Compound index to ensure one like per user per post
likeSchema.index({ postId: 1, userId: 1 }, { unique: true });

// Index for getting all likes by a user
likeSchema.index({ userId: 1, timestamp: -1 });

const Like = mongoose.model('Like', likeSchema);

module.exports = Like;
