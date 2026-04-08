import React, { useState, useEffect } from "react";
import useWallet from "./hooks/useWallet";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Box, CircularProgress, Alert, Snackbar, Typography } from "@mui/material";
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import CreatePost from "./pages/CreatePost";
import Governance from "./pages/Governance";
import GovernanceCaseDetail from "./components/GovernanceCaseDetail";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import { fetchPosts, likePost, signupUser, loginUser, getNonce } from "./services/apiService";
import { tokens, createThemeFromTokens } from "./theme/designTokens";

// Create a theme from our design tokens
const cribTheme = createTheme(createThemeFromTokens(tokens));

function App() {
  // Wallet and profile states
  const wallet = useWallet();
  const [googleProfile, setGoogleProfile] = useState(null);
  const [manualProfile, setManualProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [registered, setRegistered] = useState(localStorage.getItem("registered") === "true");
  const [walletInitializing, setWalletInitializing] = useState(true);

  const location = useLocation();

  // User is registered ONLY if both wallet is connected AND registered flag is true
  const isRegistered = wallet.address && registered;

  // Debug logging
  console.log('🔐 Auth state:', {
    walletAddress: wallet.address,
    localStorageRegistered: localStorage.getItem("registered"),
    isRegistered,
    walletInitializing,
    currentPath: location.pathname
  });

  // Wait for wallet initialization to complete
  useEffect(() => {
    // Give wallet hook time to check for existing connection
    const timer = setTimeout(() => {
      setWalletInitializing(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Load posts on component mount
  useEffect(() => {
    if (!walletInitializing) {
      loadPosts();
    }
  }, [walletInitializing]);

  // Handle wallet connection/disconnection
  useEffect(() => {
    // If wallet disconnects after initialization, force logout
    if (!walletInitializing && !wallet.address && localStorage.getItem("registered") === "true") {
      console.log('⚠️ Wallet disconnected, forcing logout');
      handleLogout();
    }
  }, [wallet.address, walletInitializing]);

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

  // Handle new post creation (reload posts from database)
  const handleCreatePost = async (newPost) => {
    console.log('📝 New post created:', newPost);
    
    // Reload all posts to include the new one
    await loadPosts();
    
    setNotification({
      open: true,
      message: newPost?.isNFT ? 'NFT post created successfully!' : 'Post created successfully!',
      severity: 'success'
    });
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

  // Handle logout
  const handleLogout = () => {
    console.log('🔓 Logging out user');
    wallet.disconnect();
    setManualProfile(null);
    setGoogleProfile(null);
    setPosts([]);
    setRegistered(false); // Update state to trigger re-render
    setNotification({ open: true, message: 'Logged out successfully', severity: 'info' });
  };

  // Authentication and routing logic
  const isPublicPath = location.pathname === "/" || location.pathname === "/auth";
  const shouldRedirectToLanding = !isRegistered && !isPublicPath;
  const showNavBar = location.pathname !== "/" && location.pathname !== "/auth";
  
  // Redirect to landing page if not registered and trying to access protected routes
  if (shouldRedirectToLanding) {
    console.log('🔄 Redirecting to landing page - user not registered');
    return <Navigate to="/" replace />;
  }

  // Don't show loading state on public pages
  const shouldShowLoading = loading && !isPublicPath;
  
  console.log('🎯 Render state:', {
    shouldShowLoading,
    loading,
    currentPath: location.pathname,
    postsCount: posts.length,
    isRegistered,
    showNavBar
  });

  // Auth page component
  async function handleManualSignUp(form) {
    if (!wallet.address) {
      setNotification({ open: true, message: 'Connect your wallet first', severity: 'warning' });
      return { success: false, error: 'No wallet connected' };
    }
    try {
      setLoading(true);
      setError(null);

      // Step 1: Get challenge message
      console.log('📝 Getting challenge message for signup...');
      const { message } = await getNonce(wallet.address);
      console.log('✅ Got challenge message');

      // Step 2: Sign the message
      console.log('✍️ Signing message with wallet...');
      const signature = await wallet.signMessage(message, wallet.address);
      console.log('✅ Message signed');

      // Step 3: Sign up with signature
      const res = await signupUser({
        walletAddress: wallet.address,
        username: form.username,
        displayName: form.name || form.username,
        avatar: form.avatar || '',
        avatarIpfsHash: form.avatarIpfsHash || '',
        bio: form.bio || '',
        email: form.email || '',
        location: form.location || '',
        website: form.website || '',
        twitter: form.twitter || '',
        signature,
        message
      });

      // Check if signup failed due to conflict
      if (res.success === false) {
        setError(res.error);
        setNotification({ open: true, message: res.error, severity: 'error' });
        return res;
      }

      // Signup successful
      setManualProfile(res.user);
      localStorage.setItem('registered', 'true');
      localStorage.setItem('userProfile', JSON.stringify(res.user));
      setRegistered(true); // Update state to trigger re-render
      setNotification({ open: true, message: 'Sign up successful! Welcome to Crib!', severity: 'success' });
      return { success: true, user: res.user };
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
      setError('Sign up failed: ' + errorMsg);
      setNotification({ open: true, message: 'Sign up failed: ' + errorMsg, severity: 'error' });
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }

  async function handleWalletConnect() {
    try {
      console.log('🔌 Attempting to connect wallet...');
      // Connect wallet and get the address immediately
      const walletAddress = await wallet.connect();
      console.log('✅ Wallet connected, address:', walletAddress);
      
      if (walletAddress) {
        setLoading(true);
        setError(null);

        try {
          console.log('📝 Getting challenge message (nonce)...');
          const { message } = await getNonce(walletAddress);
          console.log('✅ Got challenge message');

          console.log('✍️ Signing message with wallet...');
          const signature = await wallet.signMessage(message, walletAddress);
          console.log('✅ Message signed');

          console.log('🔍 Logging in with signature...');
          const res = await loginUser(walletAddress, signature, message);
          console.log('📥 Login response:', res);

          if (res.user) {
            // Existing user found
            console.log('✅ Existing user found:', res.user);
            setManualProfile(res.user);
            localStorage.setItem('registered', 'true');
            localStorage.setItem('userProfile', JSON.stringify(res.user));
            if (res.token) {
              localStorage.setItem('token', res.token);
            }
            setRegistered(true); // Update state to trigger re-render
            setNotification({ open: true, message: 'Welcome back!', severity: 'success' });
            return { success: true, user: res.user };
          } else if (res.isNewUser) {
            // New user - they need to complete signup
            console.log('👤 New user detected - needs to complete profile');
            setNotification({ open: true, message: 'Please complete your profile setup', severity: 'info' });
            return { success: false, isNewUser: true };
          }
        } catch (signError) {
          console.error('❌ Signing or login error:', signError);
          const errorMsg = signError.message || 'Failed to authenticate wallet';

          if (errorMsg.includes('User not found') || errorMsg.includes('isNewUser')) {
            // New user
            console.log('👤 New user - showing profile setup');
            setNotification({ open: true, message: 'Welcome! Please complete your profile', severity: 'info' });
            return { success: false, isNewUser: true };
          }

          setError('Connection failed: ' + errorMsg);
          setNotification({ open: true, message: 'Connection failed: ' + errorMsg, severity: 'error' });
          return { success: false, error: errorMsg };
        }
      }
    } catch (err) {
      console.error('❌ Wallet connection error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
      
      if (errorMsg.includes('User not found') || err.response?.data?.isNewUser) {
        // New user
        console.log('👤 New user - showing profile setup');
        setNotification({ open: true, message: 'Welcome! Please complete your profile', severity: 'info' });
        return { success: false, isNewUser: true };
      }
      
      setError('Connection failed: ' + errorMsg);
      setNotification({ open: true, message: 'Connection failed: ' + errorMsg, severity: 'error' });
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
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
        walletConnected={wallet.address} // Pass the actual address, not boolean
        walletConnecting={wallet.connecting} // Pass connecting state for button disabling
        googleProfile={googleProfile}
      />
    );
  }

  // Show loading screen while wallet is initializing
  if (walletInitializing) {
    return (
      <ThemeProvider theme={cribTheme}>
        <CssBaseline />
        <Box 
          sx={{ 
            minHeight: '100vh', 
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2
          }}
        >
          <CircularProgress size={60} thickness={4} sx={{ color: 'primary.main' }} />
          <Typography variant="h6" color="text.secondary">
            Initializing...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={cribTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {/* Only show NavBar if not on landing or auth pages */}
        {showNavBar && (
          <NavBar
            walletAddress={wallet.address}
            onWalletConnect={wallet.connect}
            onLogout={handleLogout}
            connecting={wallet.connecting}
          />
        )}
        
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

        {error && !isPublicPath && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        <Routes>
          {/* Public Routes */}
          <Route 
            path="/" 
            element={
              isRegistered ? <Navigate to="/home" replace /> : <Landing />
            } 
          />
          <Route path="/auth" element={<AuthPage />} />
          
          {/* Protected Routes */}
          <Route 
            path="/home" 
            element={
              isRegistered ? (
                <Home 
                  posts={posts} 
                  onLike={handleLikePost}
                  onRefresh={loadPosts}
                  loading={loading}
                />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route
            path="/profile"
            element={
              isRegistered ? (
                <Profile 
                  posts={posts.filter(p => p.author === wallet.address)} 
                  walletAddress={wallet.address} 
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          {/* Route to view other users' profiles */}
          <Route
            path="/profile/:address"
            element={
              isRegistered ? (
                <Profile 
                  posts={posts} 
                  walletAddress={wallet.address} 
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/create"
            element={
              isRegistered ? (
                <CreatePost
                  onCreatePost={handleCreatePost}
                  walletAddress={wallet.address}
                  loading={loading}
                />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route 
            path="/governance" 
            element={
              isRegistered ? (
                <Governance walletAddress={wallet.address} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
          <Route 
            path="/governance/case/:caseId" 
            element={
              isRegistered ? (
                <GovernanceCaseDetail walletAddress={wallet.address} />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
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
