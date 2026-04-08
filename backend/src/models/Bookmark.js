const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  userAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  }
}, {
  timestamps: true
});

// One bookmark per user per post
bookmarkSchema.index({ userAddress: 1, post: 1 }, { unique: true });
// Fast lookup for "all bookmarks by user" sorted newest-first
bookmarkSchema.index({ userAddress: 1, createdAt: -1 });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
