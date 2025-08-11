const API_BASE_URL = 'http://localhost:4000/api';

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
}

// Social Media API calls
export async function fetchPosts(page = 1, limit = 10) {
  return apiCall(`/social/posts?page=${page}&limit=${limit}`);
}

export async function fetchPost(postId) {
  return apiCall(`/social/posts/${postId}`);
}

export async function createPost(postData) {
  return apiCall('/social/posts', {
    method: 'POST',
    body: JSON.stringify(postData),
  });
}

export async function likePost(postId, userAddress) {
  return apiCall(`/social/posts/${postId}/like`, {
    method: 'POST',
    body: JSON.stringify({ userAddress }),
  });
}

export async function addComment(postId, commentData) {
  return apiCall(`/social/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(commentData),
  });
}

export async function fetchComments(postId, page = 1, limit = 20) {
  return apiCall(`/social/posts/${postId}/comments?page=${page}&limit=${limit}`);
}

export async function fetchPostsByAuthor(author, page = 1, limit = 10) {
  return apiCall(`/social/posts/author/${author}?page=${page}&limit=${limit}`);
}

export async function searchPosts(query, page = 1, limit = 10) {
  return apiCall(`/social/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
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
