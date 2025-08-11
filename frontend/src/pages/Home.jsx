import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Chip,
  Container,
  Grid,
  Card,
  CardContent,
  Avatar,
  Divider,
  Skeleton,
  Alert,
  Fab,
  Tooltip
} from "@mui/material";
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  TrendingUp as TrendingIcon,
  NewReleases as NewIcon,
  Whatshot as HotIcon
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import PostCard from "../components/PostCard";

const Home = ({ posts, onLike, onRefresh, loading }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    // Implement search functionality
    console.log("Searching for:", searchQuery);
  };

  const handleCreatePost = () => {
    navigate("/create");
  };

  const filteredPosts = posts.filter(post => {
    if (filter === "nft") return post.isNFT;
    if (filter === "trending") return post.likes > 10;
    if (filter === "recent") return true; // Show all for now
    return true;
  });

  const getFilterIcon = (filterType) => {
    switch (filterType) {
      case "trending": return <TrendingIcon />;
      case "nft": return <HotIcon />;
      case "recent": return <NewIcon />;
      default: return null;
    }
  };

  const getFilterLabel = (filterType) => {
    switch (filterType) {
      case "trending": return "Trending";
      case "nft": return "NFT Posts";
      case "recent": return "Recent";
      default: return "All";
    }
  };

  if (loading && posts.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box mb={4}>
          <Skeleton variant="text" width="60%" height={60} />
          <Skeleton variant="text" width="40%" height={40} />
        </Box>
        {[1, 2, 3].map((i) => (
          <Card key={i} sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Skeleton variant="circular" width={44} height={44} />
                <Box ml={2} flex={1}>
                  <Skeleton variant="text" width="30%" height={24} />
                  <Skeleton variant="text" width="20%" height={20} />
                </Box>
              </Box>
              <Skeleton variant="text" width="100%" height={20} />
              <Skeleton variant="text" width="80%" height={20} />
              <Skeleton variant="text" width="60%" height={20} />
            </CardContent>
          </Card>
        ))}
      </Container>
    );
  }

  // Show content even if loading but posts exist
  if (posts.length > 0) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Header Section */}
        <Box mb={4}>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
            Welcome to Decentralized Social Media
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
            Share your thoughts, mint NFTs, and participate in community governance
          </Typography>
          
          {/* Search and Filters */}
          <Box component="form" onSubmit={handleSearch} sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  placeholder="Search posts, users, or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton type="submit" color="primary">
                          <SearchIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 3,
                      backgroundColor: "background.paper",
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {["all", "trending", "nft", "recent"].map((filterType) => (
                    <Chip
                      key={filterType}
                      label={getFilterLabel(filterType)}
                      icon={getFilterIcon(filterType)}
                      onClick={() => setFilter(filterType)}
                      color={filter === filterType ? "primary" : "default"}
                      variant={filter === filterType ? "filled" : "outlined"}
                      sx={{ borderRadius: 2 }}
                    />
                  ))}
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Stats and Actions */}
          <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box display="flex" gap={2}>
              <Chip
                label={`${posts.length} Posts`}
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`${posts.filter(p => p.isNFT).length} NFTs`}
                color="secondary"
                variant="outlined"
              />
              <Chip
                label={`${posts.reduce((sum, p) => sum + p.likes, 0)} Total Likes`}
                color="success"
                variant="outlined"
              />
            </Box>
            
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={onRefresh}
                disabled={loading}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreatePost}
                sx={{ borderRadius: 3 }}
              >
                Create Post
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Posts Section */}
        <Box>
          {filteredPosts.length === 0 ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              No posts match your current filter. Try adjusting your search criteria.
            </Alert>
          ) : (
            filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={() => onLike(post.id)}
              />
            ))
          )}
        </Box>

        {/* Floating Action Button */}
        <Tooltip title="Create New Post" placement="left">
          <Fab
            color="primary"
            aria-label="create post"
            onClick={handleCreatePost}
            sx={{
              position: "fixed",
              bottom: 24,
              right: 24,
              zIndex: 1000,
            }}
          >
            <AddIcon />
          </Fab>
        </Tooltip>
      </Container>
    );
  }

  // Show empty state when no posts
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header Section */}
      <Box mb={4}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Welcome to Decentralized Social Media
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          Share your thoughts, mint NFTs, and participate in community governance
        </Typography>
      </Box>

      {/* Empty State */}
      <Box textAlign="center" py={8}>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          No posts yet
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Be the first to share something amazing!
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={handleCreatePost}
          startIcon={<AddIcon />}
          sx={{ borderRadius: 3 }}
        >
          Create Your First Post
        </Button>
      </Box>
    </Container>
  );
};

export default Home;
