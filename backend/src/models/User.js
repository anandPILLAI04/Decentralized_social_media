const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  avatar: { type: String, default: '' },
  avatarIpfsHash: { type: String, default: '' },
  bio: { type: String, default: '' },
  email: { type: String, default: '' },
  displayName: { type: String, default: '' },
  location: { type: String, default: '' },
  website: { type: String, default: '' },
  twitter: { type: String, default: '' },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  dateJoined: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  isFirstLogin: { type: Boolean, default: true },
  
  // Moderation and governance fields
  moderation: {
    // Warning system
    warnings: [{
      reason: String,
      issuedAt: { type: Date, default: Date.now },
      issuedBy: String, // wallet address or 'COMMUNITY_GOVERNANCE'
      level: { type: Number, default: 1 },
      caseId: String
    }],
    warningCount: { type: Number, default: 0 },
    
    // Restrictions
    restricted: { type: Boolean, default: false },
    restrictionStart: { type: Date },
    restrictionEnd: { type: Date },
    restrictionReason: String,
    restrictions: [String], // ['posting', 'commenting', 'voting']
    restrictionRemovedAt: { type: Date },
    restrictionRemovedReason: String,
    
    // Suspensions
    suspended: { type: Boolean, default: false },
    suspensionStart: { type: Date },
    suspensionEnd: { type: Date },
    suspensionReason: String,
    suspendedBy: String, // wallet address or 'COMMUNITY_GOVERNANCE'
    
    // Bans
    banned: { type: Boolean, default: false },
    bannedAt: { type: Date },
    bannedReason: String,
    bannedBy: String, // wallet address or 'COMMUNITY_GOVERNANCE'
    permanent: { type: Boolean, default: false },
    
    // Moderation history
    moderationHistory: [{
      action: String, // 'warned', 'restricted', 'suspended', 'banned'
      reason: String,
      duration: Number, // in milliseconds
      issuedAt: { type: Date, default: Date.now },
      issuedBy: String,
      caseId: String
    }]
  },

  // Content preferences
  contentPreferences: {
    // Sensitive content handling
    showSensitiveContent: { type: Boolean, default: false },
    hideSensitiveContent: { type: Boolean, default: false },
    autoBlurMedia: { type: Boolean, default: true },
    allowExplicitContent: { type: Boolean, default: false },
    
    // Content filtering levels
    violenceFilter: { type: String, enum: ['strict', 'moderate', 'permissive'], default: 'moderate' },
    languageFilter: { type: String, enum: ['strict', 'moderate', 'permissive'], default: 'moderate' },
    
    // User reporting preferences
    allowContentReports: { type: Boolean, default: true },
    notifyOnContentWarnings: { type: Boolean, default: true },
    
    // Timestamps
    updatedAt: { type: Date, default: Date.now }
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
