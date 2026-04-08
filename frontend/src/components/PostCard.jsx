import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { getIPFSUrl, fetchFromIPFS } from "../services/ipfsService";
import { mintPostAsNFT } from "../services/contractService";
import {
  updatePostNFTStatus,
  likePost as likePostAPI,
  unlikePost as unlikePostAPI,
  checkLikeStatus,
  addComment as addCommentAPI,
  fetchComments as fetchCommentsAPI,
  deleteComment as deleteCommentAPI,
  deletePost as deletePostAPI
} from "../services/apiService";

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Chip,
  Avatar,
  Tooltip,
  Divider,
  Button,
  Collapse,
  TextField,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Alert,
  Snackbar,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";
import ThumbUpAltOutlined from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbUpAlt from '@mui/icons-material/ThumbUpAlt';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import ShareOutlined from '@mui/icons-material/ShareOutlined';
import MoreVert from '@mui/icons-material/MoreVert';
import Verified from '@mui/icons-material/Verified';
import Favorite from '@mui/icons-material/Favorite';
import Flag from '@mui/icons-material/Flag';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import OpenInNew from '@mui/icons-material/OpenInNew';
import Close from '@mui/icons-material/Close';
import ReportProblem from '@mui/icons-material/ReportProblem';
import Delete from '@mui/icons-material/Delete';
import { formatDistanceToNow } from "date-fns";
import CommunityReportModal from './CommunityReportModal';
import ModeratedMedia from './ModeratedMedia';

// Helper function to determine if a string looks like an IPFS CID
const isIPFSCID = (str) => {
  return str && /^(Qm[1-9A-Za-z]{44}|bafy[a-zA-Z0-9]{44})/.test(str);
};

export default function PostCard({ post, onLike, onComment, onShare, onNFTMinted, walletAddress }) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [favorited, setFavorited] = useState(false);
  
  // IPFS content states
  const [ipfsContent, setIpfsContent] = useState(null);
  const [ipfsImage, setIpfsImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  
  // NFT minting states
  const [isMinting, setIsMinting] = useState(false);
  const [mintSuccess, setMintSuccess] = useState(null);
  const [mintError, setMintError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [showToast, setShowToast] = useState(false);
  
  // Community report modal
  const [showReportModal, setShowReportModal] = useState(false);

  // Suspension/Ban dialog state for comments
  const [suspensionDialogOpen, setSuspensionDialogOpen] = useState(false);
  const [suspensionMessage, setSuspensionMessage] = useState("");
  const [suspensionDetails, setSuspensionDetails] = useState(null);

  // Ban error dialog state for likes
  const [likesBanErrorDialogOpen, setLikesBanErrorDialogOpen] = useState(false);
  const [likesBanErrorMessage, setLikesBanErrorMessage] = useState("");

  // Ban status for current user - start as false by default to be safe
  const [userBanStatus, setUserBanStatus] = useState({ banned: false, suspended: false, statusLoaded: false });
  const [shareBanErrorDialogOpen, setShareBanErrorDialogOpen] = useState(false);

  // User content preferences (would be fetched from user context/API)
  const [userPreferences, setUserPreferences] = useState({
    showSensitiveContent: false,
    hideSensitiveContent: false,
    autoBlurMedia: true,
    allowExplicitContent: false
  });
  
  // Fetch post content from IPFS if post.content looks like a CID
  useEffect(() => {
    let mounted = true;
    setLoadError(null);
    
    if (isIPFSCID(post.content)) {
      setIsLoading(true);
      
      fetchFromIPFS(post.content)
        .then(data => {
          if (!mounted) return;
          if (data && data.content) {
            setIpfsContent(data.content);
          } else {
            setIpfsContent(JSON.stringify(data));
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Error fetching IPFS content:", err);
          if (!mounted) return;
          setLoadError("Failed to load content from IPFS");
          setIpfsContent(null);
          setIsLoading(false);
        });
    } else {
      setIpfsContent(null);
    }
    
    return () => { mounted = false; };
  }, [post.content]);

    // Fetch image from IPFS if mediaUrl looks like a CID
  useEffect(() => {
    const imageCID = post.mediaCID || post.mediaUrl;
    if (imageCID && isIPFSCID(imageCID)) {
      const ipfsUrl = getIPFSUrl(imageCID);
      setIpfsImage(ipfsUrl);
    }
  }, [post.mediaUrl, post.mediaCID]);

  // Check if user has liked this post
  useEffect(() => {
    let mounted = true;
    
    if (walletAddress && post._id) {
      checkLikeStatus(post._id, walletAddress)
        .then(response => {
          if (mounted && response.success) {
            setLiked(response.hasLiked);
          }
        })
        .catch(err => {
          console.error("Error checking like status:", err);
        });
    }
    
    return () => { mounted = false; };
  }, [post._id, walletAddress]);

  // Check user's ban status from auth context
  const { userProfile } = useAuth();

  useEffect(() => {
    // Get ban status from auth context (no API call needed!)
    const banStatus = {
      banned: userProfile?.moderation?.banned || false,
      suspended: userProfile?.moderation?.suspended || false,
      suspensionEnd: userProfile?.moderation?.suspensionEnd,
      statusLoaded: true
    };
    setUserBanStatus(banStatus);
  }, [userProfile?.moderation]);

  const handleLike = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet to like posts");
      return;
    }
    
    try {
      if (liked) {
        // Unlike
        const response = await unlikePostAPI(post._id, walletAddress);
        if (response.success) {
          setLiked(false);
          setLikesCount(response.likesCount);
          console.log("👎 Post unliked");
        }
      } else {
        // Like
        const response = await likePostAPI(post._id, walletAddress);
        if (response.success) {
          setLiked(true);
          setLikesCount(response.likesCount);
          console.log("👍 Post liked");
        }
      }
    } catch (error) {
      console.error("Error toggling like:", error);

      // Check if this is a ban/suspension error (403 status)
      if (error.status === 403 || error.message?.includes('403')) {
        const errorData = error.responseData || {};

        // Check error type from backend
        if (errorData.error === 'ACCOUNT_SUSPENDED' || errorData.error === 'ACCOUNT_BANNED' ||
            errorData.error === 'Account restricted' ||
            errorData.message?.includes('restricted') || errorData.message?.includes('banned')) {
          setLikesBanErrorMessage(errorData.userFriendlyMessage || errorData.message || 'Your account is restricted from liking posts');
          setLikesBanErrorDialogOpen(true);
          return;
        }
      }

      // Regular error - show alert
      if (!error.message?.includes("already")) {
        alert(`Failed to ${liked ? 'unlike' : 'like'} post: ${error.message}`);
      }
    }
  };

  // Load comments when comment section is opened
  useEffect(() => {
    if (showComments) {
      // Always reload comments when opening to ensure fresh data
      loadComments();
    }
  }, [showComments]);

  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const response = await fetchCommentsAPI(post._id);
      if (response.success) {
        setComments(response.comments || []);
        // Update comment count from server response
        if (response.commentCount !== undefined) {
          setCommentCount(response.commentCount);
        }
      }
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleComment = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet to comment");
      return;
    }

    if (!commentText.trim()) {
      return;
    }

    try {
      const response = await addCommentAPI(post._id, {
        content: commentText.trim(),
        authorAddress: walletAddress,
        authorName: "" // Will be fetched from backend
      });

      if (response.success) {
        setComments([response.comment, ...comments]);
        setCommentCount(response.commentCount);
        setCommentText("");
        console.log("💬 Comment added");
      }
    } catch (error) {
      console.error("Error adding comment:", error);

      // Check for suspension/ban error (403)
      if (error.message.includes('403') && error.responseData?.error === 'ACCOUNT_SUSPENDED') {
        // Show suspension dialog
        setSuspensionDetails(error.responseData.restriction);
        setSuspensionMessage(error.responseData.userFriendlyMessage || "Your account is temporarily suspended");
        setSuspensionDialogOpen(true);
      } else if (error.message.includes('403') && error.responseData?.error === 'ACCOUNT_BANNED') {
        // Show ban dialog
        setSuspensionDialogOpen(true);
        setSuspensionMessage(error.responseData.userFriendlyMessage || "Your account has been banned");
        setSuspensionDetails(null);
      } else if (error.message.includes('403') && error.responseData) {
        // User is banned/restricted (old format)
        const data = error.responseData;
        const restriction = data.restriction;

        let alertMessage = data.message || 'Your account has been restricted.';

        if (restriction?.actionSteps) {
          alertMessage += '\n\nWhat you can do:\n' + restriction.actionSteps.map((step, i) => `${i + 1}. ${step}`).join('\n');
        }

        if (restriction?.appeal?.canAppeal) {
          alertMessage += '\n\n📧 You can appeal this decision. Contact: ' + (data.supportContact?.email || 'support@cribsocial.com');
        }

        alert(alertMessage);
      } else if (error.responseData && error.responseData.userGuidance) {
        // Content was flagged
        const guidance = error.responseData.userGuidance;
        const violation = error.responseData.violation;

        let alertMessage = error.responseData.message || 'Your comment was blocked for violating community guidelines.';

        if (guidance.actionSteps) {
          alertMessage += '\n\nNext steps:\n' + guidance.actionSteps.map((step, i) => `${i + 1}. ${step}`).join('\n');
        }

        if (violation && violation.canAppeal) {
          alertMessage += '\n\n📧 Appeal: ' + guidance.appeal?.instructions || 'You can appeal this decision.';
        }

        alert(alertMessage);
      } else {
        // Generic error fallback
        alert("Failed to add comment: " + error.message);
      }
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!walletAddress) return;

    try {
      const response = await deleteCommentAPI(commentId, walletAddress);
      if (response.success) {
        setComments(comments.filter(c => c._id !== commentId));
        setCommentCount(Math.max(commentCount - 1, 0));
        console.log("🗑️ Comment deleted");
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      alert("Failed to delete comment: " + error.message);
    }
  };

  const handleShare = () => {
    console.log('📤 Share clicked - Wallet:', walletAddress);
    console.log('📤 Ban status full object:', JSON.stringify(userBanStatus, null, 2));
    console.log('   banned:', userBanStatus?.banned);
    console.log('   suspended:', userBanStatus?.suspended);
    console.log('   statusLoaded:', userBanStatus?.statusLoaded);

    if (!walletAddress) {
      console.log('❌ No wallet address - cannot share');
      return;
    }

    // Check if user is banned or suspended
    if (userBanStatus?.banned === true) {
      console.log('🚫 User is BANNED - blocking share');
      setShareBanErrorDialogOpen(true);
      return;
    }

    if (userBanStatus?.suspended === true) {
      console.log('⏸️ User is SUSPENDED - blocking share');
      setShareBanErrorDialogOpen(true);
      return;
    }

    console.log('✅ Share allowed - opening share dialog');
    if (navigator.share) {
      navigator.share({
        title: `Post by ${post.authorName || post.author}`,
        text: post.content,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(post.content);
      // Show toast notification
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleBookmark = () => {
    setFavorited(!favorited);
    handleMenuClose();
  };

  const handleReport = () => {
    setShowReportModal(true);
    handleMenuClose();
  };

  const handleDelete = async () => {
    try {
      // Confirm deletion
      if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        handleMenuClose();
        return;
      }

      console.log('🗑️ Deleting post:', post._id, 'by user:', walletAddress);

      // Call delete API
      await deletePostAPI(post._id, walletAddress);

      console.log('✅ Post deleted successfully');

      // Show success message
      setDeleteSuccess(true);
      setShowToast(true);

      // Optional: Remove post from UI immediately or refresh the page
      // You could also emit an event to parent component to refresh posts
      setTimeout(() => {
        window.location.reload(); // Simple approach to refresh the feed
      }, 2000);

    } catch (error) {
      console.error('❌ Error deleting post:', error);
      console.error('   Error message:', error.message);
      console.error('   Error response:', error.responseData);
      alert(`Failed to delete post: ${error.message || error.responseData?.error || 'Unknown error'}`);
    }
    handleMenuClose();
  };

  const handleSubmitReport = async (reportData) => {
    try {
      if (!walletAddress) {
        console.error('❌ Wallet address is missing!');
        throw new Error('Wallet address not found. Please connect your wallet.');
      }

      console.log('✅ Wallet address found:', walletAddress.slice(0, 10) + '...');

      // reportData already contains the full case structure from CommunityReportModal
      const submissionData = {
        type: reportData.type,
        title: reportData.title,
        description: reportData.description,
        urgency: reportData.urgency,
        caseData: {
          ...reportData.caseData,
          // Ensure we have the post details
          originalContent: {
            postId: post._id,
            contentText: post.content,
            contentMedia: post.images || [],
            ...reportData.caseData?.originalContent
          }
        },
        evidence: reportData.evidence || []
      };

      console.log('📤 Submitting report to:', `${API_BASE_URL}/enhanced-governance/cases`);
      console.log('📦 Submission data:', submissionData);
      console.log('🔐 Headers:', {
        'Content-Type': 'application/json',
        'x-wallet-address': walletAddress.toLowerCase().slice(0, 10) + '...'
      });

      const response = await fetch(`${API_BASE_URL}/enhanced-governance/cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress.toLowerCase()
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Governance case submission failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          submissionData
        });
        console.error('Full error response:', errorData);
        throw new Error(errorData.message || `Failed to submit governance case (${response.status})`);
      }

      const result = await response.json();
      
      // Show success message with case ID
      alert(`Report submitted successfully! Case ID: ${result.case._id}\n\nThe community will review your case and vote on the appropriate action. You can track the progress in the governance dashboard.`);
      
      console.log('Governance case created:', result.case);
      
    } catch (error) {
      console.error('Error submitting governance case:', error);
      throw error; // Re-throw to let modal handle the error
    }
  };

  const handleMintNFT = async () => {
    setIsMinting(true);
    setMintError(null);
    setMintSuccess(null);
    
    try {
      // Create OpenSea-compatible metadata for the NFT
      const metadata = JSON.stringify({
        name: `Crib Post #${post._id}`,
        description: post.content?.substring(0, 200) || "A post from Crib decentralized social media",
        image: post.mediaCID ? getIPFSUrl(post.mediaCID) : (post.mediaUrl ? getIPFSUrl(post.mediaUrl) : ""),
        external_url: `https://crib.app/post/${post._id}`,
        attributes: [
          { trait_type: "Author", value: post.authorName || "Anonymous" },
          { trait_type: "Platform", value: "Crib" },
          { 
            trait_type: "Created", 
            value: new Date(post.timestamp).toISOString(),
            display_type: "date"
          },
          { 
            trait_type: "Has Media", 
            value: (post.mediaCID || post.mediaUrl) ? "Yes" : "No" 
          }
        ],
        properties: {
          contentCID: post.contentCID,
          authorId: post.authorId,
          chainId: 80002
        }
      });
      console.log("🎨 Minting NFT for post:", post._id);
      const result = await mintPostAsNFT(post._id, metadata);
      console.log("✅ Minting result:", result);

      // Update backend with NFT information
      try {
        console.log("📤 Sending to backend:", {
          postId: post._id,
          nftTokenId: result.tokenId,
          transactionHash: result.transactionHash
        });

        const response = await updatePostNFTStatus(post._id, {
          nftTokenId: result.tokenId,
          transactionHash: result.transactionHash
        });

        console.log("📥 Backend response:", response);

        if (response.success) {
          console.log("✅ Backend updated with NFT info");
        } else {
          console.error("❌ Backend returned error:", response);
        }
      } catch (backendError) {
        console.error("❌ Failed to update backend with NFT info:", backendError);
      }

      setMintSuccess(result);
      setShowToast(true);

      // Notify parent component
      if (onNFTMinted) {
        onNFTMinted(post._id, result);
      }
    } catch (error) {
      console.error("❌ Error minting NFT:", error);
      setMintError(error.message);
      setShowToast(true);
    } finally {
      setIsMinting(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Just now";
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return "Just now";
    }
  };

  const getAuthorDisplay = () => {
    if (post.authorName) {
      return post.authorName;
    }
    if (post.author && post.author.length > 10) {
      return `${post.author.slice(0, 6)}...${post.author.slice(-4)}`;
    }
    return post.author || "Anonymous";
  };

  const getAuthorAvatar = () => {
    if (post.authorAvatar) {
      return post.authorAvatar;
    }
    // Fallback to generated avatar
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${post.author || 'anon'}`;  
  };

  return (
    <Card 
      id={`post-${post._id || post.id}`}
      sx={{
        mb: 3,
        borderRadius: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        background: '#fff',
        transition: 'all 0.2s ease-in-out',
        border: '1px solid',
        borderColor: 'grey.100',
        overflow: 'visible',
        '&:hover': { 
          boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
          transform: 'translateY(-4px)'
        }
      }}>
      <CardContent sx={{ pb: '16px !important', px: { xs: 2, sm: 3 }, pt: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" mb={2.5}>
          <Avatar 
            src={getAuthorAvatar()}
            onClick={() => post.author && navigate(`/profile/${post.author}`)}
            sx={{ 
              mr: 2, 
              width: 48, 
              height: 48,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '2px solid',
              borderColor: post.isNFT ? 'tertiary.main' : 'white',
              cursor: post.author ? 'pointer' : 'default',
              '&:hover': post.author ? {
                transform: 'scale(1.05)',
                transition: 'transform 0.2s'
              } : {}
            }}
          >
            {getAuthorDisplay()[0]?.toUpperCase()}
          </Avatar>
          
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Typography 
                variant="subtitle1" 
                fontWeight={700} 
                color="text.primary"
                onClick={() => post.author && navigate(`/profile/${post.author}`)}
                sx={{
                  cursor: post.author ? 'pointer' : 'default',
                  '&:hover': post.author ? {
                    color: 'primary.main',
                    textDecoration: 'underline'
                  } : {}
                }}
              >
                {getAuthorDisplay()}
              </Typography>
              {post.isNFT && (
                <Tooltip title="NFT Content" arrow>
                  <Chip 
                    icon={<Verified fontSize="small" sx={{ color: '#A78BFA' }} />} 
                    label="NFT" 
                    size="small" 
                    variant="outlined"
                    sx={{ 
                      height: 22, 
                      fontWeight: 600, 
                      fontSize: '0.7rem',
                      color: 'tertiary.main',
                      borderColor: 'tertiary.light',
                      bgcolor: 'rgba(139, 92, 246, 0.08)'
                    }} 
                  />
                </Tooltip>
              )}
              {post.contentCID && (
                <Tooltip title="Decentralized storage on IPFS" arrow>
                  <Chip 
                    label="IPFS" 
                    size="small" 
                    variant="outlined"
                    sx={{ 
                      height: 22, 
                      fontWeight: 600, 
                      fontSize: '0.7rem',
                      color: '#10B981',
                      borderColor: '#D1FAE5',
                      bgcolor: 'rgba(16, 185, 129, 0.08)'
                    }} 
                  />
                </Tooltip>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              {formatTimestamp(post.timestamp)}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={0.5}>
            <Tooltip title={favorited ? "Remove favorite" : "Add favorite"}>
              <IconButton
                onClick={handleBookmark}
                size="small"
                color={favorited ? "error" : "default"}
                sx={{ 
                  bgcolor: favorited ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                  '&:hover': {
                    bgcolor: favorited ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                <Favorite 
                  fontSize="small"
                  sx={{ 
                    color: favorited ? '#EF4444' : 'text.secondary',
                    opacity: favorited ? 1 : 0.6
                  }} 
                />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="More options">
              <IconButton 
                size="small" 
                onClick={handleMenuOpen}
                sx={{ 
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                <MoreVert fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Content text first if it exists */}
        {!isLoading && !loadError && (ipfsContent !== null || post.content) && (
          <Typography 
            variant="body1" 
            mb={2.5} 
            sx={{ 
              fontSize: '1rem', 
              lineHeight: 1.7, 
              color: 'text.primary',
              whiteSpace: 'pre-wrap',
              fontWeight: 400
            }}
          >
            {ipfsContent !== null ? ipfsContent : post.content}
          </Typography>
        )}
        
        {/* Media content */}
        {ipfsImage && (
          <Box mb={3} sx={{ position: 'relative' }}>
            <Box
              sx={{
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                position: 'relative',
                '&::before': post.isNFT ? {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: '16px',
                  border: '2px solid',
                  borderColor: 'tertiary.main',
                  zIndex: 2,
                  pointerEvents: 'none'
                } : {}
              }}
            >
              <ModeratedMedia
                src={ipfsImage}
                type="image"
                alt="Post media"
                style={{ 
                  width: '100%', 
                  display: 'block',
                  maxHeight: 500, 
                  objectFit: 'cover',
                  borderRadius: '16px'
                }}
                userPreferences={userPreferences}
                onModerationResult={(result) => {
                  console.log('Post media moderation result:', result);
                  if (result && !result.safe) {
                    // Could store moderation result in state for analytics
                  }
                }}
              />
            </Box>
            
            {post.isNFT && (
              <Chip
                label="NFT" 
                size="small"
                icon={<Verified fontSize="small" />}
                sx={{ 
                  position: 'absolute', 
                  top: 12, 
                  right: 12,
                  fontWeight: 600,
                  bgcolor: 'tertiary.main',
                  color: 'white',
                  boxShadow: 2
                }}
              />
            )}
          </Box>
        )}
        
        {/* Show loading indicator while fetching IPFS content */}
        {isLoading && (
          <Box 
            display="flex" 
            alignItems="center" 
            justifyContent="center" 
            py={3}
            sx={{
              bgcolor: 'grey.50',
              borderRadius: 2,
              mb: 2
            }}
          >
            <CircularProgress size={20} sx={{ mr: 1.5, color: 'primary.light' }} />
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Loading from decentralized storage...
            </Typography>
          </Box>
        )}
        
        {loadError && (
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 2,
              borderRadius: 2,
              '& .MuiAlert-icon': {
                color: 'warning.main'
              }
            }}
          >
            {loadError} - Content hash: {post.content?.substring(0, 16)}...
          </Alert>
        )}

        {/* NFT Badge - only show if post is an NFT */}
        {post.isNFT && (
          <Box display="flex" justifyContent="flex-end" mb={1.5}>
            <Box 
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.5,
                borderRadius: 'full',
                bgcolor: 'rgba(139, 92, 246, 0.08)',
              }}
            >
              <Verified fontSize="small" sx={{ color: 'tertiary.main' }} />
              <Typography variant="caption" sx={{ color: 'tertiary.dark', fontWeight: 600 }}>
                NFT Minted
              </Typography>
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Actions */}
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <Button
            variant={liked ? "contained" : "text"}
            size="small"
            startIcon={liked ? <ThumbUpAlt /> : <ThumbUpAltOutlined />}
            onClick={handleLike}
            sx={{ 
              borderRadius: 'full',
              px: 2, 
              color: liked ? 'white' : 'text.secondary',
              bgcolor: liked ? 'primary.main' : 'transparent',
              '&:hover': { 
                backgroundColor: liked ? 'primary.dark' : 'rgba(255, 107, 107, 0.08)'
              }
            }}
          >
            {liked ? 'Liked' : 'Like'} {likesCount > 0 && `(${likesCount})`}
          </Button>

          <Button
            variant={showComments ? "contained" : "text"}
            size="small"
            startIcon={<ChatBubbleOutline />}
            onClick={() => setShowComments(!showComments)}
            sx={{ 
              borderRadius: 'full',
              px: 2, 
              color: showComments ? 'white' : 'text.secondary',
              bgcolor: showComments ? 'primary.main' : 'transparent',
              '&:hover': { 
                backgroundColor: showComments ? 'primary.dark' : 'rgba(255, 107, 107, 0.08)'
              }
            }}
          >
            Comment {commentCount > 0 && `(${commentCount})`}
          </Button>

          <Button
            variant="text"
            size="small"
            startIcon={<ShareOutlined />}
            onClick={handleShare}
            disabled={userBanStatus?.banned || userBanStatus?.suspended || !walletAddress}
            sx={{
              borderRadius: 'full',
              px: 2,
              color: 'text.secondary',
              '&:hover': { backgroundColor: 'rgba(255, 107, 107, 0.08)' },
              '&:disabled': { color: 'text.disabled', opacity: 0.5 }
            }}
          >
            Share
          </Button>

          {/* Community Report Button - only show for other people's posts */}
          {walletAddress && walletAddress.toLowerCase() !== post.author?.toLowerCase() && (
            <Button
              variant="text"
              size="small"
              startIcon={<ReportProblem />}
              onClick={handleReport}
              sx={{ 
                borderRadius: 'full',
                px: 2, 
                color: 'text.secondary',
                '&:hover': { backgroundColor: 'rgba(255, 152, 0, 0.08)' }
              }}
            >
              Report
            </Button>
          )}

          {/* Mint as NFT Button - only show if not already an NFT AND user is the post owner */}
          {!post.isNFT && !post.nftTokenId && walletAddress && walletAddress.toLowerCase() === post.author?.toLowerCase() && (
            <Button
              variant="outlined"
              size="small"
              startIcon={isMinting ? <CircularProgress size={16} /> : <AutoAwesome />}
              onClick={handleMintNFT}
              disabled={isMinting}
              sx={{ 
                borderRadius: 'full',
                px: 2,
                ml: 'auto', // Push to right on larger screens
                color: 'tertiary.main',
                borderColor: 'tertiary.light',
                bgcolor: 'rgba(139, 92, 246, 0.04)',
                fontWeight: 600,
                '&:hover': { 
                  borderColor: 'tertiary.main',
                  bgcolor: 'rgba(139, 92, 246, 0.12)'
                },
                '&:disabled': {
                  borderColor: 'grey.300',
                  color: 'grey.500'
                }
              }}
            >
              {isMinting ? 'Minting...' : 'Mint as NFT'}
            </Button>
          )}

          {/* View NFT Button - show if already minted */}
          {(post.isNFT || post.nftTokenId) && mintSuccess && (
            <Button
              variant="contained"
              size="small"
              startIcon={<Verified />}
              endIcon={<OpenInNew fontSize="small" />}
              component="a"
              href={`https://amoy.polygonscan.com/tx/${mintSuccess.transactionHash}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ 
                borderRadius: 'full',
                px: 2,
                ml: 'auto',
                bgcolor: 'tertiary.main',
                color: 'white',
                fontWeight: 600,
                boxShadow: 2,
                '&:hover': { 
                  bgcolor: 'tertiary.dark',
                  boxShadow: 3
                }
              }}
            >
              View NFT
            </Button>
          )}
        </Box>

        {/* Comments Section */}
        <Collapse in={showComments}>
          <Box mt={3} pt={2} borderTop="1px solid" borderColor="grey.100">
            <Box display="flex" gap={1.5} mb={3}>
              <Avatar 
                sx={{ 
                  width: 36, 
                  height: 36, 
                  bgcolor: 'grey.100' 
                }}
              >
                Y
              </Avatar>
              
              <Box flexGrow={1}>
                <TextField
                  size="small"
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  fullWidth
                  multiline
                  maxRows={4}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      fontSize: '0.875rem',
                      bgcolor: 'grey.50',
                    }
                  }}
                />
                
                <Box display="flex" justifyContent="flex-end" mt={1}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleComment}
                    disabled={!commentText.trim()}
                    sx={{ 
                      borderRadius: 'full', 
                      minWidth: 80,
                      px: 2,
                      fontWeight: 600,
                      boxShadow: 1
                    }}
                  >
                    Comment
                  </Button>
                </Box>
              </Box>
            </Box>

            {/* Comments List */}
            {commentsLoading ? (
              <Box display="flex" justifyContent="center" py={3}>
                <CircularProgress size={24} />
              </Box>
            ) : comments.length > 0 ? (
              <Box>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    mb: 2, 
                    display: 'block',
                    color: 'text.primary',
                    fontWeight: 600
                  }}
                >
                  {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
                </Typography>
                
                {comments.map((comment) => (
                  <Box 
                    key={comment._id}
                    display="flex" 
                    gap={1.5} 
                    mb={2}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: 'grey.50',
                      '&:hover': { bgcolor: 'grey.100' },
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <Avatar 
                      src={comment.authorAvatar}
                      sx={{ 
                        width: 32, 
                        height: 32,
                        bgcolor: 'primary.light'
                      }}
                    >
                      {comment.authorName?.[0]?.toUpperCase() || 'U'}
                    </Avatar>
                    
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography 
                          variant="subtitle2" 
                          sx={{ fontWeight: 600, color: 'text.primary' }}
                        >
                          {comment.authorName || `${comment.authorId.slice(0, 6)}...${comment.authorId.slice(-4)}`}
                        </Typography>
                        
                        <Box>
                          {walletAddress === comment.authorId ? (
                            <IconButton 
                              size="small"
                              onClick={() => handleDeleteComment(comment._id)}
                              sx={{ ml: 1, color: 'error.main' }}
                            >
                              <Close fontSize="small" />
                            </IconButton>
                          ) : walletAddress && walletAddress !== comment.authorId ? (
                            <IconButton 
                              size="small"
                              onClick={() => {
                                // TODO: Open comment report modal
                                console.log('Report comment:', comment._id);
                              }}
                              sx={{ ml: 1, color: 'warning.main' }}
                              title="Report comment to community"
                            >
                              <ReportProblem fontSize="small" />
                            </IconButton>
                          ) : null}
                        </Box>
                      </Box>
                      
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        display="block"
                        sx={{ mb: 0.5 }}
                      >
                        {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}
                      </Typography>
                      
                      <Typography 
                        variant="body2" 
                        color="text.primary"
                        sx={{ mt: 0.5, wordBreak: 'break-word' }}
                      >
                        {comment.content}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : commentCount === 0 ? (
              <Box
                sx={{
                  p: 3,
                  borderRadius: 2,
                  bgcolor: 'grey.50',
                  textAlign: 'center'
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  No comments yet. Be the first to comment!
                </Typography>
              </Box>
            ) : null}
          </Box>
        </Collapse>
      </CardContent>

      {/* Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 3,
          sx: { 
            borderRadius: 3, 
            minWidth: 200,
            overflow: 'hidden',
            mt: 1.5
          }
        }}
      >
        <MenuItem onClick={handleBookmark}>
          <ListItemIcon>
            <Favorite fontSize="small" sx={{ 
              color: favorited ? '#EF4444' : 'text.secondary' 
            }} />
          </ListItemIcon>
          <ListItemText 
            primary={favorited ? "Remove from favorites" : "Add to favorites"}
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: 500
            }}
          />
        </MenuItem>
        
        {/* Delete option - only show if user owns the post */}
        {walletAddress && post.authorId === walletAddress && (
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <Delete fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText 
              primary="Delete post" 
              primaryTypographyProps={{
                variant: 'body2',
                fontWeight: 500,
                color: 'error.main'
              }}
            />
          </MenuItem>
        )}
        
        <MenuItem onClick={handleReport}>
          <ListItemIcon>
            <Flag fontSize="small" sx={{ color: 'warning.main' }} />
          </ListItemIcon>
          <ListItemText 
            primary="Report post" 
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: 500
            }}
          />
        </MenuItem>
        
        {(post.isNFT || mintSuccess) && (
          <MenuItem
            onClick={() => {
              const txHash = mintSuccess?.transactionHash || post.transactionHash || post.nftTransactionHash;
              console.log('📋 Post object:', { isNFT: post.isNFT, transactionHash: post.transactionHash, nftTransactionHash: post.nftTransactionHash });
              console.log('📋 MintSuccess:', mintSuccess);
              console.log('🔗 Selected tx:', txHash);

              if (txHash) {
                console.log('🔗 Opening Polygonscan tx:', txHash);
                window.open(`https://amoy.polygonscan.com/tx/${txHash}`, '_blank');
              } else {
                console.warn('❌ No transaction hash available', { post, mintSuccess });
              }
            }}
          >
            <ListItemIcon>
              <Verified fontSize="small" sx={{ color: 'tertiary.main' }} />
            </ListItemIcon>
            <ListItemText
              primary="View NFT on Polygonscan"
              primaryTypographyProps={{
                variant: 'body2',
                fontWeight: 500
              }}
            />
          </MenuItem>
        )}
      </Menu>

      {/* Toast Notifications */}
      <Snackbar
        open={showToast}
        autoHideDuration={6000}
        onClose={() => setShowToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setShowToast(false)} 
          severity={mintError ? "error" : "success"}
          sx={{ 
            width: '100%',
            borderRadius: 2,
            boxShadow: 3
          }}
          action={
            mintSuccess && (
              <Button
                component="a"
                href={`https://amoy.polygonscan.com/tx/${mintSuccess.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                sx={{ color: 'inherit', fontWeight: 600 }}
              >
                View TX
              </Button>
            )
          }
        >
          {deleteSuccess ? (
            <Box>
              <Typography variant="body2" fontWeight={600} mb={0.5}>
                🗑️ Post Deleted Successfully!
              </Typography>
              <Typography variant="caption">
                Your post has been removed from the platform
              </Typography>
            </Box>
          ) : mintError ? (
            <Box>
              <Typography variant="body2" fontWeight={600} mb={0.5}>
                NFT Minting Failed
              </Typography>
              <Typography variant="caption">
                {mintError}
              </Typography>
            </Box>
          ) : mintSuccess ? (
            <Box>
              <Typography variant="body2" fontWeight={600} mb={0.5}>
                🎉 NFT Minted Successfully!
              </Typography>
              <Typography variant="caption" display="block" mb={0.5}>
                Token ID: {mintSuccess.tokenId || 'N/A'}
              </Typography>
              <Link
                href={`https://amoy.polygonscan.com/tx/${mintSuccess.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ 
                  color: 'inherit', 
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                View on Polygonscan <OpenInNew sx={{ fontSize: '0.75rem' }} />
              </Link>
            </Box>
          ) : null}
        </Alert>
      </Snackbar>

      {/* Community Report Modal */}
      <CommunityReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        contentType="post"
        contentId={post._id}
        contentData={{
          content: ipfsContent || post.content,
          images: post.mediaCID ? [getIPFSUrl(post.mediaCID)] : []
        }}
        reportedUser={{
          id: post.authorId,
          walletAddress: post.author,
          username: post.authorName
        }}
        onSubmit={handleSubmitReport}
      />

      {/* Suspension/Ban Dialog for Comments */}
      <Dialog
        open={suspensionDialogOpen}
        onClose={() => setSuspensionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold', fontSize: '1.3rem', pb: 1 }}>
          {suspensionDetails?.level === 'permanent_ban' || suspensionDetails?.level === 'temp_ban' ? '⏸️ Account Suspended' : '🚫 Cannot Comment'}
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          <Typography variant="body1" sx={{ mb: 3, color: 'text.primary' }}>
            {suspensionMessage}
          </Typography>

          {suspensionDetails?.hoursRemaining && (
            <Box sx={{
              bgcolor: 'warning.lighter',
              p: 2,
              borderRadius: 1,
              border: '2px solid',
              borderColor: 'warning.main',
              mb: 2
            }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>⏱️ Suspension Duration:</strong>
              </Typography>
              <Typography variant="body2">
                Your account will be available again in approximately <strong>{suspensionDetails.hoursRemaining} hours</strong>
              </Typography>
            </Box>
          )}

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
                <strong>Subject:</strong> Account Suspension Appeal
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Include in your email:</strong>
              </Typography>
              <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                <Typography variant="body2">Your wallet address</Typography>
                <Typography variant="body2">Your username</Typography>
                <Typography variant="body2">Why you believe this suspension was made in error</Typography>
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
              ℹ️ <strong>Appeal Deadline:</strong> 14 days from suspension date
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSuspensionDialogOpen(false)} variant="contained">
            Okay, I Understand
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ban/Suspension Error Dialog for Likes */}
      <Dialog
        open={likesBanErrorDialogOpen}
        onClose={() => setLikesBanErrorDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold', fontSize: '1.2rem' }}>
          🚫 Action Blocked
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          <Typography variant="body1" sx={{ mb: 3, color: 'text.primary' }}>
            {likesBanErrorMessage}
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
          <Button onClick={() => setLikesBanErrorDialogOpen(false)} variant="contained">
            Okay, I Understand
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ban/Suspension Error Dialog for Share */}
      <Dialog
        open={shareBanErrorDialogOpen}
        onClose={() => setShareBanErrorDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold', fontSize: '1.2rem' }}>
          🚫 Action Blocked
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          <Typography variant="body1" sx={{ mb: 3, color: 'text.primary' }}>
            {userBanStatus?.banned
              ? 'Your account has been permanently banned from the platform. You cannot share posts.'
              : 'Your account is temporarily suspended. You cannot share posts during this period.'}
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
                <strong>Subject:</strong> Account {userBanStatus?.banned ? 'Ban' : 'Suspension'} Appeal
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
              ℹ️ <strong>Appeal Deadline:</strong> {userBanStatus?.banned ? '30 days' : '14 days'} from {userBanStatus?.banned ? 'ban date' : 'suspension date'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShareBanErrorDialogOpen(false)} variant="contained">
            Okay, I Understand
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
