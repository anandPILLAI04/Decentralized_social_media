import React from "react";
import { 
  Box, 
  Typography, 
  Button, 
  Container, 
  Grid, 
  Card, 
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Divider,
  Link,
  Stack,
  Chip,
  Avatar,
  IconButton
} from "@mui/material";
import { 
  StorageRounded as StorageIcon,
  SecurityRounded as SecurityIcon,
  PeopleAltRounded as PeopleIcon,
  CheckRounded as CheckIcon,
  AccountBalanceWalletRounded as WalletIcon,
  CurrencyExchangeRounded as PaymentsIcon,
  CodeRounded as CodeIcon,
  DevicesRounded as DevicesIcon,
  SmartToyRounded as AIIcon,
  LockRounded as PrivacyIcon,
  ArrowForwardRounded as ArrowIcon,
  Twitter as TwitterIcon,
  Reddit as RedditIcon,
  GitHub as GitHubIcon
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/auth");
  };

  // Feature items
  const features = [
    {
      icon: <WalletIcon fontSize="large" sx={{ color: '#FF6B6B' }} />,
      title: "Own Your Identity",
      description: "Your profile is tied to your blockchain wallet, giving you complete ownership and control over your online presence."
    },
    {
      icon: <StorageIcon fontSize="large" sx={{ color: '#A78BFA' }} />,
      title: "Decentralized Storage",
      description: "All content is stored on IPFS, making it censorship-resistant and truly yours forever."
    },
    {
      icon: <AIIcon fontSize="large" sx={{ color: '#06D6A0' }} />,
      title: "AI-Enhanced Experience",
      description: "Smart content recommendations without compromising your privacy or data ownership."
    },
    {
      icon: <PaymentsIcon fontSize="large" sx={{ color: '#F59E0B' }} />,
      title: "NFT Creation",
      description: "Mint your most valuable content as NFTs and monetize your creativity directly."
    },
    {
      icon: <PeopleIcon fontSize="large" sx={{ color: '#EC4899' }} />,
      title: "Community Governance",
      description: "Participate in platform decisions through our decentralized governance protocol."
    },
    {
      icon: <PrivacyIcon fontSize="large" sx={{ color: '#6366F1' }} />,
      title: "Privacy-First",
      description: "No tracking, no data harvesting, no algorithmic manipulation of your feed."
    }
  ];

  // How it works steps
  const steps = [
    {
      number: "01",
      title: "Connect Wallet",
      description: "Link your MetaMask or other Web3 wallet to create your sovereign digital identity."
    },
    {
      number: "02",
      title: "Create Profile",
      description: "Set up your profile with a username, bio, and avatar - all stored on decentralized networks."
    },
    {
      number: "03",
      title: "Join Communities",
      description: "Find like-minded people who share your interests in our decentralized communities."
    },
    {
      number: "04",
      title: "Own Your Content",
      description: "Post and interact with content that you truly own, with the option to mint special moments as NFTs."
    }
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box 
        sx={{ 
          background: 'white',
          color: 'text.primary',
          pt: { xs: 8, md: 14 },
          pb: { xs: 10, md: 16 },
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative elements */}
        <Box 
          sx={{ 
            position: 'absolute',
            top: '15%',
            right: '5%',
            width: '20vw',
            height: '20vw',
            maxWidth: '300px',
            maxHeight: '300px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.12), rgba(255, 217, 61, 0.12))',
            filter: 'blur(40px)',
            zIndex: 0
          }}
        />
        
        <Box 
          sx={{ 
            position: 'absolute',
            bottom: '10%',
            left: '10%',
            width: '15vw',
            height: '15vw',
            maxWidth: '200px',
            maxHeight: '200px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(6, 214, 160, 0.12), rgba(255, 107, 107, 0.12))',
            filter: 'blur(40px)',
            zIndex: 0
          }}
        />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={{ xs: 6, md: 10 }} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box>
                <Chip 
                  label="Beta Release" 
                  color="primary" 
                  size="small"
                  sx={{ 
                    mb: 3, 
                    borderRadius: 'full',
                    fontWeight: 600,
                    px: 1
                  }} 
                />
                
                <Typography 
                  variant="h1" 
                  component="h1" 
                  sx={{ 
                    fontWeight: 800, 
                    fontSize: { xs: '2.75rem', sm: '3.5rem', md: '4rem' },
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #FF6B6B 0%, #FFD93D 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 3,
                    lineHeight: 1.1
                  }}
                >
                  Your space.<br />Your content.<br />Your crib.
                </Typography>
                
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: 'text.secondary',
                    mb: 5,
                    lineHeight: 1.6,
                    maxWidth: '550px'
                  }}
                >
                  A decentralized social space where you own what you create. Built on blockchain, powered by you, and free from algorithms.
                </Typography>
                
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 8 }}>
                  <Button 
                    variant="contained" 
                    size="large" 
                    onClick={handleGetStarted}
                    endIcon={<ArrowIcon />}
                    sx={{ 
                      borderRadius: 'full', 
                      py: 1.5, 
                      px: 4,
                      fontSize: '1rem',
                      boxShadow: 4
                    }}
                  >
                    Join Crib
                  </Button>
                  
                  <Button 
                    variant="outlined" 
                    size="large"
                    sx={{ 
                      borderRadius: 'full', 
                      py: 1.5,
                      px: 4,
                      fontSize: '1rem',
                      borderWidth: 2,
                      '&:hover': {
                        borderWidth: 2
                      }
                    }}
                  >
                    How It Works
                  </Button>
                </Stack>
                
                {/* Partners/Supported By */}
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
                    BUILT ON
                  </Typography>
                  <Stack direction="row" spacing={3} alignItems="center">
                    <Chip
                      label="Polygon"
                      variant="outlined"
                      sx={{
                        borderRadius: 'full',
                        bgcolor: 'rgba(130, 71, 229, 0.08)',
                        borderColor: 'rgba(130, 71, 229, 0.3)',
                        color: '#8247E5',
                        fontWeight: 600,
                        '&:hover': { 
                          bgcolor: 'rgba(130, 71, 229, 0.12)',
                        }
                      }}
                    />
                    <Chip
                      label="IPFS"
                      variant="outlined"
                      sx={{
                        borderRadius: 'full',
                        bgcolor: 'rgba(65, 174, 255, 0.08)',
                        borderColor: 'rgba(65, 174, 255, 0.3)',
                        color: '#41AEFF',
                        fontWeight: 600,
                        '&:hover': { 
                          bgcolor: 'rgba(65, 174, 255, 0.12)',
                        }
                      }}
                    />
                    <Chip
                      label="Hardhat"
                      variant="outlined"
                      sx={{
                        borderRadius: 'full',
                        bgcolor: 'rgba(255, 199, 0, 0.08)',
                        borderColor: 'rgba(255, 199, 0, 0.3)',
                        color: '#FFC700',
                        fontWeight: 600,
                        '&:hover': { 
                          bgcolor: 'rgba(255, 199, 0, 0.12)',
                        }
                      }}
                    />
                  </Stack>
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6} sx={{ position: 'relative' }}>
              <Box 
                sx={{ 
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  justifyContent: 'center',
                  minHeight: 500
                }}
              >
                {/* Hero UI mockup */}
                <Box 
                  sx={{ 
                    width: '100%',
                    maxWidth: 600,
                    minHeight: 500,
                    borderRadius: '24px',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
                    overflow: 'hidden',
                    position: 'relative',
                    background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                    border: '2px solid',
                    borderColor: 'rgba(255, 107, 107, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  {/* Decorative mockup content */}
                  <Box 
                    sx={{ 
                      width: '100%',
                      height: '100%',
                      p: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3
                    }}
                  >
                    {/* Mock Header */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 2, borderBottom: '2px solid rgba(0,0,0,0.05)' }}>
                      <Box 
                        sx={{ 
                          width: 48, 
                          height: 48, 
                          borderRadius: '50%', 
                          background: 'linear-gradient(135deg, #FF6B6B, #FFD93D)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1.5rem',
                          color: 'white'
                        }}
                      >
                        C
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ height: 12, bgcolor: 'rgba(0,0,0,0.08)', borderRadius: 1, width: '40%', mb: 0.5 }} />
                        <Box sx={{ height: 8, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1, width: '60%' }} />
                      </Box>
                    </Box>

                    {/* Mock Post 1 */}
                    <Box sx={{ bgcolor: 'white', borderRadius: 3, p: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(167, 139, 250, 0.3)' }} />
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ height: 10, bgcolor: 'rgba(0,0,0,0.08)', borderRadius: 1, width: '30%', mb: 0.8 }} />
                          <Box sx={{ height: 8, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1, width: '20%' }} />
                        </Box>
                      </Box>
                      <Box sx={{ height: 8, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1, width: '90%', mb: 0.8 }} />
                      <Box sx={{ height: 8, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1, width: '75%' }} />
                    </Box>

                    {/* Mock Post 2 */}
                    <Box sx={{ bgcolor: 'white', borderRadius: 3, p: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(6, 214, 160, 0.3)' }} />
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ height: 10, bgcolor: 'rgba(0,0,0,0.08)', borderRadius: 1, width: '35%', mb: 0.8 }} />
                          <Box sx={{ height: 8, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1, width: '25%' }} />
                        </Box>
                      </Box>
                      <Box sx={{ height: 100, bgcolor: 'rgba(255, 107, 107, 0.1)', borderRadius: 2, mb: 1.5 }} />
                      <Box sx={{ height: 8, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1, width: '85%' }} />
                    </Box>

                    {/* Mock Post 3 */}
                    <Box sx={{ bgcolor: 'white', borderRadius: 3, p: 2.5, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(255, 107, 107, 0.3)' }} />
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ height: 10, bgcolor: 'rgba(0,0,0,0.08)', borderRadius: 1, width: '28%', mb: 0.8 }} />
                          <Box sx={{ height: 8, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1, width: '70%', mb: 0.8 }} />
                          <Box sx={{ height: 8, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1, width: '60%' }} />
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Box>
                
                {/* Floating animated elements */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: '0%',
                    right: '5%',
                    background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.95), rgba(255, 217, 61, 0.95))',
                    backdropFilter: 'blur(10px)',
                    padding: 2.5,
                    borderRadius: 4,
                    boxShadow: '0 12px 40px rgba(255, 107, 107, 0.3)',
                    width: 180,
                    display: { xs: 'none', md: 'block' },
                    animation: 'float 3s ease-in-out infinite',
                    '@keyframes float': {
                      '0%, 100%': { transform: 'translateY(0px)' },
                      '50%': { transform: 'translateY(-20px)' }
                    }
                  }}
                >
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box 
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 'full',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'white',
                          color: '#FF6B6B',
                          fontWeight: 'bold',
                          fontSize: '1rem',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                      >
                        🚀
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.2, color: 'white' }}>
                          Live Activity
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)' }}>
                          Real-time updates
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', color: 'white', fontWeight: 500 }}>
                      12 creators joined today ✨
                    </Typography>
                  </Stack>
                </Box>
                
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: '5%',
                    left: '5%',
                    background: 'white',
                    padding: 2.5,
                    borderRadius: 4,
                    boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
                    width: 160,
                    display: { xs: 'none', md: 'block' },
                    border: '2px solid',
                    borderColor: 'rgba(167, 139, 250, 0.3)',
                    animation: 'pulse 2s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { transform: 'scale(1)' },
                      '50%': { transform: 'scale(1.05)' }
                    }
                  }}
                >
                  <Stack spacing={1} alignItems="center">
                    <Box 
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #A78BFA 0%, #EC4899 100%)',
                        fontSize: '1.5rem'
                      }}
                    >
                      🔒
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, textAlign: 'center' }}>
                      Fully Encrypted
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontSize: '0.7rem' }}>
                      Your data, your control
                    </Typography>
                  </Stack>
                </Box>
                
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    right: '0%',
                    transform: 'translateY(-50%)',
                    background: 'linear-gradient(135deg, rgba(6, 214, 160, 0.9), rgba(167, 139, 250, 0.9))',
                    backdropFilter: 'blur(10px)',
                    padding: 2,
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(6, 214, 160, 0.3)',
                    width: 140,
                    display: { xs: 'none', md: 'block' },
                    animation: 'slideIn 4s ease-in-out infinite',
                    '@keyframes slideIn': {
                      '0%, 100%': { transform: 'translateY(-50%) translateX(0px)' },
                      '50%': { transform: 'translateY(-50%) translateX(-15px)' }
                    }
                  }}
                >
                  <Stack spacing={0.5} alignItems="center">
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'white' }}>
                      ∞
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'white' }}>
                      Limitless
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
                      No storage caps
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ 
        py: { xs: 8, md: 12 },
        background: 'linear-gradient(180deg, white 0%, #F9FAFB 100%)'
      }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={8}>
            <Typography 
              variant="subtitle1" 
              component="span"
              sx={{ 
                color: 'primary.main', 
                fontWeight: 600,
                px: 2,
                py: 1,
                borderRadius: 'full',
                bgcolor: 'rgba(255, 107, 107, 0.1)',
                display: 'inline-block',
                mb: 2
              }}
            >
              WHY CHOOSE CRIB
            </Typography>
            <Typography 
              variant="h2" 
              component="h2" 
              fontWeight={800} 
              sx={{ 
                mb: 3,
                fontSize: { xs: '2rem', md: '3rem' },
                letterSpacing: '-0.02em'
              }}
            >
              A social platform that puts <Box component="span" sx={{ 
                borderBottom: '6px solid', 
                borderColor: 'rgba(16, 185, 129, 0.3)', 
                borderRadius: '2px',
                display: 'inline' 
              }}>you first</Box>
            </Typography>
            <Typography 
              variant="h6" 
              color="text.secondary" 
              sx={{ 
                maxWidth: 600, 
                mx: 'auto',
                fontWeight: 'normal'
              }}
            >
              Crib combines the best of web3 technology with intuitive design to create a social experience that respects your privacy and ownership.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card 
                  elevation={0}
                  sx={{ 
                    height: '100%', 
                    borderRadius: 4,
                    transition: 'all 0.3s ease',
                    border: '1px solid',
                    borderColor: 'grey.100',
                    p: 3,
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: theme => theme.shadows[2],
                      borderColor: 'transparent'
                    }
                  }}
                >
                  <CardContent sx={{ p: 0 }}>
                    <Box 
                      sx={{
                        display: 'inline-flex',
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'grey.50',
                        mb: 2
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography 
                      variant="h5" 
                      component="h3" 
                      fontWeight={700} 
                      gutterBottom
                      sx={{ fontSize: '1.25rem' }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* How It Works Section */}
      <Box sx={{ backgroundColor: 'white', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={8} alignItems="center">
            <Grid item xs={12} md={5}>
              <Box>
                <Typography 
                  variant="subtitle1" 
                  component="span"
                  sx={{ 
                    color: 'primary.main', 
                    fontWeight: 600,
                    px: 2,
                    py: 1,
                    borderRadius: 'full',
                    bgcolor: 'rgba(255, 107, 107, 0.1)',
                    display: 'inline-block',
                    mb: 2
                  }}
                >
                  GETTING STARTED
                </Typography>
                
                <Typography 
                  variant="h2" 
                  component="h2" 
                  fontWeight={800} 
                  sx={{ 
                    mb: 3,
                    fontSize: { xs: '2rem', md: '3rem' },
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2
                  }}
                >
                  Start your journey in just minutes
                </Typography>
                
                <Typography 
                  variant="body1" 
                  color="text.secondary" 
                  sx={{ 
                    mb: 4,
                    fontSize: '1.125rem',
                    lineHeight: 1.7
                  }}
                >
                  Web3 social networking made simple. No complex setup, no technical knowledge required. Just connect and start creating.
                </Typography>
                
                <Button 
                  variant="contained" 
                  size="large" 
                  onClick={handleGetStarted}
                  endIcon={<ArrowIcon />}
                  sx={{ 
                    borderRadius: 'full', 
                    fontWeight: 600, 
                    py: 1.5, 
                    px: 4,
                    boxShadow: 3
                  }}
                >
                  Create Your Account
                </Button>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={7}>
              <Box 
                sx={{ 
                  bgcolor: 'grey.50',
                  borderRadius: 4,
                  p: { xs: 3, md: 5 },
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)',
                  border: '1px solid',
                  borderColor: 'grey.100',
                }}
              >
                <Grid container spacing={3}>
                  {steps.map((step, index) => (
                    <Grid item xs={12} sm={6} key={index}>
                      <Stack direction="row" spacing={3} alignItems="flex-start">
                        <Box 
                          sx={{ 
                            width: 40,
                            height: 40,
                            borderRadius: 'full',
                            bgcolor: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            border: '2px solid',
                            borderColor: 'primary.main',
                            color: 'primary.main',
                            flexShrink: 0,
                            boxShadow: '0 4px 12px rgba(255, 107, 107, 0.15)'
                          }}
                        >
                          {step.number}
                        </Box>
                        
                        <Box>
                          <Typography variant="h6" component="h3" fontWeight={700} gutterBottom>
                            {step.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                            {step.description}
                          </Typography>
                        </Box>
                      </Stack>
                      
                      {/* Connecting line except for last item */}
                      {index < steps.length - 1 && (index % 2 === 0) && (
                        <Box 
                          sx={{ 
                            height: 20, 
                            borderLeft: '2px dashed', 
                            borderColor: 'grey.300',
                            ml: 2.5,
                            mt: 1,
                            display: { xs: 'none', sm: 'block' }
                          }}
                        />
                      )}
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Comparison Section */}
      <Box sx={{ backgroundColor: 'grey.50', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box textAlign="center" mb={8}>
            <Typography 
              variant="subtitle1" 
              component="span"
              sx={{ 
                color: 'primary.main', 
                fontWeight: 600,
                px: 2,
                py: 1,
                borderRadius: 'full',
                bgcolor: 'rgba(255, 107, 107, 0.1)',
                display: 'inline-block',
                mb: 2
              }}
            >
              THE DIFFERENCE
            </Typography>
            
            <Typography 
              variant="h2" 
              component="h2" 
              fontWeight={800} 
              sx={{ 
                mb: 3,
                fontSize: { xs: '2rem', md: '3rem' },
                letterSpacing: '-0.02em'
              }}
            >
              Why <Box component="span" sx={{ color: 'primary.main' }}>Crib</Box> beats traditional social
            </Typography>
            
            <Typography 
              variant="h6" 
              color="text.secondary" 
              sx={{ 
                maxWidth: 700, 
                mx: 'auto',
                fontWeight: 'normal'
              }}
            >
              See how our decentralized approach creates a more fair, private, and user-owned social experience.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <Paper 
                elevation={0}
                sx={{ 
                  borderRadius: 4, 
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'primary.light',
                  height: '100%'
                }}
              >
                <Box 
                  sx={{ 
                    bgcolor: 'primary.main', 
                    py: 2, 
                    px: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                  }}
                >
                  <Box 
                    sx={{ 
                      bgcolor: 'white',
                      borderRadius: 'full',
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'primary.main'
                    }}
                  >
                    <Box 
                      component="img" 
                      src="https://i.imgur.com/NcceIhq.png" 
                      alt="Crib Logo"
                      sx={{ width: 22, height: 22 }}
                    />
                  </Box>
                  <Typography variant="h6" component="h3" fontWeight={700} color="white">
                    Crib
                  </Typography>
                </Box>
                
                <CardContent sx={{ p: 0 }}>
                  <List sx={{ py: 0 }}>
                    {[
                      "You own 100% of your content and data",
                      "Truly resistant to censorship via IPFS",
                      "No algorithmic manipulation of your feed",
                      "Community-driven governance via smart contracts",
                      "Direct monetization through NFTs",
                      "Zero data harvesting or tracking"
                    ].map((item, i) => (
                      <ListItem 
                        key={i} 
                        sx={{ 
                          py: 2, 
                          borderBottom: i !== 5 ? '1px solid' : 'none',
                          borderColor: 'grey.100'
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <CheckIcon sx={{ color: '#06D6A0' }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary={item} 
                          primaryTypographyProps={{
                            fontWeight: 500
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Paper 
                elevation={0}
                sx={{ 
                  borderRadius: 4, 
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'grey.200',
                  height: '100%'
                }}
              >
                <Box 
                  sx={{ 
                    bgcolor: 'grey.800', 
                    py: 2, 
                    px: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                  }}
                >
                  <Box 
                    sx={{ 
                      bgcolor: 'white',
                      borderRadius: 'full',
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <DevicesIcon sx={{ color: 'grey.800', fontSize: 20 }} />
                  </Box>
                  <Typography variant="h6" component="h3" fontWeight={700} color="white">
                    Traditional Social
                  </Typography>
                </Box>
                
                <CardContent sx={{ p: 0, bgcolor: 'grey.50' }}>
                  <List sx={{ py: 0 }}>
                    {[
                      "Platform owns your content rights",
                      "Content can be removed anytime",
                      "Algorithms control what you see",
                      "No say in platform decisions",
                      "Limited monetization controlled by platform",
                      "Your data is the product being sold"
                    ].map((item, i) => (
                      <ListItem 
                        key={i} 
                        sx={{ 
                          py: 2, 
                          borderBottom: i !== 5 ? '1px solid' : 'none',
                          borderColor: 'grey.200'
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <DevicesIcon sx={{ color: 'grey.400' }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary={item} 
                          primaryTypographyProps={{
                            color: 'text.secondary',
                            fontWeight: 500
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ 
        py: { xs: 10, md: 16 },
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #FF6B6B 0%, #FFD93D 100%)',
      }}>
        {/* Decorative elements */}
        <Box 
          sx={{ 
            position: 'absolute',
            top: '10%',
            left: '5%',
            width: '20vw',
            height: '20vw',
            maxWidth: '300px',
            maxHeight: '300px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            filter: 'blur(60px)',
            zIndex: 0
          }}
        />
        
        <Box 
          sx={{ 
            position: 'absolute',
            bottom: '10%',
            right: '10%',
            width: '15vw',
            height: '15vw',
            maxWidth: '200px',
            maxHeight: '200px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            filter: 'blur(60px)',
            zIndex: 0
          }}
        />
      
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container justifyContent="center">
            <Grid item xs={12} md={10}>
              <Box textAlign="center">
                <Typography 
                  variant="h2" 
                  component="h2" 
                  fontWeight={800} 
                  gutterBottom
                  color="white"
                  sx={{ 
                    fontSize: { xs: '2rem', sm: '2.5rem', md: '3.5rem' },
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2
                  }}
                >
                  Ready to claim your digital space?
                </Typography>
                
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 5, 
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: { xs: '1rem', md: '1.25rem' },
                    maxWidth: '700px',
                    mx: 'auto'
                  }}
                >
                  Join thousands of creators and builders crafting the future of social networking. Your crib awaits.
                </Typography>
                
                <Button 
                  variant="contained" 
                  size="large"
                  onClick={handleGetStarted}
                  sx={{ 
                    borderRadius: 'full', 
                    fontWeight: 700, 
                    py: 2, 
                    px: 5,
                    fontSize: '1.1rem',
                    bgcolor: 'white',
                    color: 'primary.main',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                    '&:hover': {
                      bgcolor: 'white',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
                    }
                  }}
                >
                  Get Started for Free
                </Button>
                
                <Typography 
                  variant="caption" 
                  sx={{ 
                    display: 'block', 
                    mt: 3, 
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontWeight: 500
                  }}
                >
                  No credit card required • Free NFT for early adopters
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ backgroundColor: 'white', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Typography 
                variant="h5" 
                fontWeight={800}
                sx={{ 
                  mb: 2,
                  background: 'linear-gradient(135deg, #FF6B6B 0%, #FFD93D 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                crib
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph sx={{ maxWidth: 300 }}>
                The future of social networking—decentralized, secure, and owned by its community.
              </Typography>
              
              <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
                <IconButton 
                  size="small" 
                  sx={{ 
                    color: 'grey.700',
                    '&:hover': { color: 'primary.main' } 
                  }}
                >
                  <TwitterIcon fontSize="small" />
                </IconButton>
                <IconButton 
                  size="small" 
                  sx={{ 
                    color: 'grey.700',
                    '&:hover': { color: 'primary.main' } 
                  }}
                >
                  <RedditIcon fontSize="small" />
                </IconButton>
                <IconButton 
                  size="small" 
                  sx={{ 
                    color: 'grey.700',
                    '&:hover': { color: 'primary.main' } 
                  }}
                >
                  <GitHubIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Grid>
            
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom color="text.primary">
                Product
              </Typography>
              <List dense disablePadding>
                {['Features', 'Security', 'Roadmap', 'NFT Integration'].map((item, i) => (
                  <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                    <Link 
                      href="#" 
                      color="text.secondary" 
                      underline="hover"
                      sx={{ 
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                    >
                      {item}
                    </Link>
                  </ListItem>
                ))}
              </List>
            </Grid>
            
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom color="text.primary">
                Resources
              </Typography>
              <List dense disablePadding>
                {['Documentation', 'Whitepaper', 'Blog', 'Tutorials'].map((item, i) => (
                  <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                    <Link 
                      href="#" 
                      color="text.secondary" 
                      underline="hover"
                      sx={{ 
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                    >
                      {item}
                    </Link>
                  </ListItem>
                ))}
              </List>
            </Grid>
            
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom color="text.primary">
                Community
              </Typography>
              <List dense disablePadding>
                {['Discord', 'Twitter', 'Telegram', 'GitHub'].map((item, i) => (
                  <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                    <Link 
                      href="#" 
                      color="text.secondary" 
                      underline="hover"
                      sx={{ 
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                    >
                      {item}
                    </Link>
                  </ListItem>
                ))}
              </List>
            </Grid>
            
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom color="text.primary">
                Legal
              </Typography>
              <List dense disablePadding>
                {['Terms of Service', 'Privacy Policy', 'Cookie Policy', 'Disclaimer'].map((item, i) => (
                  <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                    <Link 
                      href="#" 
                      color="text.secondary" 
                      underline="hover"
                      sx={{ 
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                    >
                      {item}
                    </Link>
                  </ListItem>
                ))}
              </List>
            </Grid>
          </Grid>

          <Divider sx={{ my: 4 }} />
          
          <Box 
            sx={{
              display: 'flex', 
              justifyContent: { xs: 'center', md: 'space-between' },
              alignItems: 'center',
              flexDirection: { xs: 'column', md: 'row' },
              gap: { xs: 2, md: 0 }
            }}
          >
            <Typography variant="body2" color="text.secondary">
              © 2023 Crib Social. All rights reserved.
            </Typography>
            
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                color: 'text.secondary'
              }}
            >
              <Chip
                size="small"
                label="Polygon Network"
                sx={{
                  borderRadius: 'full',
                  height: 24,
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(130, 71, 229, 0.08)',
                  color: '#8247E5',
                  fontWeight: 600,
                }}
              />
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
