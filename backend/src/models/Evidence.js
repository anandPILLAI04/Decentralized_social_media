const mongoose = require('mongoose');

/**
 * Evidence Schema for Governance Cases
 * Stores evidence metadata with IPFS references
 */
const evidenceSchema = new mongoose.Schema({
  // Evidence identification
  evidenceId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  
  // Related governance case
  governanceCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GovernanceCase',
    required: true,
    index: true
  },
  
  // Submitter information
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  submitterAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Evidence classification
  evidenceType: {
    type: String,
    enum: [
      'SCREENSHOT', 
      'USER_UPLOAD', 
      'POST_LINK', 
      'USER_TESTIMONY', 
      'PATTERN_ANALYSIS', 
      'EXTERNAL_LINK', 
      'WITNESS_ACCOUNT',
      'CHAT_LOG',
      'VIDEO_RECORDING',
      'AUDIO_RECORDING',
      'DOCUMENT',
      'OTHER'
    ],
    required: true,
    index: true
  },
  
  // File information
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO', 'UNKNOWN'],
    required: true
  },
  
  // IPFS storage information
  fileCID: {
    type: String,
    required: true
  },
  metadataCID: {
    type: String,
    required: true,
    index: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  metadataUrl: {
    type: String,
    required: true
  },
  
  // Evidence description and context
  description: {
    type: String,
    maxlength: 500
  },
  context: {
    type: String,
    maxlength: 1000
  },
  
  // Verification and integrity
  verified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  verificationMethod: {
    type: String,
    enum: ['MANUAL', 'AUTOMATED', 'COMMUNITY']
  },
  
  // Evidence quality metrics
  quality: {
    clarity: { type: Number, min: 1, max: 5, default: 3 },
    relevance: { type: Number, min: 1, max: 5, default: 3 },
    authenticity: { type: Number, min: 1, max: 5, default: 3 },
    completeness: { type: Number, min: 1, max: 5, default: 3 }
  },
  
  // Community interaction
  upvotes: {
    type: Number,
    default: 0
  },
  downvotes: {
    type: Number,
    default: 0
  },
  helpfulnessScore: {
    type: Number,
    default: 0
  },
  
  // Access and privacy
  isPublic: {
    type: Boolean,
    default: true
  },
  isAnonymous: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  
  // Technical metadata
  uploadMetadata: {
    userAgent: String,
    ipAddress: String, // Hashed for privacy
    uploadMethod: {
      type: String,
      enum: ['WEB_UPLOAD', 'SCREENSHOT_CAPTURE', 'DRAG_DROP', 'API'],
      default: 'WEB_UPLOAD'
    },
    clientTimestamp: Date,
    processingTime: Number // milliseconds
  },
  
  // Status and moderation
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED', 'REMOVED'],
    default: 'PENDING',
    index: true
  },
  moderationNotes: {
    type: String,
    maxlength: 500
  },
  flaggedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    flaggedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Backup and redundancy
  backupLocations: [{
    provider: String, // 'pinata', 'web3storage', 'local'
    cid: String,
    url: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Tags for categorization
  tags: [String]
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
evidenceSchema.index({ governanceCase: 1, evidenceType: 1 });
evidenceSchema.index({ submittedBy: 1, createdAt: -1 });
evidenceSchema.index({ status: 1, isPublic: 1 });
evidenceSchema.index({ fileCID: 1 }, { unique: true });

// Virtual fields
evidenceSchema.virtual('overallQuality').get(function() {
  const { clarity, relevance, authenticity, completeness } = this.quality;
  return (clarity + relevance + authenticity + completeness) / 4;
});

evidenceSchema.virtual('trustScore').get(function() {
  let score = this.overallQuality / 5; // Base quality score (0-1)
  
  if (this.verified) score += 0.2;
  if (this.upvotes > this.downvotes) score += 0.1;
  if (this.helpfulnessScore > 0) score += 0.1;
  if (this.flaggedBy.length > 0) score -= 0.2;
  
  return Math.max(0, Math.min(1, score));
});

evidenceSchema.virtual('formattedSize').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Methods
evidenceSchema.methods.generateEvidenceId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 8);
  return `evidence_${timestamp}_${random}`.toUpperCase();
};

evidenceSchema.methods.addBackupLocation = function(provider, cid, url) {
  this.backupLocations.push({
    provider: provider,
    cid: cid,
    url: url,
    createdAt: new Date()
  });
};

evidenceSchema.methods.verify = function(verifierId, method = 'MANUAL') {
  this.verified = true;
  this.verifiedBy = verifierId;
  this.verifiedAt = new Date();
  this.verificationMethod = method;
  
  // Boost quality scores for verified evidence
  if (method === 'COMMUNITY') {
    this.quality.authenticity = Math.min(5, this.quality.authenticity + 1);
  }
};

evidenceSchema.methods.flag = function(userId, reason) {
  const existingFlag = this.flaggedBy.find(flag => 
    flag.user.toString() === userId.toString()
  );
  
  if (!existingFlag) {
    this.flaggedBy.push({
      user: userId,
      reason: reason,
      flaggedAt: new Date()
    });
    
    // Auto-moderate if too many flags
    if (this.flaggedBy.length >= 3) {
      this.status = 'FLAGGED';
    }
  }
};

evidenceSchema.methods.vote = function(userId, isUpvote) {
  // In a real implementation, you'd track individual votes
  // For now, just update counters
  if (isUpvote) {
    this.upvotes += 1;
    this.helpfulnessScore += 1;
  } else {
    this.downvotes += 1;
    this.helpfulnessScore -= 0.5;
  }
  
  this.helpfulnessScore = Math.max(0, this.helpfulnessScore);
};

// Pre-save middleware
evidenceSchema.pre('save', function(next) {
  if (!this.evidenceId) {
    this.evidenceId = this.generateEvidenceId();
  }
  
  // Hash IP address for privacy
  if (this.uploadMetadata && this.uploadMetadata.ipAddress && !this.uploadMetadata.ipAddress.startsWith('hash_')) {
    const crypto = require('crypto');
    this.uploadMetadata.ipAddress = 'hash_' + crypto.createHash('sha256')
      .update(this.uploadMetadata.ipAddress)
      .digest('hex')
      .substring(0, 16);
  }
  
  next();
});

// Static methods
evidenceSchema.statics.getByCase = async function(governanceCaseId, options = {}) {
  const { 
    includePrivate = false, 
    sortBy = 'createdAt', 
    order = -1,
    limit = 50 
  } = options;
  
  const query = { 
    governanceCase: governanceCaseId,
    status: { $in: ['APPROVED', 'PENDING'] }
  };
  
  if (!includePrivate) {
    query.isPublic = true;
  }
  
  return await this.find(query)
    .sort({ [sortBy]: order })
    .limit(limit)
    .populate('submittedBy', 'username walletAddress')
    .populate('verifiedBy', 'username');
};

evidenceSchema.statics.getHighQuality = async function(governanceCaseId, minQuality = 3.5) {
  return await this.aggregate([
    {
      $match: {
        governanceCase: new mongoose.Types.ObjectId(governanceCaseId),
        status: 'APPROVED'
      }
    },
    {
      $addFields: {
        avgQuality: {
          $avg: [
            '$quality.clarity',
            '$quality.relevance', 
            '$quality.authenticity',
            '$quality.completeness'
          ]
        }
      }
    },
    {
      $match: {
        avgQuality: { $gte: minQuality }
      }
    },
    {
      $sort: { avgQuality: -1, helpfulnessScore: -1 }
    }
  ]);
};

evidenceSchema.statics.getStatsByCase = async function(governanceCaseId) {
  return await this.aggregate([
    { $match: { governanceCase: new mongoose.Types.ObjectId(governanceCaseId) } },
    {
      $group: {
        _id: null,
        totalEvidence: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
        avgQuality: { $avg: { $avg: [
          '$quality.clarity', '$quality.relevance',
          '$quality.authenticity', '$quality.completeness'
        ]}},
        evidenceTypes: { $addToSet: '$evidenceType' },
        verifiedCount: { $sum: { $cond: ['$verified', 1, 0] } },
        publicCount: { $sum: { $cond: ['$isPublic', 1, 0] } }
      }
    }
  ]);
};

module.exports = mongoose.model('Evidence', evidenceSchema);