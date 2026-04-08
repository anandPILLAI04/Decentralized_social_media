// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

// Import safe localStorage utilities
import { getToken, getPersistedToken } from '../utils/safeStorage.js';

// Auth API calls
export async function signupUser({ walletAddress, username, avatar, avatarIpfsHash, bio, email, displayName, location, website, twitter, signature, message }) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress, username, avatar, avatarIpfsHash, bio, email, displayName, location, website, twitter, signature, message }),
    });

    const data = await response.json();

    // Handle 409 (conflict - user or username already exists) specially
    if (response.status === 409) {
      if (data.error.includes('already exists')) {
        // User with this wallet already exists - they should login instead
        return {
          success: false,
          error: 'This wallet is already registered. Please use the Sign In tab.',
          shouldLogin: true
        };
      } else if (data.error.includes('Username already taken')) {
        return {
          success: false,
          error: 'This username is already taken. Please choose a different username.',
          usernameTaken: true
        };
      }
      return { success: false, error: data.error };
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return { success: true, ...data };
  } catch (error) {
    console.error(`Signup API call failed:`, error);
    throw error;
  }
}

// Get challenge message (nonce) for wallet signature
export async function getNonce(walletAddress) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/nonce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to get nonce');
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get nonce:', error);
    throw error;
  }
}

export async function loginUser(walletAddress, signature, message) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress, signature, message }),
    });

    const data = await response.json();

    // Handle 404 (new user) specially
    if (response.status === 404 && data.isNewUser) {
      return { isNewUser: true, user: null };
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    if (data.token) {
      localStorage.setItem('token', data.token);
    }

    return data;
  } catch (error) {
    console.error(`Login API call failed:`, error);
    throw error;
  }
}

export async function logoutUser() {
  try {
    // Clear any stored authentication tokens
    localStorage.removeItem('token');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('userProfile');
    
    // You could also call a backend logout endpoint if needed
    // const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   }
    // });

    return { success: true, message: 'Logged out successfully' };
  } catch (error) {
    console.error('Logout failed:', error);
    // Even if the API call fails, we should still clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('userProfile');
    return { success: true, message: 'Logged out locally' };
  }
}

export async function getUserProfile(walletAddress) {
  return apiCall(`/auth/user/${walletAddress}`);
}

export async function updateUserProfile(walletAddress, updates) {
  return apiCall(`/auth/user/${walletAddress}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function uploadAvatar(walletAddress, file) {
  const formData = new FormData();
  formData.append('avatar', file);
  formData.append('walletAddress', walletAddress);

  try {
    console.log('📸 Uploading avatar for wallet:', walletAddress.slice(0, 10) + '...');
    const response = await fetch(`${API_BASE_URL}/auth/upload-avatar`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type - browser will set it with boundary
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Avatar upload server error:', data);
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    console.log('✅ Avatar uploaded successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Avatar upload failed:', error.message);
    throw error;
  }
}

// Helper function for API calls with automatic token injection
async function apiCall(endpoint, options = {}) {
  try {
    // Get token safely
    const token = getToken();
    console.log(`🔑 API call to ${endpoint} - Token exists:`, !!token);

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add Authorization header if token exists and not already provided
    if (token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log(`✅ Authorization header added`);
    } else if (!token) {
      console.warn('⚠️  No token found for request');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
      ...options,
    });

    if (!response.ok) {
      // Try to parse error response for detailed error info
      let errorData = null;
      try {
        errorData = await response.json();
      } catch (parseError) {
        // If JSON parsing fails, use status text
        errorData = { message: response.statusText };
      }

      const error = new Error(`HTTP error! status: ${response.status}`);
      error.responseData = errorData; // Attach detailed error data
      error.status = response.status;
      throw error;
    }

    return await response.json();
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
}

// Social Media API calls
export async function fetchPosts(page = 1, limit = 10, options = {}) {
  const { sort = 'latest', filter = 'all', following = false, userId = null } = options;
  
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sort,
    filter,
    following: following.toString()
  });
  
  if (userId) {
    params.append('userId', userId);
  }
  
  return apiCall(`/social/posts?${params.toString()}`);
}

export async function fetchPost(postId) {
  return apiCall(`/social/posts/${postId}`);
}

export async function createPost(postData) {
  const response = await apiCall('/social/posts', {
    method: 'POST',
    body: JSON.stringify(postData),
  });
  
  // Log if post was stored on IPFS
  if (response.contentCID) {
    console.log('✅ Post content stored on IPFS:', response.contentCID);
  }
  
  return response;
}

// Delete post
export async function deletePost(postId, userId) {
  console.log('🗑️ deletePost API called:', { postId, userId });

  if (!postId) {
    console.error('❌ postId is missing!');
    throw new Error('Post ID is required to delete a post');
  }

  try {
    const requestBody = {};
    if (userId) {
      requestBody.userId = userId;
    }

    const response = await apiCall(`/social/posts/${postId}`, {
      method: 'DELETE',
      body: JSON.stringify(requestBody),
    });

    console.log('✅ deletePost response:', response);
    return response;
  } catch (error) {
    console.error('❌ deletePost error:', error);
    throw error;
  }
}

// Update post NFT status after minting
export async function updatePostNFTStatus(postId, nftData) {
  return apiCall(`/social/posts/${postId}/nft`, {
    method: 'PATCH',
    body: JSON.stringify(nftData),
  });
}

export async function uploadFileToIPFS(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    // Add timeout handling for large file uploads
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    const response = await fetch(`${API_BASE_URL}/social/upload`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('IPFS upload failed:', error);
    if (error.name === 'AbortError') {
      throw new Error('Upload timeout - file might be too large or network is slow. Please try a smaller file.');
    }
    throw error;
  }
}

export async function uploadJSONToIPFS(content) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(`${API_BASE_URL}/social/upload/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('JSON upload to IPFS failed:', error);
    if (error.name === 'AbortError') {
      throw new Error('Upload timeout - network might be slow. Please try again.');
    }
    throw error;
  }
}

// Like/Unlike Posts
export async function likePost(postId, userAddress) {
  return apiCall(`/social/posts/${postId}/like`, {
    method: 'POST',
    body: JSON.stringify({ userAddress }),
  });
}

export async function unlikePost(postId, userAddress) {
  return apiCall(`/social/posts/${postId}/like`, {
    method: 'DELETE',
    body: JSON.stringify({ userAddress }),
  });
}

export async function checkLikeStatus(postId, userAddress) {
  if (!userAddress) return { success: true, hasLiked: false };
  return apiCall(`/social/posts/${postId}/like/status?userAddress=${userAddress}`);
}

export async function toggleLike(postId, userAddress) {
  try {
    // First check current like status
    const status = await checkLikeStatus(postId, userAddress);
    
    if (status.hasLiked) {
      // If already liked, unlike it
      return await unlikePost(postId, userAddress);
    } else {
      // If not liked, like it
      return await likePost(postId, userAddress);
    }
  } catch (error) {
    console.error('Toggle like failed:', error);
    throw error;
  }
}

// Comments
export async function addComment(postId, commentData) {
  return apiCall(`/social/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(commentData),
  });
}

export async function fetchComments(postId, page = 1, limit = 20) {
  return apiCall(`/social/posts/${postId}/comments?page=${page}&limit=${limit}`);
}

export async function deleteComment(commentId, userAddress) {
  return apiCall(`/social/comments/${commentId}`, {
    method: 'DELETE',
    body: JSON.stringify({ userAddress }),
  });
}

// Follow/Unfollow
export async function followUser(address, followerAddress) {
  return apiCall(`/auth/users/${address}/follow`, {
    method: 'POST',
    body: JSON.stringify({ followerAddress }),
  });
}

export async function unfollowUser(address, followerAddress) {
  return apiCall(`/auth/users/${address}/follow`, {
    method: 'DELETE',
    body: JSON.stringify({ followerAddress }),
  });
}

export async function checkFollowStatus(address, followerAddress) {
  if (!followerAddress) return { success: true, isFollowing: false };
  return apiCall(`/auth/users/${address}/follow/status?followerAddress=${followerAddress}`);
}

export async function fetchFollowers(address, page = 1, limit = 20) {
  return apiCall(`/auth/users/${address}/followers?page=${page}&limit=${limit}`);
}

export async function fetchFollowing(address, page = 1, limit = 20) {
  return apiCall(`/auth/users/${address}/following?page=${page}&limit=${limit}`);
}

export async function fetchPostsByAuthor(author, page = 1, limit = 10) {
  return apiCall(`/social/posts/author/${author}?page=${page}&limit=${limit}`);
}

export async function searchPosts(query, page = 1, limit = 10) {
  return apiCall(`/social/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
}

export async function searchUsers(query, limit = 20) {
  return apiCall(`/auth/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

// Notifications API calls
export async function fetchNotifications(recipient, page = 1, limit = 20) {
  if (!recipient) return { success: false, error: 'Recipient address required' };
  
  // Normalize the address to lowercase to match backend format
  const normalizedRecipient = recipient.toLowerCase();
  
  const params = new URLSearchParams({
    recipient: normalizedRecipient,
    page: page.toString(),
    limit: limit.toString()
  });
  
  try {
    const response = await apiCall(`/notifications?${params.toString()}`);
    console.log('🔔 fetchNotifications raw response:', response);
    // Backend returns data wrapped in a 'data' object, unwrap it for frontend
    if (response.success && response.data) {
      return {
        success: true,
        notifications: response.data.notifications,
        pagination: response.data.pagination
      };
    }
    return response;
  } catch (error) {
    console.error('fetchNotifications error:', error);
    return { success: false, error: error.message };
  }
}

export async function fetchUnreadCount(recipient) {
  if (!recipient) return { success: false, count: 0 };
  
  // Normalize the address to lowercase to match backend format
  const normalizedRecipient = recipient.toLowerCase();
  
  try {
    const response = await apiCall(`/notifications/unread-count?recipient=${normalizedRecipient}`);
    console.log('🔔 fetchUnreadCount raw response:', response);
    // Backend returns data wrapped in a 'data' object, unwrap it for frontend  
    if (response.success && response.data) {
      return {
        success: true,
        count: response.data.unreadCount
      };
    }
    return response;
  } catch (error) {
    console.error('fetchUnreadCount error:', error);
    return { success: false, count: 0 };
  }
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) return { success: false, error: 'Notification ID required' };
  return apiCall(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead(recipient) {
  if (!recipient) return { success: false, error: 'Recipient address required' };
  return apiCall(`/notifications/read-all?recipient=${recipient}`, {
    method: 'PATCH',
  });
}

// Clear all notifications for a user
export async function clearAllNotifications(recipient) {
  if (!recipient) return { success: false, error: 'Recipient address required' };
  return apiCall(`/notifications/clear?recipient=${recipient}`, {
    method: 'DELETE',
  });
}

// Governance API calls
export async function fetchProposals(page = 1, limit = 10, status) {
  const params = new URLSearchParams({ page, limit });
  if (status) params.append('status', status);
  return apiCall(`/governance/proposals?${params}`);
}

export async function fetchProposal(proposalId) {
  return apiCall(`/governance/proposals/${proposalId}`);
}

export async function createProposal(proposalData) {
  return apiCall('/governance/proposals', {
    method: 'POST',
    body: JSON.stringify(proposalData),
  });
}

export async function voteOnProposal(proposalId, voteData) {
  return apiCall(`/governance/proposals/${proposalId}/vote`, {
    method: 'POST',
    body: JSON.stringify(voteData),
  });
}

export async function executeProposal(proposalId) {
  return apiCall(`/governance/proposals/${proposalId}/execute`, {
    method: 'POST',
  });
}

export async function cancelProposal(proposalId, canceler) {
  return apiCall(`/governance/proposals/${proposalId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ canceler }),
  });
}

export async function fetchGovernanceStats() {
  return apiCall('/governance/stats');
}

// Enhanced Governance API calls
export async function fetchGovernanceCases(page = 1, limit = 10, status, type) {
  const params = new URLSearchParams({ page, limit });
  if (status) params.append('status', status);
  if (type) params.append('type', type);
  return apiCall(`/governance/cases?${params}`);
}

export async function fetchGovernanceCase(caseId) {
  return apiCall(`/governance/cases/${caseId}`);
}

export async function createGovernanceCase(caseData) {
  return apiCall('/governance/cases', {
    method: 'POST',
    body: JSON.stringify(caseData),
  });
}

export async function activateGovernanceVoting(caseId) {
  return apiCall(`/governance/cases/${caseId}/activate-voting`, {
    method: 'POST',
  });
}

export async function autoActivateGovernanceVoting(maxPendingHours = 24) {
  return apiCall('/governance/cases/auto-activate-voting', {
    method: 'POST',
    body: JSON.stringify({ maxPendingHours }),
  });
}

export async function voteOnGovernanceCase(caseId, voteData) {
  return apiCall(`/governance/cases/${caseId}/vote`, {
    method: 'POST',
    body: JSON.stringify(voteData),
  });
}

export async function fetchGovernanceVotes(caseId, page = 1, limit = 10) {
  const params = new URLSearchParams({ page, limit });
  return apiCall(`/governance/cases/${caseId}/votes?${params}`);
}

export async function fetchGovernanceDashboard() {
  return apiCall('/governance/dashboard');
}

// Blockchain API calls
export async function fetchBlockchainStatus() {
  return apiCall('/blockchain/status');
}

export async function fetchContractAddresses() {
  return apiCall('/blockchain/addresses');
}

export async function fetchPostFromBlockchain(postId) {
  return apiCall(`/blockchain/posts/${postId}`);
}

export async function fetchPostCount() {
  return apiCall('/blockchain/posts/count');
}

export async function fetchPostsByAuthorFromBlockchain(author, limit = 10, offset = 0) {
  return apiCall(`/blockchain/posts/author/${author}?limit=${limit}&offset=${offset}`);
}

export async function fetchGovernanceProposalFromBlockchain(proposalId) {
  return apiCall(`/blockchain/governance/proposals/${proposalId}`);
}

export async function fetchProposalCount() {
  return apiCall('/blockchain/governance/proposals/count');
}

export async function fetchVotingPower(address) {
  return apiCall(`/blockchain/governance/voting-power/${address}`);
}

// Moderation API calls
export async function analyzeContent(text) {
  return apiCall('/moderation/analyze', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// Health check
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Utility function to format error messages
export function formatErrorMessage(error) {
  if (error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

// Utility function to handle API errors
export function handleApiError(error, defaultMessage = 'Operation failed') {
  const message = formatErrorMessage(error) || defaultMessage;
  console.error('API Error:', error);
  return { success: false, error: message };
}

// Voting Power API calls
export const votingPowerAPI = {
  // Calculate voting power for a wallet address
  calculatePower: async (walletAddress) => {
    return apiCall(`/voting-power/calculate/${walletAddress}`);
  },

  // Update voting power for authenticated user
  updatePower: async (walletAddress) => {
    return apiCall('/voting-power/update', {
      method: 'POST',
      headers: {
        'x-wallet-address': walletAddress
      }
    });
  },

  // Get member's current voting power from database
  getMemberPower: async (walletAddress) => {
    return apiCall(`/voting-power/member/${walletAddress}`);
  },

  // Get voting power leaderboard
  getLeaderboard: async (limit = 50, page = 1) => {
    return apiCall(`/voting-power/leaderboard?limit=${limit}&page=${page}`);
  },

  // Check voting eligibility for specific actions
  checkEligibility: async (walletAddress, action = 'vote') => {
    return apiCall(`/voting-power/eligibility/${walletAddress}?action=${action}`);
  },

  // Get voting power statistics
  getStats: async () => {
    return apiCall('/voting-power/stats');
  },

  // Batch update voting power (admin only)
  batchUpdate: async (walletAddresses, adminKey) => {
    return apiCall('/voting-power/batch-update', {
      method: 'POST',
      body: JSON.stringify({
        walletAddresses,
        adminKey
      })
    });
  }
};

// Content Moderation API
export const moderationAPI = {
  // Moderate content (text, image, or video)
  moderateContent: async (formData) => {
    try {
      const token = getToken();
      const headers = {};
      
      // Only add Authorization header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE_URL}/moderation/analyze`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Moderation failed: ${response.status}`);
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      console.error('Content moderation error:', error);
      throw error;
    }
  },

  // Get content warning configuration
  getContentWarning: (analysisResult, userPreferences = {}) => {
    if (!analysisResult.shouldBlur) {
      return null;
    }

    const warning = analysisResult.warning || {
      type: 'sensitive_content',
      title: '⚠️ Sensitive Content',
      message: 'This content may not be suitable for all audiences.',
      action: 'Click to view'
    };

    // Check user preferences
    if (userPreferences.showSensitiveContent === true) {
      return null; // User has opted to always show sensitive content
    }

    if (userPreferences.hideSensitiveContent === true) {
      warning.hidden = true; // Completely hide the content
    }

    return {
      ...warning,
      confidence: analysisResult.confidence,
      reasons: analysisResult.reasons,
      blurLevel: getBlurLevel(analysisResult.confidence),
      userCanOverride: true
    };
  },

  // Update user content preferences
  updateContentPreferences: async (walletAddress, preferences) => {
    return apiCall('/moderation/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        walletAddress,
        preferences
      })
    });
  },

  // Get user content preferences
  getContentPreferences: async (walletAddress) => {
    return apiCall(`/moderation/preferences/${walletAddress}`);
  },

  // Report inappropriate content
  reportContent: async (contentId, contentType, reason, description) => {
    return apiCall('/moderation/report', {
      method: 'POST',
      body: JSON.stringify({
        contentId,
        contentType,
        reason,
        description
      })
    });
  }
};

// Helper function for blur level
const getBlurLevel = (confidence) => {
  if (confidence > 0.9) return 'heavy';  // 20px blur
  if (confidence > 0.7) return 'medium'; // 15px blur
  if (confidence > 0.5) return 'light';  // 10px blur
  return 'light';
};

// Add moderation methods to main apiService
export const apiService = {
  ...Object.fromEntries(Object.entries({
    signupUser,
    loginUser,
    logoutUser,
    createPost,
    fetchPosts,
    toggleLike,
    addComment,
    fetchComments,
    followUser,
    unfollowUser,
    getUserProfile,
    fetchFollowers,
    fetchFollowing,
    updateUserProfile,
    uploadFileToIPFS,
    deletePost,
    deleteComment,
    apiCall,
    fetchNotifications,
    fetchUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications
  })),
  
  // Content moderation
  moderateContent: moderationAPI.moderateContent,
  getContentWarning: moderationAPI.getContentWarning,
  updateContentPreferences: moderationAPI.updateContentPreferences,
  getContentPreferences: moderationAPI.getContentPreferences,
  reportContent: moderationAPI.reportContent,
  
  // Voting power API
  votingPowerAPI
};

// Enhanced Governance API calls
export const enhancedGovernanceAPI = {
  // Create a governance case
  createCase: async (caseData) => {
    return apiCall('/enhanced-governance/cases', {
      method: 'POST',
      body: JSON.stringify(caseData)
    });
  },

  // Get all governance cases
  getCases: async (params = {}) => {
    const queryParams = new URLSearchParams(params);
    return apiCall(`/enhanced-governance/cases?${queryParams}`);
  },

  // Get single governance case
  getCase: async (caseId) => {
    return apiCall(`/enhanced-governance/cases/${caseId}`);
  },

  // Vote on a governance case
  voteOnCase: async (caseId, voteData) => {
    return apiCall(`/enhanced-governance/cases/${caseId}/vote`, {
      method: 'POST',
      body: JSON.stringify(voteData)
    });
  },

  // Activate voting for a case
  activateVoting: async (caseId) => {
    return apiCall(`/enhanced-governance/cases/${caseId}/activate-voting`, {
      method: 'POST'
    });
  },

  // Auto-activate voting for old pending cases
  autoActivateVoting: async (maxPendingHours = 24) => {
    return apiCall('/enhanced-governance/cases/auto-activate-voting', {
      method: 'POST',
      body: JSON.stringify({ maxPendingHours })
    });
  },

  // Get dashboard data
  getDashboard: async () => {
    return apiCall('/enhanced-governance/dashboard');
  },

  // Get user voting power
  getUserVotingPower: async (walletAddress) => {
    return apiCall(`/enhanced-governance/voting-power/${walletAddress}`);
  }
};
