import React, { useState, useEffect } from "react";
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  Divider, 
  Avatar, 
  TextField, 
  FormControlLabel, 
  Switch,
  Grid,
  Stepper,
  Step,
  StepLabel,
  Tabs,
  Tab,
  Alert,
  Card,
  CardContent,
  IconButton,
  Link,
  CircularProgress,
  Snackbar
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SecurityIcon from '@mui/icons-material/Security';
import StorageIcon from '@mui/icons-material/Storage';
import LockIcon from '@mui/icons-material/Lock';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { uploadAvatar } from '../services/apiService';
import ImageCropModal from '../components/ImageCropModal';

export default function Auth({
  onWalletConnect,
  onGoogleSignIn,
  onManualSignUp,
  walletConnected,
  walletConnecting = false,
  isSignedIn = false,
  googleProfile
}) {
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    username: "", 
    bio: "", 
    location: "",
    website: "",
    twitter: "",
    agree: false,
    avatar: "",
    avatarIpfsHash: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [showCropModal, setShowCropModal] = useState(false);
  const [originalImageSrc, setOriginalImageSrc] = useState(null);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Handle wallet connection
  const handleWalletConnect = async () => {
    console.log('🔌 Auth page: Connecting wallet...');
    setWalletLoading(true);
    try {
      const result = await onWalletConnect();
      console.log('📥 Auth page: Wallet connect result:', result);
      
      if (result && result.success && result.user) {
        // Existing user - redirect to home immediately
        console.log('✅ Existing user - redirecting to home');
        setNotification({
          open: true,
          message: 'Welcome back! Redirecting...',
          severity: 'success'
        });
        // Add a small delay to show the success message, then redirect
        setTimeout(() => {
          navigate('/home', { replace: true });
        }, 1000);
      } else if (result && result.isNewUser) {
        // New user - move to profile creation
        console.log('👤 New user - showing profile form');
        
        // Switch to Sign Up tab (tab 0) if user was on Sign In tab
        if (activeTab === 1) {
          setActiveTab(0);
          setNotification({
            open: true,
            message: 'New user detected! Please complete your profile to continue.',
            severity: 'info'
          });
        } else {
          setNotification({
            open: true,
            message: 'Please complete your profile to continue',
            severity: 'info'
          });
        }
        
        // Move to profile creation step
        setActiveStep(1);
      } else {
        // Something went wrong
        console.error('⚠️ Unexpected result:', result);
        setNotification({
          open: true,
          message: 'Connection successful, but something went wrong. Please try again.',
          severity: 'warning'
        });
      }
    } catch (error) {
      console.error("❌ Wallet connection error:", error);
      setNotification({
        open: true,
        message: error.message || 'Failed to connect wallet',
        severity: 'error'
      });
    } finally {
      setWalletLoading(false);
    }
  };

  // Handle avatar file selection
  const handleAvatarChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (5MB limit matches backend)
      if (file.size > 5 * 1024 * 1024) {
        setNotification({
          open: true,
          message: 'File size must be less than 5MB',
          severity: 'error'
        });
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setNotification({
          open: true,
          message: 'Please select an image file',
          severity: 'error'
        });
        return;
      }
      
      // Read file and open crop modal
      const reader = new FileReader();
      reader.onloadend = () => {
        setOriginalImageSrc(reader.result);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle crop complete
  const handleCropComplete = (croppedFile) => {
    setAvatarFile(croppedFile);
    
    // Create preview from cropped file
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(croppedFile);
    
    setShowCropModal(false);
    setNotification({
      open: true,
      message: 'Image cropped successfully',
      severity: 'success'
    });
  };

  // Upload avatar to IPFS
  const handleUploadAvatar = async () => {
    if (!avatarFile || !walletConnected) {
      return null;
    }

    try {
      setUploadingAvatar(true);
      const result = await uploadAvatar(walletConnected, avatarFile);
      if (result && result.success) {
        setForm({
          ...form,
          avatar: result.avatar,
          avatarIpfsHash: result.ipfsHash
        });
        setNotification({
          open: true,
          message: '✅ Avatar uploaded successfully!',
          severity: 'success'
        });
        return result;
      } else {
        // Avatar upload failed but won't block signup
        console.warn('Avatar upload failed:', result?.error);
        setNotification({
          open: true,
          message: '⚠️ Avatar upload failed, continuing without avatar',
          severity: 'warning'
        });
        return null;
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      setNotification({
        open: true,
        message: '⚠️ Avatar upload failed, but continuing with signup',
        severity: 'warning'
      });
      // Avatar upload is optional - don't block signup
      return null;
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Update step when wallet connects
  useEffect(() => {
    if (walletConnected && activeStep === 0 && activeTab === 0) {
      setActiveStep(1);
    }
  }, [walletConnected, activeStep, activeTab]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('📝 Submitting signup form...');
    setIsSubmitting(true);
    
    try {
      // Create updated form data
      let formData = { ...form };
      
      // Try to upload avatar if selected (optional - don't block signup if it fails)
      if (avatarFile && !form.avatarIpfsHash) {
        console.log('📸 Uploading avatar...');
        try {
          const uploadResult = await handleUploadAvatar();
          if (uploadResult && uploadResult.avatar && uploadResult.ipfsHash) {
            console.log('✅ Avatar uploaded:', uploadResult);
            // Update form data with avatar info
            formData.avatar = uploadResult.avatar;
            formData.avatarIpfsHash = uploadResult.ipfsHash;
            // Also update the form state
            setForm(prevForm => ({
              ...prevForm,
              avatar: uploadResult.avatar,
              avatarIpfsHash: uploadResult.ipfsHash
            }));
          }
        } catch (avatarError) {
          console.warn('⚠️ Avatar upload failed, continuing without avatar:', avatarError);
          // Continue signup without avatar - not critical
        }
      }
      
      console.log('📤 Calling signup with form data:', formData);
      const result = await onManualSignUp(formData);
      console.log('📥 Signup result:', result);
      
      if (result && result.success) {
        console.log('✅ Signup successful! Redirecting to home...');
        setActiveStep(2); // Move to success step
        setNotification({
          open: true,
          message: 'Profile created successfully! Redirecting...',
          severity: 'success'
        });
        // Navigate to home immediately after showing success
        setTimeout(() => {
          navigate('/home');
        }, 1500);
      } else {
        console.error('❌ Signup failed:', result);
        
        // If user already exists, suggest switching to Sign In tab
        if (result?.shouldLogin) {
          setNotification({
            open: true,
            message: result.error + ' Switch to Sign In tab.',
            severity: 'warning'
          });
          // Optionally auto-switch to sign in tab after 2 seconds
          setTimeout(() => {
            setActiveTab(1);
          }, 2000);
        } else if (result?.usernameTaken) {
          // Just show error for username conflict
          setNotification({
            open: true,
            message: result.error,
            severity: 'error'
          });
        } else {
          setNotification({
            open: true,
            message: result?.error || 'Signup failed. Please try again.',
            severity: 'error'
          });
        }
      }
    } catch (error) {
      console.error("❌ Signup error:", error);
      setNotification({
        open: true,
        message: error.message || 'Signup failed. Please try again.',
        severity: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Steps for the signup process
  const steps = [
    'Connect Wallet',
    'Create Profile',
    'Get Started'
  ];

  // Features section content
  const features = [
    {
      icon: <SecurityIcon fontSize="large" color="primary" />,
      title: "Own Your Content",
      description: "All your content is stored on IPFS and referenced on blockchain for true ownership."
    },
    {
      icon: <StorageIcon fontSize="large" color="primary" />,
      title: "Decentralized Storage",
      description: "Content is stored on IPFS, making it resistant to censorship and centralized control."
    },
    {
      icon: <LockIcon fontSize="large" color="primary" />,
      title: "Secure Authentication",
      description: "Your identity is secured by blockchain technology - no passwords to hack."
    }
  ];
  
  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)',
        py: 6,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative blobs */}
      <Box 
        sx={{ 
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.15), rgba(255, 217, 61, 0.15))',
          filter: 'blur(80px)',
          zIndex: 0
        }}
      />
      
      <Box 
        sx={{ 
          position: 'absolute',
          bottom: '10%',
          right: '5%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.12), rgba(6, 214, 160, 0.12))',
          filter: 'blur(90px)',
          zIndex: 0
        }}
      />
      
      <Box 
        sx={{ 
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 107, 107, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          zIndex: 0
        }}
      />
      <Grid container spacing={4} justifyContent="center" sx={{ position: 'relative', zIndex: 1 }}>
        {/* Left Column - Authentication */}
        <Grid item xs={12} md={5} lg={4}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: { xs: 4, sm: 6 }, 
              borderRadius: 5, 
              width: '100%',
              maxWidth: '95vw',
              mx: 'auto',
              backdropFilter: 'blur(20px)',
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              border: '1px solid',
              borderColor: 'rgba(255, 107, 107, 0.1)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            <Box mb={5} textAlign="center">
              <Typography 
                variant="h3" 
                fontWeight={900} 
                mb={2}
                sx={{
                  background: 'linear-gradient(135deg, #FF6B6B 0%, #FFD93D 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.03em',
                  fontSize: { xs: '2rem', sm: '2.5rem' }
                }}
              >
                Welcome to crib
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>
                Your personal space in the decentralized web
              </Typography>
            </Box>
            
            {/* Auth Tabs */}
            <Paper 
              elevation={0}
              sx={{ 
                mb: 4, 
                borderRadius: 'full',
                display: 'flex',
                p: 0.6,
                bgcolor: 'grey.100'
              }}
            >
              <Tabs 
                value={activeTab} 
                onChange={handleTabChange} 
                variant="fullWidth" 
                TabIndicatorProps={{ sx: { display: 'none' } }}
                sx={{ 
                  width: '100%',
                  '& .MuiTab-root': {
                    borderRadius: 'full',
                    minHeight: '48px',
                    fontWeight: 600,
                    zIndex: 1
                  },
                  '& .Mui-selected': {
                    color: 'text.primary',
                    bgcolor: 'white',
                    boxShadow: 1
                  }
                }}
              >
                <Tab label="Sign Up" disableRipple />
                <Tab label="Sign In" disableRipple />
              </Tabs>
            </Paper>
            
            {/* Stepper for Sign Up Process */}
            {activeTab === 0 && (
              <Stepper 
                activeStep={activeStep} 
                alternativeLabel 
                sx={{ 
                  mb: 4,
                  '& .MuiStepLabel-root .Mui-completed': {
                    color: 'secondary.main'
                  },
                  '& .MuiStepLabel-root .Mui-active': {
                    color: 'primary.main'
                  }
                }}
              >
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            )}
            
            {/* Step 1: Connect Wallet */}
            {activeTab === 0 && activeStep === 0 && (
              <Box>
                <Paper
                  elevation={0}
                  sx={{ 
                    mb: 4, 
                    p: 3,
                    borderRadius: 3,
                    bgcolor: 'rgba(255, 107, 107, 0.06)',
                    border: '2px solid',
                    borderColor: 'rgba(255, 107, 107, 0.15)'
                  }}
                >
                  <Typography component="div" variant="body2" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, lineHeight: 1.7, fontSize: '0.95rem' }}>
                    <HelpOutlineIcon fontSize="small" color="primary" sx={{ mt: 0.2 }} />
                    <Box>
                      <strong>What's a blockchain wallet?</strong><br />
                      It's your secure digital identity on crib. No passwords needed - just connect and go!
                    </Box>
                  </Typography>
                </Paper>
                
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={(walletLoading || walletConnecting) ? <CircularProgress size={22} color="inherit" /> : <AccountBalanceWalletIcon />}
                  onClick={handleWalletConnect}
                  fullWidth
                  sx={{ 
                    fontWeight: 700, 
                    borderRadius: 3, 
                    py: 2,
                    mb: 3,
                    boxShadow: '0 8px 24px rgba(255, 107, 107, 0.3)',
                    fontSize: '1rem',
                    '&:hover': {
                      boxShadow: '0 12px 32px rgba(255, 107, 107, 0.4)'
                    }
                  }}
                  disabled={walletLoading || walletConnecting}
                >
                  {walletConnected ? "✓ Wallet Connected — Continue" : ((walletLoading || walletConnecting) ? "Connecting..." : "Connect Wallet")}
                </Button>

                <Paper
                  elevation={0}
                  sx={{ 
                    mt: 4, 
                    p: 2.5,
                    borderRadius: 3,
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.200',
                    textAlign: 'center'
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.95rem' }}>
                    New to web3? No wallet yet?
                  </Typography>
                  <Link 
                    href="https://metamask.io/download/" 
                    target="_blank" 
                    rel="noopener" 
                    underline="hover"
                    sx={{ fontWeight: 600, color: 'primary.main', fontSize: '0.95rem' }}
                  >
                    Get a free MetaMask wallet →
                  </Link>
                </Paper>
              </Box>
            )}
            
            {/* Step 2: Create Profile */}
            {activeTab === 0 && activeStep === 1 && (
              <Box component="form" onSubmit={handleSubmit}>
                <Paper
                  elevation={0}
                  sx={{ 
                    mb: 5, 
                    p: 3,
                    borderRadius: 3,
                    bgcolor: 'rgba(6, 214, 160, 0.08)',
                    border: '2px solid',
                    borderColor: 'rgba(6, 214, 160, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                  }}
                >
                  <Avatar sx={{ bgcolor: '#06D6A0', width: 40, height: 40 }}>
                    <CheckCircleIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" sx={{ color: '#065F46', fontWeight: 700, mb: 0.5 }}>
                      Wallet connected successfully
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#047857', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {walletConnected ? (typeof walletConnected === 'string' ? walletConnected.substring(0, 6) + '...' + walletConnected.substring(walletConnected.length - 4) : "Wallet Connected") : ""}
                    </Typography>
                  </Box>
                </Paper>
                
                <Typography variant="h5" fontWeight={700} sx={{ mb: 4, fontSize: '1.5rem' }}>
                  Create Your Profile
                </Typography>
                
                <Grid container spacing={3.5}>
                  <Grid item xs={12}>
                    <Box mb={1.5} ml={0.5}>
                      <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                        Profile Avatar
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={2.5} mb={2}>
                      <Avatar 
                        src={avatarPreview || googleProfile?.imageUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${walletConnected || 'default'}`} 
                        sx={{ 
                          width: 72, 
                          height: 72,
                          border: '3px solid',
                          borderColor: 'primary.light',
                          boxShadow: '0 4px 12px rgba(255, 107, 107, 0.2)'
                        }}
                      />
                      <Box>
                        <input
                          accept="image/*"
                          style={{ display: 'none' }}
                          id="avatar-upload"
                          type="file"
                          onChange={handleAvatarChange}
                        />
                        <label htmlFor="avatar-upload">
                          <Button
                            variant="outlined"
                            component="span"
                            size="medium"
                            startIcon={uploadingAvatar ? <CircularProgress size={20} /> : <PhotoCameraIcon />}
                            disabled={uploadingAvatar}
                            sx={{ 
                              borderRadius: 2,
                              textTransform: 'none',
                              borderColor: 'grey.300',
                              color: 'text.primary',
                              fontWeight: 600,
                              borderWidth: 2,
                              '&:hover': {
                                borderWidth: 2,
                                borderColor: 'primary.main'
                              }
                            }}
                          >
                            {uploadingAvatar ? 'Uploading...' : (avatarFile ? 'Change Photo' : 'Upload Photo')}
                          </Button>
                        </label>
                        {avatarFile && (
                          <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'text.secondary' }}>
                            {avatarFile.name}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Display Name"
                      value={form.name || (googleProfile?.name || '')}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      required
                      fullWidth
                      variant="outlined"
                      InputProps={{ 
                        sx: { borderRadius: 2 } 
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Username"
                      value={form.username}
                      onChange={e => setForm({ ...form, username: e.target.value })}
                      required
                      fullWidth
                      variant="outlined"
                      InputProps={{ 
                        sx: { borderRadius: 2 },
                        startAdornment: <Typography color="text.secondary" sx={{ mr: 0.5 }}>@</Typography>
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Email"
                      type="email"
                      value={form.email || (googleProfile?.email || '')}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      required
                      fullWidth
                      variant="outlined"
                      InputProps={{ 
                        sx: { borderRadius: 2 } 
                      }}
                      helperText="Used for notifications only, never shared"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Bio"
                      value={form.bio}
                      onChange={e => setForm({ ...form, bio: e.target.value })}
                      multiline
                      rows={3}
                      fullWidth
                      variant="outlined"
                      InputProps={{ 
                        sx: { borderRadius: 2 } 
                      }}
                      placeholder="Tell others a bit about yourself..."
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Location (Optional)"
                      value={form.location}
                      onChange={e => setForm({ ...form, location: e.target.value })}
                      fullWidth
                      variant="outlined"
                      InputProps={{ 
                        sx: { borderRadius: 2 } 
                      }}
                      placeholder="City, Country"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Website (Optional)"
                      value={form.website}
                      onChange={e => setForm({ ...form, website: e.target.value })}
                      fullWidth
                      variant="outlined"
                      InputProps={{ 
                        sx: { borderRadius: 2 } 
                      }}
                      placeholder="https://..."
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Twitter Handle (Optional)"
                      value={form.twitter}
                      onChange={e => setForm({ ...form, twitter: e.target.value })}
                      fullWidth
                      variant="outlined"
                      InputProps={{ 
                        sx: { borderRadius: 2 },
                        startAdornment: <Typography color="text.secondary" sx={{ mr: 0.5 }}>@</Typography>
                      }}
                      placeholder="username"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Paper
                      elevation={0}
                      sx={{ 
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'grey.50',
                        border: '1px dashed',
                        borderColor: 'grey.300'
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Switch 
                            checked={form.agree} 
                            onChange={e => setForm({ ...form, agree: e.target.checked })} 
                            color="primary" 
                          />
                        }
                        label={
                          <Typography variant="body2">
                            I agree to the <Link href="#" underline="hover" sx={{ fontWeight: 500 }}>Terms of Service</Link> and <Link href="#" underline="hover" sx={{ fontWeight: 500 }}>Privacy Policy</Link>
                          </Typography>
                        }
                      />
                    </Paper>
                  </Grid>
                </Grid>
                
                <Box mt={4} display="flex" justifyContent="space-between">
                  <Button
                    variant="outlined"
                    onClick={() => setActiveStep(0)}
                    sx={{ 
                      borderRadius: 'full',
                      px: 3,
                      borderWidth: 2,
                      '&:hover': { borderWidth: 2 }
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    endIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <ArrowForwardIcon />}
                    sx={{ 
                      fontWeight: 700, 
                      borderRadius: 'full',
                      px: 3,
                      boxShadow: 2
                    }}
                    disabled={!form.agree || isSubmitting}
                  >
                    {isSubmitting ? "Creating Profile..." : "Complete Sign Up"}
                  </Button>
                </Box>
              </Box>
            )}
            
            {/* Step 3: Success */}
            {activeTab === 0 && activeStep === 2 && (
              <Box textAlign="center" py={3}>
                <Box 
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: 'rgba(16, 185, 129, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 40, color: '#06D6A0' }} />
                </Box>
                
                <Typography variant="h5" gutterBottom fontWeight={800} sx={{ mb: 1 }}>
                  Welcome to crib!
                </Typography>
                
                <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
                  Your profile has been created and you're ready to explore your new decentralized social home.
                </Typography>
                
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  href="/home"
                  endIcon={<ArrowForwardIcon />}
                  sx={{ 
                    fontWeight: 700, 
                    borderRadius: 'full', 
                    px: 4,
                    py: 1.5,
                    boxShadow: 3
                  }}
                >
                  Go to My Home
                </Button>
              </Box>
            )}
            
            {/* Sign In Tab */}
            {activeTab === 1 && (
              <Box>
                <Box 
                  sx={{
                    textAlign: 'center',
                    mb: 5,
                  }}
                >
                  <Typography variant="h5" fontWeight={700} sx={{ mb: 2, fontSize: '1.5rem' }}>
                    Welcome Back!
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7, fontSize: '1.05rem' }}>
                    Sign in is simple with your blockchain wallet - no passwords needed.
                  </Typography>
                </Box>
                
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={(walletLoading || walletConnecting) ? <CircularProgress size={22} color="inherit" /> : <AccountBalanceWalletIcon />}
                  onClick={handleWalletConnect}
                  fullWidth
                  sx={{
                    fontWeight: 700,
                    borderRadius: 3,
                    py: 2,
                    mb: 3,
                    boxShadow: '0 8px 24px rgba(255, 107, 107, 0.3)',
                    fontSize: '1rem',
                    '&:hover': {
                      boxShadow: '0 12px 32px rgba(255, 107, 107, 0.4)'
                    }
                  }}
                  disabled={walletLoading || walletConnecting}
                >
                  {(walletLoading || walletConnecting) ? "Connecting..." : (walletConnected ? "Sign In with Wallet" : "Connect Wallet to Sign In")}
                </Button>

                {isSignedIn && (
                  <Paper
                    elevation={0}
                    sx={{
                      mt: 4,
                      p: 3,
                      borderRadius: 3,
                      bgcolor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid',
                      borderColor: 'rgba(16, 185, 129, 0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ bgcolor: '#06D6A0', width: 32, height: 32 }}>
                        <CheckCircleIcon fontSize="small" />
                      </Avatar>
                      <Typography variant="subtitle2" sx={{ color: '#065F46', fontWeight: 600 }}>
                        Successfully signed in!
                      </Typography>
                    </Box>

                    <Button
                      variant="outlined"
                      color="success"
                      onClick={() => navigate('/home', { replace: true })}
                      endIcon={<ArrowForwardIcon />}
                      sx={{
                        borderRadius: 'full',
                        color: '#06D6A0',
                        borderColor: '#06D6A0',
                        '&:hover': {
                          borderColor: '#059669',
                          bgcolor: 'rgba(16, 185, 129, 0.04)'
                        }
                      }}
                    >
                      Go to Home Feed
                    </Button>
                  </Paper>
                )}
              </Box>
            )}

            <Box mt={4} textAlign="center">
              <Typography variant="caption" color="text.secondary">
                By joining crib, you agree to our <Link href="#" underline="hover" sx={{ fontWeight: 500 }}>Terms of Service</Link> and <Link href="#" underline="hover" sx={{ fontWeight: 500 }}>Privacy Policy</Link>.
              </Typography>
            </Box>
          </Paper>
        </Grid>
        
        {/* Right Column - Information */}
        <Grid item md={5} lg={4} sx={{ display: { xs: 'none', md: 'block' } }}>
          <Box sx={{ color: 'white', p: 4, position: 'relative', zIndex: 1 }}>
            <Box sx={{ mb: 8 }}>
              <Typography 
                variant="h2" 
                fontWeight={900} 
                sx={{ 
                  mb: 3,
                  fontSize: '2.75rem',
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em'
                }}
              >
                Your digital space, your rules
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400, lineHeight: 1.7, fontSize: '1.15rem' }}>
                A social platform that puts you first, respects your privacy, and gives you true ownership.
              </Typography>
            </Box>
            
            {/* Feature Cards */}
            <Grid container spacing={3}>
              {features.map((feature, index) => (
                <Grid item xs={12} key={index}>
                  <Card 
                    sx={{ 
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)', 
                      backdropFilter: 'blur(20px)', 
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 4,
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-6px) translateX(4px)',
                        boxShadow: '0 16px 32px rgba(0, 0, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.08) 100%)'
                      }
                    }}
                  >
                    <CardContent sx={{ p: 3.5 }}>
                      <Box display="flex" alignItems="flex-start" gap={3}>
                        <Box 
                          sx={{ 
                            mt: 0.5, 
                            p: 2,
                            borderRadius: 3,
                            bgcolor: 'rgba(255, 255, 255, 0.15)',
                          }}
                        >
                          {feature.icon}
                        </Box>
                        <Box>
                          <Typography variant="h6" sx={{ color: 'white', fontWeight: 700, mb: 1, fontSize: '1.15rem' }}>
                            {feature.title}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                            {feature.description}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            
            {/* Quote */}
            <Box 
              sx={{ 
                mt: 7, 
                p: 4,
                borderLeft: '5px solid',
                borderColor: 'rgba(255, 107, 107, 0.6)',
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '0 20px 20px 0',
                backdropFilter: 'blur(10px)'
              }}
            >
              <Typography variant="body1" sx={{ fontStyle: 'italic', mb: 2.5, fontSize: '1.05rem', lineHeight: 1.7 }}>
                "Web3 isn't just a technology upgrade; it's about returning ownership and control to users in a digital world that has forgotten its original promise."
              </Typography>
              <Typography variant="subtitle2" sx={{ opacity: 0.75, fontSize: '0.9rem', fontWeight: 500 }}>
                – Vitalik Buterin, Ethereum co-founder
              </Typography>
            </Box>
            
            {/* FAQ Section */}
            <Box mt={8}>
              <Typography variant="h5" fontWeight={800} gutterBottom sx={{ mb: 5, fontSize: '1.5rem' }}>
                Common Questions
              </Typography>
              
              <Grid container spacing={4}>
                <Grid item xs={12}>
                  <Box 
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      bgcolor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.09)',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                      }
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, fontSize: '1.05rem' }}>
                      What is a blockchain wallet?
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, lineHeight: 1.75, fontSize: '0.95rem' }}>
                      A blockchain wallet is your secure digital identity that gives you access to web3 apps without passwords. It stores digital assets and lets you sign in with cryptographic security.
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Box 
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      bgcolor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.09)',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                      }
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, fontSize: '1.05rem' }}>
                      Is my data private?
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, lineHeight: 1.75, fontSize: '0.95rem' }}>
                      Yes! Your personal data is only stored if you explicitly share it. Content you post will be stored on IPFS with references on the blockchain. No data harvesting or tracking.
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Box 
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      bgcolor: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.09)',
                        border: '1px solid rgba(255, 255, 255, 0.15)'
                      }
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5, fontSize: '1.05rem' }}>
                      Do I need cryptocurrency?
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9, lineHeight: 1.75, fontSize: '0.95rem' }}>
                      Basic posting is free. You'll only need some MATIC tokens if you want to mint posts as NFTs or participate in governance voting.
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setNotification({ ...notification, open: false })} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Image Crop Modal */}
      <ImageCropModal
        open={showCropModal}
        onClose={() => setShowCropModal(false)}
        imageSrc={originalImageSrc}
        onCropComplete={handleCropComplete}
        aspectRatioPreset="square"
        title="Crop Profile Avatar"
      />
    </Box>
  );
}
