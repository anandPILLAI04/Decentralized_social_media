const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  authorId: { type: String, required: true }, // Wallet address
  ipfsHash: { type: String, required: true }, // IPFS CID for content/media
  content: { type: String }, // Optional: plaintext content
  mediaUrl: { type: String }, // Optional: direct media URL
  timestamp: { type: Date, default: Date.now },
  likesCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  isNFT: { type: Boolean, default: false },
  nftTokenId: { type: String }, // If minted as NFT
  authorName: { type: String },
});

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
