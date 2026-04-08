import React, { useState, useEffect } from 'react';
import { Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box } from '@mui/material';
import PersonAddOutlined from '@mui/icons-material/PersonAddOutlined';
import PersonRemoveOutlined from '@mui/icons-material/PersonRemoveOutlined';
import { useToast } from '../hooks/useToast';
import {
  followUser,
  unfollowUser,
  checkFollowStatus
} from '../services/apiService';

/**
 * FollowButton Component
 * Shows follow/unfollow button for other users
 * Automatically checks follow status and updates UI
 * 
 * @param {string} targetUserAddress - Address of user to follow/unfollow
 * @param {string} currentUserAddress - Address of currently logged in user
 * @param {function} onFollowChange - Optional callback after follow state changes
 * @param {string} variant - Button variant: 'contained' | 'outlined' | 'text'
 * @param {string} size - Button size: 'small' | 'medium' | 'large'
 */
const FollowButton = ({ 
  targetUserAddress, 
  currentUserAddress, 
  onFollowChange,
  variant = 'contained',
  size = 'medium'
}) => {
  const toast = useToast();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [banErrorDialogOpen, setBanErrorDialogOpen] = useState(false);
  const [banErrorMessage, setBanErrorMessage] = useState("");

  // Don't show button if viewing own profile or missing addresses
  if (!targetUserAddress || !currentUserAddress || targetUserAddress === currentUserAddress) {
    return null;
  }

  // Check follow status on mount
  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      try {
        setIsCheckingStatus(true);
        const response = await checkFollowStatus(targetUserAddress, currentUserAddress);
        if (mounted && response.success) {
          setIsFollowing(response.isFollowing);
        }
      } catch (error) {
        console.error('Error checking follow status:', error);
      } finally {
        if (mounted) {
          setIsCheckingStatus(false);
        }
      }
    };

    checkStatus();

    return () => {
      mounted = false;
    };
  }, [targetUserAddress, currentUserAddress]);

  const handleFollowToggle = async () => {
    if (!currentUserAddress) {
      toast.warning('Please connect your wallet to follow users');
      return;
    }

    setIsLoading(true);

    try {
      if (isFollowing) {
        // Unfollow
        const response = await unfollowUser(targetUserAddress, currentUserAddress);
        if (response.success) {
          setIsFollowing(false);
          console.log('✅ Unfollowed user');
          
          // Call callback if provided
          if (onFollowChange) {
            onFollowChange(false);
          }
        }
      } else {
        // Follow
        const response = await followUser(targetUserAddress, currentUserAddress);
        if (response.success) {
          setIsFollowing(true);
          console.log('✅ Followed user');
          
          // Call callback if provided
          if (onFollowChange) {
            onFollowChange(true);
          }
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);

      // Check if this is a ban/suspension error (403 status)
      if (error.status === 403 || error.message?.includes('403')) {
        const errorData = error.responseData || {};

        // Check error type from backend
        if (errorData.error === 'ACCOUNT_SUSPENDED' || errorData.error === 'ACCOUNT_BANNED' ||
            errorData.error === 'Account restricted' ||
            errorData.message?.includes('restricted') || errorData.message?.includes('banned')) {
          setBanErrorMessage(errorData.userFriendlyMessage || errorData.message || 'Your account is restricted from following users');
          setBanErrorDialogOpen(true);
          return;
        }
      }

      // Regular error - show toast
      const errorMessage = error.message || 'Unknown error';
      toast.error(`Failed to ${isFollowing ? 'unfollow' : 'follow'} user: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading spinner while checking initial status
  if (isCheckingStatus) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        sx={{
          borderRadius: 'full',
          px: 3,
          textTransform: 'none',
          fontWeight: 600,
          minWidth: 120
        }}
      >
        <CircularProgress size={16} />
      </Button>
    );
  }

  return (
    <>
    <Button
      variant={isFollowing ? 'outlined' : variant}
      size={size}
      startIcon={
        isLoading ? (
          <CircularProgress size={16} />
        ) : isFollowing ? (
          <PersonRemoveOutlined />
        ) : (
          <PersonAddOutlined />
        )
      }
      onClick={handleFollowToggle}
      disabled={isLoading}
      sx={{
        borderRadius: 'full',
        px: 3,
        textTransform: 'none',
        fontWeight: 600,
        minWidth: 120,
        bgcolor: isFollowing ? 'transparent' : 'primary.main',
        color: isFollowing ? 'text.secondary' : 'white',
        borderColor: isFollowing ? 'grey.300' : 'transparent',
        '&:hover': {
          bgcolor: isFollowing ? 'grey.50' : 'primary.dark',
          borderColor: isFollowing ? 'grey.400' : 'transparent',
        },
        '&:disabled': {
          bgcolor: 'grey.100',
          color: 'grey.400'
        }
      }}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>

    {/* Ban/Suspension Error Dialog */}
    <Dialog
      open={banErrorDialogOpen}
      onClose={() => setBanErrorDialogOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold', fontSize: '1.2rem' }}>
        🚫 Action Blocked
      </DialogTitle>
      <DialogContent sx={{ py: 3 }}>
        <Typography variant="body1" sx={{ mb: 3, color: 'text.primary' }}>
          {banErrorMessage}
        </Typography>

        <Box sx={{
          bgcolor: 'error.lighter',
          p: 2.5,
          borderRadius: 1,
          border: '2px solid',
          borderColor: 'error.main',
          mb: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'error.main' }}>
            ✉️ How to Appeal:
          </Typography>
          <Box component="ol" sx={{ pl: 2, mb: 0 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Email:</strong> crib@gmail.com
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Subject:</strong> Account Ban Appeal
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Include in your email:</strong>
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              <Typography variant="body2">Your wallet address</Typography>
              <Typography variant="body2">Your username</Typography>
              <Typography variant="body2">Why you believe this decision was made in error</Typography>
              <Typography variant="body2">Any supporting evidence or context</Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{
          bgcolor: 'info.lighter',
          p: 2,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'info.main'
        }}>
          <Typography variant="body2">
            ℹ️ <strong>Appeal Deadline:</strong> 30 days from ban date
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => setBanErrorDialogOpen(false)} variant="contained">
          Okay, I Understand
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default FollowButton;
