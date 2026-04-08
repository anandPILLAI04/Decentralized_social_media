import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { Box, Avatar, Typography, Button, Grid, Paper, CircularProgress, Chip, IconButton } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LanguageIcon from '@mui/icons-material/Language';
import TwitterIcon from '@mui/icons-material/Twitter';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import PostCard from "../components/PostCard";
import EditProfileModal from "../components/EditProfileModal";
import FollowButton from "../components/FollowButton";
import CommunityReportModal from "../components/CommunityReportModal";
import { getUserProfile, fetchPostsByAuthor } from "../services/apiService";
import { useToast } from '../hooks/useToast';

const Profile = ({ walletAddress, posts = [] }) => {
  const { address } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { userProfile: authUserProfile, walletAddress: authWallet } = useAuth();

  // If address is provided in URL, use that; otherwise use current user's address
  const profileAddress = address || walletAddress || authWallet;
  const [user, setUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Check if viewing own profile or another user's profile
  const isOwnProfile = !address || profileAddress?.toLowerCase() === (walletAddress || authWallet)?.toLowerCase();

  useEffect(() => {
    // Only load if address changed (different user profile), not when auth context updates
    if (address) {
      loadProfile();
    } else if (authUserProfile && isOwnProfile) {
      // For own profile, use auth context but still manage loading state
      setLoading(true);
      setUser(authUserProfile);
      loadUserPosts().then(() => {
        setLoading(false);
      }).catch(err => {
        console.error('Error loading own profile posts:', err);
        setLoading(false);
      });
    } else {
      // No address and no auth profile - not authenticated yet
      setLoading(false);
    }
  }, [address, authUserProfile, isOwnProfile]);

  // Reload posts when component receives focus (user navigates back)
  useEffect(() => {
    const handleFocus = () => {
      console.log('📱 Profile page focused, reloading posts...');
      loadUserPosts();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [profileAddress]); // Only depend on profileAddress

  const loadProfile = async () => {
    if (!profileAddress) {
      console.log('⚠️ No profile address available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // If viewing own profile, use auth context (no API call)
      if (isOwnProfile && authUserProfile) {
        setUser(authUserProfile);
      } else if (!isOwnProfile) {
        // Only make API call for other users' profiles
        const profileRes = await getUserProfile(profileAddress);
        if (profileRes && profileRes.user) {
          setUser(profileRes.user);
        }
      }

      // Load user's posts
      await loadUserPosts();
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');

      // Fallback to localStorage only for own profile
      if (isOwnProfile) {
        const savedProfile = localStorage.getItem('userProfile');
        if (savedProfile) {
          setUser(JSON.parse(savedProfile));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUserPosts = async () => {
    if (!profileAddress) return;

    try {
      const postsRes = await fetchPostsByAuthor(profileAddress);
      if (postsRes && postsRes.success) {
        console.log('✅ Loaded user posts:', postsRes.posts?.length || 0);
        setUserPosts(postsRes.posts || []);
      } else {
        console.warn('⚠️ No posts found for user:', profileAddress);
        setUserPosts([]);
      }
    } catch (err) {
      console.error('Error loading user posts:', err);
      // Don't show error toast, just log it
      setUserPosts([]);
    }
  };
  
  // Callback when follow status changes
  const handleFollowChange = (isFollowing) => {
    // Update follower count
    setUser(prev => ({
      ...prev,
      followersCount: (prev?.followersCount || 0) + (isFollowing ? 1 : -1)
    }));
  };

  const handleProfileUpdated = (updatedUser) => {
    setUser(updatedUser);
    setEditModalOpen(false);
  };

  const handleSubmitUserReport = async (reportData) => {
    try {
      const submissionData = {
        type: 'USER_REPORT',
        title: `User Report: ${reportData.violationType || 'Policy Violation'} - ${user.name || user.walletAddress}`,
        description: reportData.description,
        urgency: reportData.urgency || 'NORMAL',
        caseData: {
          reportedUser: {
            userId: user.id,
            userAddress: user.walletAddress,
            username: user.name || user.username
          },
          violationType: reportData.violationType,
          suggestedAction: reportData.suggestedAction
        },
        evidence: reportData.evidence || []
      };

      const response = await fetch('/api/enhanced-governance/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit governance case');
      }

      const result = await response.json();
      
      // Show success message with case ID
      toast.success(`User report submitted! Case ID: ${result.case._id}. The community will review.`);
      
      console.log('User governance case created:', result.case);
      
    } catch (error) {
      console.error('Error submitting user governance case:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && !user) {
    return (
      <Box maxWidth={600} mx="auto" mt={4}>
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, textAlign: 'center', bgcolor: 'error.light' }}>
          <Typography color="error">{error}</Typography>
          <Button onClick={loadProfile} sx={{ mt: 2 }}>
            Retry
          </Button>
        </Paper>
      </Box>
    );
  }

  // Default fallback values
  const displayName = user?.displayName || user?.username || profileAddress?.slice(0, 6) + '...' + profileAddress?.slice(-4);
  const username = user?.username || profileAddress?.slice(0, 6) + '...' + profileAddress?.slice(-4);
  const bio = user?.bio || "No bio yet";
  const avatarUrl = user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${profileAddress}`;
  const joinDate = user?.dateJoined ? new Date(user.dateJoined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

  return (
    <Box maxWidth={700} mx="auto" mt={4} px={2}>
      {/* Back button for viewing other profiles */}
      {!isOwnProfile && (
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2, textTransform: 'none', color: 'text.secondary' }}
        >
          Back
        </Button>
      )}
      
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, mb: 4, border: '1px solid', borderColor: 'grey.200' }}>
        <Box display="flex" alignItems="flex-start" gap={3} flexWrap="wrap">
          <Avatar 
            src={avatarUrl} 
            sx={{ 
              width: 100, 
              height: 100, 
              fontSize: 40, 
              fontWeight: 700,
              border: '4px solid',
              borderColor: 'primary.light',
              boxShadow: 3
            }} 
          />
          <Box flex={1} minWidth={250}>
            <Box display="flex" alignItems="center" gap={2} mb={1}>
              <Typography variant="h5" fontWeight={700}>{displayName}</Typography>
              <Chip 
                label={`@${username}`} 
                size="small" 
                sx={{ 
                  bgcolor: 'primary.light', 
                  color: 'primary.dark',
                  fontWeight: 600
                }} 
              />
            </Box>
            
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ 
                fontFamily: 'monospace', 
                display: 'block', 
                mb: 2 
              }}
            >
              {profileAddress}
            </Typography>
            
            <Typography variant="body1" mb={2}>{bio}</Typography>
            
            {/* Additional info */}
            <Box display="flex" flexDirection="column" gap={1} mb={2}>
              {user?.location && (
                <Box display="flex" alignItems="center" gap={1}>
                  <LocationOnIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {user.location}
                  </Typography>
                </Box>
              )}
              {user?.website && (
                <Box display="flex" alignItems="center" gap={1}>
                  <LanguageIcon fontSize="small" color="action" />
                  <Typography 
                    variant="body2" 
                    color="primary" 
                    component="a" 
                    href={user.website}
                    target="_blank"
                    sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {user.website}
                  </Typography>
                </Box>
              )}
              {user?.twitter && (
                <Box display="flex" alignItems="center" gap={1}>
                  <TwitterIcon fontSize="small" color="action" />
                  <Typography 
                    variant="body2" 
                    color="primary"
                    component="a"
                    href={`https://twitter.com/${user.twitter}`}
                    target="_blank"
                    sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    @{user.twitter}
                  </Typography>
                </Box>
              )}
              {joinDate && (
                <Typography variant="caption" color="text.secondary">
                  Joined {joinDate}
                </Typography>
              )}
            </Box>
            
            <Box display="flex" gap={3} mt={2}>
              <Typography variant="body2">
                <b>{userPosts.length}</b> <span style={{ color: '#666' }}>Posts</span>
              </Typography>
              <Typography variant="body2">
                <b>{user?.followersCount || 0}</b> <span style={{ color: '#666' }}>Followers</span>
              </Typography>
              <Typography variant="body2">
                <b>{user?.followingCount || 0}</b> <span style={{ color: '#666' }}>Following</span>
              </Typography>
            </Box>
          </Box>
          
          {/* Show Edit button for own profile, Follow button and Report button for others */}
          {isOwnProfile ? (
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<EditIcon />}
              onClick={() => setEditModalOpen(true)}
              sx={{ 
                borderRadius: 2, 
                textTransform: 'none', 
                fontWeight: 700,
                borderWidth: 2,
                '&:hover': {
                  borderWidth: 2
                }
              }}
            >
              Edit Profile
            </Button>
          ) : (
            <Box display="flex" gap={2}>
              <FollowButton
                targetUserAddress={profileAddress}
                currentUserAddress={walletAddress}
                onFollowChange={handleFollowChange}
                variant="contained"
                size="medium"
              />
              
              {walletAddress && (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<ReportProblemIcon />}
                  onClick={() => setReportModalOpen(true)}
                  sx={{ 
                    borderRadius: 2, 
                    textTransform: 'none', 
                    fontWeight: 700,
                    borderWidth: 2,
                    '&:hover': {
                      borderWidth: 2
                    }
                  }}
                >
                  Report User
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Paper>
      
      <Box mb={3}>
        <Typography variant="h6" fontWeight={700} mb={2}>
          Posts {userPosts.length > 0 && `(${userPosts.length})`}
        </Typography>
        {userPosts.length === 0 && (
          <Paper 
            elevation={0} 
            sx={{ 
              p: 4, 
              borderRadius: 4, 
              textAlign: 'center',
              bgcolor: 'grey.50',
              border: '1px dashed',
              borderColor: 'grey.300'
            }}
          >
            <Typography variant="body1" color="text.secondary">
              No posts yet. Start sharing your thoughts!
            </Typography>
          </Paper>
        )}
      </Box>
      
      <Box display="flex" flexDirection="column" gap={3}>
        {userPosts.map((post) => (
          <PostCard key={post._id || post.id} post={post} walletAddress={walletAddress} />
        ))}
      </Box>

      {/* Edit Profile Modal */}
      <EditProfileModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        user={user}
        onProfileUpdated={handleProfileUpdated}
      />

      {/* Community Report Modal */}
      <CommunityReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        contentType="user"
        contentId={null}
        contentData={null}
        reportedUser={{
          id: user?._id,
          walletAddress: profileAddress,
          username: user?.username || user?.name
        }}
        onSubmit={handleSubmitUserReport}
      />
    </Box>
  );
};

export default Profile;
