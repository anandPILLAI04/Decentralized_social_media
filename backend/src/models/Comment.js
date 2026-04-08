const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Post', 
    required: true,
    index: true 
  },
  authorId: { 
    type: String, // Wallet address
    required: true,
    index: true 
  },
  authorName: { 
    type: String, 
    default: '' 
  },
  authorAvatar: { 
    type: String, 
    default: '' 
  },
  content: { 
    type: String, 
    required: true,
    maxlength: 500 // Limit comment length
  },
  likesCount: { 
    type: Number, 
    default: 0 
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
  },

  // Moderation fields
  status: {
    type: String,
    enum: ['approved', 'flagged', 'hidden', 'removed'],
    default: 'approved',
    index: true
  },
  flagged: {
    type: Boolean,
    default: false,
    index: true
  },
  moderationScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  moderationProvider: {
    type: String,
    enum: ['hugging-face', 'enhanced-rules', 'multi-tier', 'combined'],
    default: null
  },
  moderationReason: {
    type: String,
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewedBy: {
    type: String, // wallet address
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for getting comments by post (sorted by timestamp)
commentSchema.index({ postId: 1, timestamp: -1 });

// Index for getting comments by author
commentSchema.index({ authorId: 1, timestamp: -1 });

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
