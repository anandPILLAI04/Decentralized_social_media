import React, { useState } from "react";
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
  Badge
} from "@mui/material";
import ThumbUpAltOutlined from '@mui/icons-material/ThumbUpAltOutlined';
import ThumbUpAlt from '@mui/icons-material/ThumbUpAlt';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import ShareOutlined from '@mui/icons-material/ShareOutlined';
import MoreVert from '@mui/icons-material/MoreVert';
import Verified from '@mui/icons-material/Verified';
import FavoriteBorder from '@mui/icons-material/FavoriteBorder';
import Favorite from '@mui/icons-material/Favorite';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import Flag from '@mui/icons-material/Flag';
import { formatDistanceToNow } from "date-fns";

export default function PostCard({ post, onLike, onComment, onShare }) {
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [anchorEl, setAnchorEl] = useState(null);
  const [favorited, setFavorited] = useState(false);

  const handleLike = () => {
    if (onLike) {
      onLike();
      setLiked(!liked);
    }
  };

  const handleComment = () => {
    if (commentText.trim() && onComment) {
      onComment(commentText);
      setCommentText("");
    }
  };

  const handleShare = () => {
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
    // Implement report functionality
    console.log("Report post:", post.id);
    handleMenuClose();
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

  return (
    <Card sx={{
      mb: 3,
      borderRadius: 4,
      boxShadow: '0 2px 16px 0 rgba(0,0,0,0.07)',
      background: '#fff',
      transition: 'all 0.2s ease-in-out',
      '&:hover': { 
        boxShadow: '0 8px 32px 0 rgba(0,0,0,0.12)',
        transform: 'translateY(-2px)'
      }
    }}>
      <CardContent sx={{ pb: '16px !important' }}>
        {/* Header */}
        <Box display="flex" alignItems="center" mb={2}>
          <Avatar 
            sx={{ 
              mr: 2, 
              width: 48, 
              height: 48, 
              fontWeight: 700, 
              bgcolor: 'primary.main', 
              color: 'white',
              fontSize: '1.2rem'
            }}
          >
            {getAuthorDisplay()[0]?.toUpperCase()}
          </Avatar>
          
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                {getAuthorDisplay()}
              </Typography>
              {post.isNFT && (
                <Tooltip title="NFT Content" arrow>
                  <Chip 
                    icon={<Verified color="primary" />} 
                    label="NFT" 
                    size="small" 
                    color="primary" 
                    sx={{ height: 24, fontWeight: 600, fontSize: '0.75rem' }} 
                  />
                </Tooltip>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {formatTimestamp(post.timestamp)}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={0.5}>
            <Tooltip title={favorited ? "Remove favorite" : "Add favorite"}>
              <IconButton
                onClick={handleBookmark}
                size="small"
                color={favorited ? "primary" : "default"}
              >
                <Favorite sx={{ 
                  color: favorited ? 'primary.main' : 'text.secondary',
                  opacity: favorited ? 1 : 0.6
                }} />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="More options">
              <IconButton size="small" onClick={handleMenuOpen}>
                <MoreVert />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Content */}
        {post.mediaUrl && (
          <Box mb={2} mt={1}>
            <img 
              src={post.mediaUrl} 
              alt="Post media" 
              style={{ 
                width: '100%', 
                borderRadius: 12, 
                maxHeight: 400, 
                objectFit: 'cover', 
                border: '1px solid #eee' 
              }} 
            />
          </Box>
        )}
        
        <Typography 
          variant="body1" 
          mb={2} 
          sx={{ 
            fontSize: 16, 
            lineHeight: 1.6, 
            color: 'text.primary',
            whiteSpace: 'pre-wrap'
          }}
        >
          {post.content}
        </Typography>

        {/* Stats */}
        <Box display="flex" alignItems="center" gap={3} mb={2}>
          <Typography variant="caption" color="text.secondary">
            {post.likes} likes
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {post.comments} comments
          </Typography>
          {post.isNFT && (
            <Typography variant="caption" color="primary.main" fontWeight={600}>
              NFT Minted
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Actions */}
        <Box display="flex" alignItems="center" gap={1}>
          <Button
            variant="text"
            size="small"
            startIcon={liked ? <ThumbUpAlt color="primary" /> : <ThumbUpAltOutlined />}
            onClick={handleLike}
            sx={{ 
              borderRadius: 2, 
              color: liked ? 'primary.main' : 'text.secondary',
              '&:hover': { backgroundColor: 'primary.50' }
            }}
          >
            {liked ? 'Liked' : 'Like'}
          </Button>

          <Button
            variant="text"
            size="small"
            startIcon={<ChatBubbleOutline />}
            onClick={() => setShowComments(!showComments)}
            sx={{ 
              borderRadius: 2, 
              color: 'text.secondary',
              '&:hover': { backgroundColor: 'grey.100' }
            }}
          >
            Comment
          </Button>

          <Button
            variant="text"
            size="small"
            startIcon={<ShareOutlined />}
            onClick={handleShare}
            sx={{ 
              borderRadius: 2, 
              color: 'text.secondary',
              '&:hover': { backgroundColor: 'grey.100' }
            }}
          >
            Share
          </Button>
        </Box>

        {/* Comments Section */}
        <Collapse in={showComments}>
          <Box mt={2} pt={2} borderTop="1px solid #eee">
            <Box display="flex" gap={1} mb={2}>
              <TextField
                size="small"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    fontSize: '0.875rem'
                  }
                }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={handleComment}
                disabled={!commentText.trim()}
                sx={{ borderRadius: 2, minWidth: 80 }}
              >
                Post
              </Button>
            </Box>

            {/* Sample Comments */}
            {post.comments > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  {post.comments} comments
                </Typography>
                {/* Add actual comments here */}
              </Box>
            )}
          </Box>
        </Collapse>
      </CardContent>

      {/* Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { borderRadius: 2, minWidth: 180 }
        }}
      >
        <MenuItem onClick={handleBookmark}>
          <ListItemIcon>
            <Favorite sx={{ 
              color: favorited ? 'primary.main' : 'text.secondary' 
            }} />
          </ListItemIcon>
          <ListItemText>
            {favorited ? "Remove favorite" : "Add favorite"}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleReport}>
          <ListItemIcon>
            <Flag />
          </ListItemIcon>
          <ListItemText>Report post</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
}
