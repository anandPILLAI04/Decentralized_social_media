import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Container,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from "@mui/material";
import {
  Add as AddIcon,
  TrendingUp as TrendingIcon,
  Schedule as ScheduleIcon,
  Favorite as FavoriteIcon,
  Explore as ExploreIcon,
  People as PeopleIcon,
  AllInclusive as AllIcon,
  Image as NFTIcon,
  Cloud as IPFSIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import PostCard from "../components/PostCard";
import { fetchPosts } from "../services/apiService";
import { getUserProfile } from '../utils/safeStorage';

const Home = () => {
  // State management
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filter states
  const [feedType, setFeedType] = useState(0); // 0=Explore, 1=Following
  const [sortBy, setSortBy] = useState('latest');
  const [filterBy, setFilterBy] = useState('all');
  
  // Infinite scroll observer
  const observerTarget = useRef(null);
  
  const navigate = useNavigate();
  
  // Get wallet address from localStorage
  useEffect(() => {
    const user = getUserProfile();
    if (user) {
      setWalletAddress(user.walletAddress || '');
    }
  }, []);

  // Load initial posts
  useEffect(() => {
    loadPosts(true);
  }, [feedType, sortBy, filterBy]);
  
  // Check if we need to scroll to a specific post (from notification)
  useEffect(() => {
    const scrollToPostId = sessionStorage.getItem('scrollToPostId');
    if (scrollToPostId && posts.length > 0) {
      // Wait a bit for DOM to render
      setTimeout(() => {
        const postElement = document.getElementById(`post-${scrollToPostId}`);
        if (postElement) {
          postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the post briefly
          postElement.style.border = '2px solid #FF6B6B';
          postElement.style.boxShadow = '0 0 20px rgba(255, 107, 107, 0.3)';
          setTimeout(() => {
            postElement.style.border = '';
            postElement.style.boxShadow = '';
          }, 3000);
          // Clear the sessionStorage
          sessionStorage.removeItem('scrollToPostId');
        }
      }, 500);
    }
  }, [posts]);
  
  // Load posts function
  const loadPosts = async (reset = false) => {
    if (reset) {
      setPage(1);
      setPosts([]);
      setHasMore(true);
    }
    
    const currentPage = reset ? 1 : page;
    
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    setError(null);
    
    try {
      const options = {
        sort: sortBy,
        filter: filterBy,
        following: feedType === 1,
        userId: feedType === 1 ? walletAddress : null
      };
      
      const response = await fetchPosts(currentPage, 10, options);
      
      if (response.success && response.posts) {
        // Format posts
        const formattedPosts = response.posts.map(post => ({
          ...post,
          id: post._id || post.id,
          author: post.authorId || post.author,
          authorName: post.authorName || 'Unknown',
          authorAvatar: post.authorAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${post.authorId || post.author}`,
          timestamp: new Date(post.timestamp).getTime(),
          likes: post.likesCount || 0,
          comments: post.commentCount || 0,
        }));
        
        if (reset) {
          setPosts(formattedPosts);
        } else {
          setPosts(prev => [...prev, ...formattedPosts]);
        }
        
        // Check if there are more posts
        setHasMore(response.pagination?.hasNext || false);
        
        // Increment page for next load
        if (!reset) {
          setPage(prev => prev + 1);
        }
      } else {
        if (reset) {
          setPosts([]);
        }
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading posts:", err);
      setError(`Failed to load posts: ${err.message}`);
      if (reset) {
        setPosts([]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  // Infinite scroll observer setup
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          console.log('📜 Loading more posts...');
          loadPosts(false);
        }
      },
      { threshold: 0.1 }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loadingMore, loading, page]);
  
  // Handle feed type change
  const handleFeedChange = (event, newValue) => {
    if (newValue !== null) {
      setFeedType(newValue);
    }
  };
  
  // Handle sort change
  const handleSortChange = (event, newSort) => {
    if (newSort !== null) {
      setSortBy(newSort);
    }
  };
  
  // Handle filter change
  const handleFilterChange = (event, newFilter) => {
    if (newFilter !== null) {
      setFilterBy(newFilter);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header Section */}
      <Box mb={4}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            Home Feed
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate("/create")}
            sx={{ borderRadius: 'full', fontWeight: 600 }}
          >
            Create Post
          </Button>
        </Box>
        
        {/* Feed Type Tabs */}
        <Tabs
          value={feedType}
          onChange={handleFeedChange}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab 
            icon={<ExploreIcon />} 
            iconPosition="start" 
            label="Explore" 
            sx={{ textTransform: 'none', fontWeight: 600 }}
          />
          <Tab 
            icon={<PeopleIcon />} 
            iconPosition="start" 
            label="Following" 
            sx={{ textTransform: 'none', fontWeight: 600 }}
          />
        </Tabs>
        
        {/* Sort Options */}
        <Box display="flex" gap={2} alignItems="center" mb={2} flexWrap="wrap">
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Sort by:
          </Typography>
          <ToggleButtonGroup
            value={sortBy}
            exclusive
            onChange={handleSortChange}
            size="small"
          >
            <ToggleButton value="latest" sx={{ textTransform: 'none', px: 2 }}>
              <ScheduleIcon sx={{ mr: 0.5, fontSize: 18 }} />
              Latest
            </ToggleButton>
            <ToggleButton value="popular" sx={{ textTransform: 'none', px: 2 }}>
              <FavoriteIcon sx={{ mr: 0.5, fontSize: 18 }} />
              Popular
            </ToggleButton>
            <ToggleButton value="trending" sx={{ textTransform: 'none', px: 2 }}>
              <TrendingIcon sx={{ mr: 0.5, fontSize: 18 }} />
              Trending
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        {/* Filter Options */}
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            Show:
          </Typography>
          <ToggleButtonGroup
            value={filterBy}
            exclusive
            onChange={handleFilterChange}
            size="small"
          >
            <ToggleButton value="all" sx={{ textTransform: 'none', px: 2 }}>
              <AllIcon sx={{ mr: 0.5, fontSize: 18 }} />
              All Posts
            </ToggleButton>
            <ToggleButton value="nft" sx={{ textTransform: 'none', px: 2 }}>
              <NFTIcon sx={{ mr: 0.5, fontSize: 18 }} />
              NFTs Only
            </ToggleButton>
            <ToggleButton value="ipfs" sx={{ textTransform: 'none', px: 2 }}>
              <IPFSIcon sx={{ mr: 0.5, fontSize: 18 }} />
              IPFS Only
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        {/* Stats Chips */}
        <Box display="flex" gap={1} mt={2}>
          <Chip
            label={`${posts.length} Posts Loaded`}
            size="small"
            color="primary"
            variant="outlined"
          />
          {filterBy === 'nft' && (
            <Chip
              label={`${posts.filter(p => p.isNFT).length} NFTs`}
              size="small"
              color="secondary"
              variant="outlined"
            />
          )}
        </Box>
      </Box>
      
      <Divider sx={{ mb: 3 }} />
      
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Loading Initial Posts */}
      {loading && posts.length === 0 && (
        <Box display="flex" flexDirection="column" alignItems="center" py={8}>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            Loading {feedType === 0 ? 'explore' : 'following'} feed...
          </Typography>
        </Box>
      )}
      
      {/* Empty State */}
      {!loading && posts.length === 0 && (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {feedType === 1 
              ? "You're not following anyone yet" 
              : "No posts found"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {feedType === 1 
              ? "Start following users to see their posts here" 
              : "Be the first to create a post!"}
          </Typography>
          <Button
            variant="contained"
            onClick={() => feedType === 1 ? navigate("/home") : navigate("/create")}
            sx={{ borderRadius: 'full' }}
          >
            {feedType === 1 ? "Explore Posts" : "Create Post"}
          </Button>
        </Box>
      )}
      
      {/* Posts List */}
      <Box>
        {posts.map((post, index) => (
          <PostCard
            key={post.id || `post-${index}`}
            post={post}
            walletAddress={walletAddress}
          />
        ))}
      </Box>
      
      {/* Loading More Indicator */}
      {loadingMore && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={30} />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
            Loading more posts...
          </Typography>
        </Box>
      )}
      
      {/* End of Feed Message */}
      {!loading && !loadingMore && posts.length > 0 && !hasMore && (
        <Box textAlign="center" py={4}>
          <Typography variant="body2" color="text.secondary">
            🎉 You've reached the end! No more posts to load.
          </Typography>
        </Box>
      )}
      
      {/* Infinite Scroll Trigger */}
      <div ref={observerTarget} style={{ height: '20px', margin: '20px 0' }} />
    </Container>
  );
};

export default Home;
