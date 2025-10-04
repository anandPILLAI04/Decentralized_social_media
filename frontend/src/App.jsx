import React, { useState, useEffect } from "react";
import useWallet from "./hooks/useWallet";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Box, CircularProgress, Alert, Snackbar } from "@mui/material";
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import CreatePost from "./pages/CreatePost";
import Governance from "./pages/Governance";
import Auth from "./pages/Auth";
import { fetchPosts, likePost, signupUser, loginUser } from "./services/apiService";

// Create a modern theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6366f1',
      light: '#818cf8',
      dark: '#4f46e5',
    },
    secondary: {
      main: '#ec4899',
      light: '#f472b6',
      dark: '#db2777',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.125rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        },
      },
    },
  },
});

function App() {
  // Wallet and profile states
  const wallet = useWallet();
  const [googleProfile, setGoogleProfile] = useState(null);
  const [manualProfile, setManualProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  const location = useLocation();

  const isRegistered = wallet.address || localStorage.getItem("registered") === "true";

  // Debug logging
  console.log('🔐 Auth state:', {
    walletAddress: wallet.address,
    localStorageRegistered: localStorage.getItem("registered"),
    isRegistered,
    currentPath: location.pathname
  });

  // Load posts on component mount
  useEffect(() => {
    loadPosts();
  }, []);

  // Simulate persistent auth (replace with real logic later)
  useEffect(() => {
    const registered = localStorage.getItem("registered");
    if (wallet.address && !registered) {
      localStorage.setItem("registered", "true");
    }
  }, [wallet.address]);

  // Load posts from backend API (free)
  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchPosts();
      if (response.success) {
        setPosts(response.posts);
      } else {
        setError('Failed to load posts');
      }
    } catch (err) {
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  // Handle new post creation (prepend to feed)
  const handleCreatePost = async ({ content, image, mintNFT }) => {
    try {
      setLoading(true);
      if (mintNFT) {
        // Optionally, fetch the new NFT post from chain (not implemented here)
        setNotification({
          open: true,
          message: 'NFT post created on-chain! (refresh to see on-chain posts)',
          severity: 'success'
        });
      } else {
        setPosts([{ id: Date.now(), content, mediaUrl: image, isNFT: false, likes: 0, comments: 0, author: wallet.address, timestamp: Date.now() }, ...posts]);
        setNotification({
          open: true,
          message: 'Post created successfully!',
          severity: 'success'
        });
      }
    } catch (err) {
      setError('Failed to create post');
      setNotification({
        open: true,
        message: 'Failed to create post',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle post like
  const handleLikePost = async (postId) => {
    if (!wallet.address) {
      setNotification({
        open: true,
        message: 'Please connect your wallet to like posts',
        severity: 'warning'
      });
      return;
    }

    try {
      const response = await likePost(postId, wallet.address);
      if (response.success) {
        setPosts(posts.map(post => 
          post.id === postId 
            ? { ...post, likes: response.likes }
            : post
        ));
      }
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  // Close notification
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  // Redirect to /auth if not registered
  if (!isRegistered && location.pathname !== "/auth") {
    console.log('🔄 Redirecting to /auth - user not registered');
    return <Navigate to="/auth" replace />;
  }

  // Don't show loading state if user is on auth page
  const shouldShowLoading = loading && location.pathname !== "/auth";
  
  console.log('🎯 Render state:', {
    shouldShowLoading,
    loading,
    currentPath: location.pathname,
    postsCount: posts.length
  });

  // Auth page component
  async function handleManualSignUp(form) {
    if (!wallet.address) {
      setNotification({ open: true, message: 'Connect your wallet first', severity: 'warning' });
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await signupUser({
        walletAddress: wallet.address,
        username: form.name,
        avatar: googleProfile?.imageUrl || '',
        bio: '',
        email: form.email
      });
      setManualProfile(res.user);
      localStorage.setItem('registered', 'true');
      setNotification({ open: true, message: 'Sign up successful!', severity: 'success' });
    } catch (err) {
      setError('Sign up failed: ' + (err.message || 'Unknown error'));
      setNotification({ open: true, message: 'Sign up failed', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleWalletConnect() {
    await wallet.connect();
    if (wallet.address) {
      try {
        setLoading(true);
        setError(null);
        const res = await loginUser(wallet.address);
        if (res.user) {
          setManualProfile(res.user);
          localStorage.setItem('registered', 'true');
          setNotification({ open: true, message: 'Login successful!', severity: 'success' });
        }
      } catch (err) {
        setError('Login failed: ' + (err.message || 'Unknown error'));
        setNotification({ open: true, message: 'Login failed', severity: 'error' });
      } finally {
        setLoading(false);
      }
    }
  }

  function AuthPage() {
    return (
      <Auth
        onWalletConnect={handleWalletConnect}
        onGoogleSignIn={() =>
          setGoogleProfile({
            name: "Alice G.",
            imageUrl: "https://randomuser.me/api/portraits/women/45.jpg"
          })
        }
        onManualSignUp={handleManualSignUp}
        walletConnected={!!wallet.address}
        googleProfile={googleProfile}
      />
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <NavBar
          walletAddress={wallet.address}
          onWalletConnect={wallet.connect}
          connecting={wallet.connecting}
        />
        
        {shouldShowLoading && (
          <Box 
            display="flex" 
            justifyContent="center" 
            alignItems="center" 
            minHeight="200px"
          >
            <CircularProgress size={40} />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route 
            path="/" 
            element={
              <Home 
                posts={posts} 
                onLike={handleLikePost}
                onRefresh={loadPosts}
                loading={loading}
              />
            } 
          />
          <Route
            path="/profile"
            element={
              <Profile 
                posts={posts.filter(p => p.author === wallet.address)} 
                walletAddress={wallet.address} 
              />
            }
          />
          <Route
            path="/create"
            element={
              <CreatePost
                onCreatePost={handleCreatePost}
                walletAddress={wallet.address}
                loading={loading}
              />
            }
          />
          <Route path="/governance" element={<Governance />} />
        </Routes>

        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default App;
