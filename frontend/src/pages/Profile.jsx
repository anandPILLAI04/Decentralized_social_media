import React from "react";
import { Box, Avatar, Typography, Button, Grid, Paper } from "@mui/material";
import PostCard from "../components/PostCard";

const user = {
  name: "Alice",
  handle: "alice.eth",
  bio: "Web3 enthusiast. Building the future of social media.",
  avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg",
  posts: 12,
  followers: 340,
  following: 180,
};

const userPosts = [
  {
    id: 1,
    author: "Alice",
    content: "Excited to share my first NFT post! #Web3",
    likes: 23,
    comments: 5,
    isNFT: true,
    mediaUrl: "https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: 2,
    author: "Alice",
    content: "Decentralization empowers everyone. Join the movement!",
    likes: 17,
    comments: 2,
    isNFT: false
  },
];

const Profile = () => {
  return (
    <Box maxWidth={600} mx="auto" mt={4}>
      <Paper elevation={2} sx={{ p: 4, borderRadius: 4, mb: 4 }}>
        <Box display="flex" alignItems="center" gap={3}>
          <Avatar src={user.avatarUrl} sx={{ width: 80, height: 80, fontSize: 36, fontWeight: 700 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>{user.name}</Typography>
            <Typography variant="subtitle1" color="text.secondary">@{user.handle}</Typography>
            <Typography variant="body1" mt={1}>{user.bio}</Typography>
            <Box display="flex" gap={2} mt={2}>
              <Typography variant="body2"><b>{user.posts}</b> Posts</Typography>
              <Typography variant="body2"><b>{user.followers}</b> Followers</Typography>
              <Typography variant="body2"><b>{user.following}</b> Following</Typography>
            </Box>
          </Box>
          <Box flexGrow={1} />
          <Button variant="contained" color="primary" sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700 }}>Edit Profile</Button>
        </Box>
      </Paper>
      <Typography variant="h6" fontWeight={700} mb={2}>Posts</Typography>
      <Box display="flex" flexDirection="column" gap={3}>
        {userPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </Box>
    </Box>
  );
};

export default Profile;
