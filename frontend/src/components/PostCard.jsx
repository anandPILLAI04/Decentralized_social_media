import React from "react";
import { Card, CardContent, Typography, Box, IconButton, Chip, Avatar, Tooltip, Divider } from "@mui/material";
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import VerifiedIcon from '@mui/icons-material/Verified';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';

export default function PostCard({ post }) {
  return (
    <Card sx={{
      mb: 3,
      borderRadius: 4,
      boxShadow: '0 2px 16px 0 rgba(0,0,0,0.07)',
      background: '#fff',
      transition: 'box-shadow 0.2s',
      '&:hover': { boxShadow: '0 4px 32px 0 rgba(0,0,0,0.12)' }
    }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Box display="flex" alignItems="center" mb={1}>
          <Avatar sx={{ mr: 1, width: 44, height: 44, fontWeight: 700, bgcolor: '#e3e3e3', color: '#222' }}>{post.author[0]}</Avatar>
          <Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle1" fontWeight={700}>{post.author}</Typography>
              {post.isNFT && (
                <Tooltip title="NFT Content" arrow>
                  <Chip icon={<VerifiedIcon color="primary" />} label="NFT" size="small" color="primary" sx={{ height: 22, fontWeight: 700 }} />
                </Tooltip>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">@{post.author.toLowerCase()} • 2h ago</Typography>
          </Box>
        </Box>
        {post.mediaUrl && (
          <Box mb={2} mt={1}>
            <img src={post.mediaUrl} alt="Post media" style={{ width: '100%', borderRadius: 12, maxHeight: 340, objectFit: 'cover', border: '1px solid #eee' }} />
          </Box>
        )}
        <Typography variant="body1" mb={2} sx={{ fontSize: 18, lineHeight: 1.6 }}>{post.content}</Typography>
        <Divider sx={{ my: 1.5 }} />
        <Box display="flex" alignItems="center" gap={3}>
          <Box display="flex" alignItems="center" gap={0.5}>
            <IconButton size="small" color="primary" sx={{ borderRadius: 2 }}>
              <ThumbUpAltOutlinedIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2" fontWeight={600}>{post.likes}</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <IconButton size="small" color="error" sx={{ borderRadius: 2 }}>
              <FavoriteBorderIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2" fontWeight={600}>Like</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <IconButton size="small" color="default" sx={{ borderRadius: 2 }}>
              <ChatBubbleOutlineIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2" fontWeight={600}>{post.comments} Comments</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <IconButton size="small" color="default" sx={{ borderRadius: 2 }}>
              <ShareOutlinedIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2" fontWeight={600}>Share</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
