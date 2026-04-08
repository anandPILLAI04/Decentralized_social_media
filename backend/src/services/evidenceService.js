const Evidence = require('../models/Evidence');
const GovernanceCase = require('../models/GovernanceCase');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * Evidence Service
 * Handles evidence storage, validation, and management for governance cases
 */

// Maximum file sizes (in bytes)
const MAX_FILE_SIZES = {
  IMAGE: 10 * 1024 * 1024,    // 10MB
  DOCUMENT: 5 * 1024 * 1024,   // 5MB  
  VIDEO: 50 * 1024 * 1024,     // 50MB
  AUDIO: 20 * 1024 * 1024      // 20MB
};

// Supported MIME types
const SUPPORTED_TYPES = {
  IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENT: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  AUDIO: ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg']
};

/**
 * Get file category from MIME type
 */
function getFileCategory(mimeType) {
  for (const [category, types] of Object.entries(SUPPORTED_TYPES)) {
    if (types.includes(mimeType)) {
      return category;
    }
  }
  return 'UNKNOWN';
}

/**
 * Validate evidence file
 */
function validateEvidenceFile(file) {
  const errors = [];
  
  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors };
  }
  
  // Check file type
  const category = getFileCategory(file.mimetype);
  if (category === 'UNKNOWN') {
    errors.push(`Unsupported file type: ${file.mimetype}`);
  }
  
  // Check file size
  const maxSize = MAX_FILE_SIZES[category];
  if (maxSize && file.size > maxSize) {
    errors.push(`File too large. Maximum size for ${category.toLowerCase()}: ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
  }
  
  // Check for empty files
  if (file.size === 0) {
    errors.push('Empty file not allowed');
  }
  
  // Security checks
  const fileName = file.originalname || file.filename || '';
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    errors.push('Invalid file name');
  }
  
  // Check for executable files
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.com', '.pif', '.js', '.jar'];
  const fileExt = path.extname(fileName).toLowerCase();
  if (dangerousExtensions.includes(fileExt)) {
    errors.push('Executable files not allowed');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    category,
    size: file.size
  };
}

/**
 * Store evidence metadata in database
 */
async function storeEvidenceMetadata(evidenceData) {
  try {
    const evidence = new Evidence(evidenceData);
    await evidence.save();
    return evidence;
  } catch (error) {
    console.error('Error storing evidence metadata:', error);
    throw new Error(`Failed to store evidence metadata: ${error.message}`);
  }
}

/**
 * Create evidence record from IPFS upload result
 */
async function createEvidenceRecord(uploadResult, governanceCaseId, submitterId, requestData) {
  const {
    fileCID,
    metadataCID,
    fileName,
    fileSize,
    mimeType,
    description = '',
    evidenceType = 'USER_UPLOAD',
    context = '',
    isAnonymous = false,
    userAgent = '',
    ipAddress = ''
  } = requestData;
  
  const category = getFileCategory(mimeType);
  
  const evidenceData = {
    // Case and submitter
    governanceCase: governanceCaseId,
    submittedBy: submitterId,
    submitterAddress: requestData.submitterAddress,
    
    // Evidence classification
    evidenceType: evidenceType,
    
    // File information
    fileName: fileName,
    fileSize: fileSize,
    mimeType: mimeType,
    category: category,
    
    // IPFS storage
    fileCID: fileCID,
    metadataCID: metadataCID,
    fileUrl: `https://gateway.pinata.cloud/ipfs/${fileCID}`,
    metadataUrl: `https://gateway.pinata.cloud/ipfs/${metadataCID}`,
    
    // Descriptions
    description: description,
    context: context,
    
    // Privacy settings
    isAnonymous: isAnonymous,
    
    // Technical metadata
    uploadMetadata: {
      userAgent: userAgent,
      ipAddress: ipAddress,
      uploadMethod: 'WEB_UPLOAD',
      clientTimestamp: new Date(),
      processingTime: Date.now() - uploadResult.startTime
    },
    
    // Initial quality assessment (can be updated by community)
    quality: {
      clarity: 3,
      relevance: 3, 
      authenticity: 3,
      completeness: 3
    },
    
    // Status
    status: 'PENDING'
  };
  
  return await storeEvidenceMetadata(evidenceData);
}

/**
 * Get evidence by governance case
 */
async function getEvidenceByCase(governanceCaseId, options = {}) {
  try {
    const {
      includePrivate = false,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
      evidenceType = null,
      verified = null
    } = options;
    
    const query = {
      governanceCase: governanceCaseId,
      status: { $in: ['APPROVED', 'PENDING'] }
    };
    
    if (!includePrivate) {
      query.isPublic = true;
    }
    
    if (evidenceType) {
      query.evidenceType = evidenceType;
    }
    
    if (verified !== null) {
      query.verified = verified;
    }
    
    const sortDirection = order === 'desc' ? -1 : 1;
    const skip = (page - 1) * limit;
    
    const evidence = await Evidence.find(query)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit)
      .populate('submittedBy', 'username walletAddress avatar')
      .populate('verifiedBy', 'username')
      .lean();
    
    const total = await Evidence.countDocuments(query);
    
    return {
      success: true,
      evidence: evidence,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        pages: Math.ceil(total / limit)
      }
    };
    
  } catch (error) {
    console.error('Error fetching evidence:', error);
    throw new Error(`Failed to fetch evidence: ${error.message}`);
  }
}

/**
 * Get evidence statistics for a case
 */
async function getEvidenceStats(governanceCaseId) {
  try {
    const stats = await Evidence.aggregate([
      { $match: { governanceCase: new mongoose.Types.ObjectId(governanceCaseId) } },
      {
        $group: {
          _id: null,
          totalEvidence: { $sum: 1 },
          totalSize: { $sum: '$fileSize' },
          avgQuality: {
            $avg: {
              $avg: [
                '$quality.clarity',
                '$quality.relevance',
                '$quality.authenticity', 
                '$quality.completeness'
              ]
            }
          },
          evidenceTypes: { $addToSet: '$evidenceType' },
          categories: { $addToSet: '$category' },
          verifiedCount: { $sum: { $cond: ['$verified', 1, 0] } },
          publicCount: { $sum: { $cond: ['$isPublic', 1, 0] } },
          totalUpvotes: { $sum: '$upvotes' },
          totalDownvotes: { $sum: '$downvotes' }
        }
      }
    ]);
    
    return {
      success: true,
      stats: stats.length > 0 ? stats[0] : {
        totalEvidence: 0,
        totalSize: 0,
        avgQuality: 0,
        evidenceTypes: [],
        categories: [],
        verifiedCount: 0,
        publicCount: 0,
        totalUpvotes: 0,
        totalDownvotes: 0
      }
    };
    
  } catch (error) {
    console.error('Error fetching evidence stats:', error);
    throw new Error(`Failed to fetch evidence stats: ${error.message}`);
  }
}

/**
 * Verify evidence
 */
async function verifyEvidence(evidenceId, verifierId, method = 'MANUAL') {
  try {
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return { success: false, message: 'Evidence not found' };
    }
    
    evidence.verify(verifierId, method);
    evidence.status = 'APPROVED';
    await evidence.save();
    
    return {
      success: true,
      message: 'Evidence verified successfully',
      evidence: evidence
    };
    
  } catch (error) {
    console.error('Error verifying evidence:', error);
    throw new Error(`Failed to verify evidence: ${error.message}`);
  }
}

/**
 * Flag evidence as inappropriate
 */
async function flagEvidence(evidenceId, userId, reason) {
  try {
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return { success: false, message: 'Evidence not found' };
    }
    
    evidence.flag(userId, reason);
    await evidence.save();
    
    return {
      success: true,
      message: 'Evidence flagged successfully',
      flagCount: evidence.flaggedBy.length
    };
    
  } catch (error) {
    console.error('Error flagging evidence:', error);
    throw new Error(`Failed to flag evidence: ${error.message}`);
  }
}

/**
 * Vote on evidence quality
 */
async function voteOnEvidence(evidenceId, userId, isUpvote) {
  try {
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return { success: false, message: 'Evidence not found' };
    }
    
    evidence.vote(userId, isUpvote);
    await evidence.save();
    
    return {
      success: true,
      message: `Evidence ${isUpvote ? 'upvoted' : 'downvoted'} successfully`,
      upvotes: evidence.upvotes,
      downvotes: evidence.downvotes,
      helpfulnessScore: evidence.helpfulnessScore
    };
    
  } catch (error) {
    console.error('Error voting on evidence:', error);
    throw new Error(`Failed to vote on evidence: ${error.message}`);
  }
}

/**
 * Delete evidence (soft delete by changing status)
 */
async function deleteEvidence(evidenceId, userId) {
  try {
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return { success: false, message: 'Evidence not found' };
    }
    
    // Check if user is the submitter or has admin rights
    if (evidence.submittedBy.toString() !== userId.toString()) {
      return { success: false, message: 'Not authorized to delete this evidence' };
    }
    
    evidence.status = 'REMOVED';
    evidence.moderationNotes = `Deleted by submitter at ${new Date()}`;
    await evidence.save();
    
    return {
      success: true,
      message: 'Evidence deleted successfully'
    };
    
  } catch (error) {
    console.error('Error deleting evidence:', error);
    throw new Error(`Failed to delete evidence: ${error.message}`);
  }
}

/**
 * Get evidence by ID with access control
 */
async function getEvidenceById(evidenceId, userId = null, options = {}) {
  try {
    const evidence = await Evidence.findById(evidenceId)
      .populate('submittedBy', 'username walletAddress avatar')
      .populate('verifiedBy', 'username')
      .populate('governanceCase', 'title type status');
    
    if (!evidence) {
      return { success: false, message: 'Evidence not found' };
    }
    
    // Check access permissions
    if (!evidence.isPublic && evidence.submittedBy._id.toString() !== userId?.toString()) {
      return { success: false, message: 'Access denied' };
    }
    
    if (evidence.status === 'REMOVED') {
      return { success: false, message: 'Evidence has been removed' };
    }
    
    // Increment view count
    evidence.viewCount += 1;
    await evidence.save();
    
    return {
      success: true,
      evidence: evidence
    };
    
  } catch (error) {
    console.error('Error fetching evidence:', error);
    throw new Error(`Failed to fetch evidence: ${error.message}`);
  }
}

/**
 * Bulk upload evidence metadata
 */
async function bulkCreateEvidence(evidenceList, governanceCaseId, submitterId) {
  try {
    const results = [];
    const errors = [];
    
    for (const evidenceData of evidenceList) {
      try {
        const evidence = await createEvidenceRecord(
          { startTime: Date.now() },
          governanceCaseId,
          submitterId,
          evidenceData
        );
        results.push(evidence);
      } catch (error) {
        errors.push({
          fileName: evidenceData.fileName,
          error: error.message
        });
      }
    }
    
    return {
      success: results.length > 0,
      evidence: results,
      errors: errors,
      summary: {
        total: evidenceList.length,
        successful: results.length,
        failed: errors.length
      }
    };
    
  } catch (error) {
    console.error('Error in bulk evidence creation:', error);
    throw new Error(`Bulk evidence creation failed: ${error.message}`);
  }
}

module.exports = {
  validateEvidenceFile,
  createEvidenceRecord,
  storeEvidenceMetadata,
  getEvidenceByCase,
  getEvidenceStats,
  verifyEvidence,
  flagEvidence,
  voteOnEvidence,
  deleteEvidence,
  getEvidenceById,
  bulkCreateEvidence,
  MAX_FILE_SIZES,
  SUPPORTED_TYPES,
  getFileCategory
};