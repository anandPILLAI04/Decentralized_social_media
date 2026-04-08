const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  authorId: { type: String, required: true, index: true }, // Wallet address
  
  // IPFS Storage (Primary - for decentralization)
  contentCID: { type: String, default: '' }, // IPFS CID for complete post JSON
  ipfsHash: { type: String, default: '' }, // Legacy: IPFS CID for content/media
  mediaCID: { type: String, default: '' }, // IPFS CID for media file
  metadataCID: { type: String, default: '' }, // IPFS CID for NFT metadata
  
  // Database Storage (Fallback/Cache for quick access)
  content: { type: String, default: '' }, // Plaintext content (for search/display)
  mediaUrl: { type: String, default: '' }, // Media URL or IPFS CID (legacy)
  
  // Metadata
  timestamp: { type: Date, default: Date.now, index: true },
  likesCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  
  // NFT Info
  isNFT: { type: Boolean, default: false },
  nftTokenId: { type: String }, // If minted as NFT
  transactionHash: { type: String }, // Transaction hash of NFT minting
  
  // Author Info (Cache for performance)
  authorName: { type: String, default: '' },
  authorAvatar: { type: String, default: '' }, // User's avatar URL
  
  // Moderation Info (Enhanced)
  moderation: {
    status: { 
      type: String, 
      enum: ['approved', 'flagged', 'blocked', 'pending'],
      default: 'approved',
      index: true
    },
    flagged: { type: Boolean, default: false, index: true },
    flaggedAt: { type: Date },
    flagReason: { type: String },
    confirmedByGovernance: { type: Boolean, default: false },
    moderationScore: { type: Number, default: 0 }, // AI confidence score
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: null } // wallet address of reviewer
  },
  
  // Content State Management
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
  deletedReason: { type: String },
  deletedBy: { type: String }, // wallet address or 'COMMUNITY_GOVERNANCE'
  
  isHidden: { type: Boolean, default: false, index: true },
  hiddenAt: { type: Date },
  hiddenReason: { type: String },
  hiddenBy: { type: String }, // wallet address or 'COMMUNITY_GOVERNANCE'
  
  restoredAt: { type: Date },
  restoredReason: { type: String },
  restoredBy: { type: String }, // wallet address or 'COMMUNITY_GOVERNANCE'
  
  // Legacy fields (maintained for compatibility)
  status: { 
    type: String, 
    enum: ['approved', 'flagged', 'blocked', 'pending'],
    default: 'approved',
    index: true
  },
  flagged: { type: Boolean, default: false, index: true },
  moderationScore: { type: Number, default: 0 }, // AI confidence score
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: String, default: null }, // wallet address of reviewer
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add indexes for better query performance
postSchema.index({ timestamp: -1 });
postSchema.index({ authorId: 1, timestamp: -1 });
postSchema.index({ isNFT: 1 });
postSchema.index({ contentCID: 1 }); // For IPFS content lookups
postSchema.index({ nftTokenId: 1 }); // For NFT lookups
postSchema.index({ status: 1, timestamp: -1 }); // For moderation queries
// flagged index already declared via schema-level `index: true`
postSchema.index({ content: 'text', authorName: 'text' }, {
  weights: { content: 10, authorName: 5 },
  name: 'post_text_search'
}); // Text index for full-text search

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
