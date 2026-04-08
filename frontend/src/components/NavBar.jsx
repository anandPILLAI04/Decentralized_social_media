import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { Avatar, Chip, IconButton, Menu, MenuItem, Divider } from "@mui/material";
import { getUserProfile } from "../services/apiService";
import { getUserProfile as getSafeUserProfile, setItem } from '../utils/safeStorage';
import UserSearch from "./UserSearch";
import NotificationBell from "./NotificationBell";

const navLinks = [
  { label: "Home", path: "/home", icon: <HomeRoundedIcon /> },
  { label: "Profile", path: "/profile", icon: <PersonRoundedIcon /> },
  { label: "Create", path: "/create", icon: <AddCircleRoundedIcon /> },
  { label: "Governance", path: "/governance", icon: <GavelRoundedIcon /> },
];

export default function NavBar({ walletAddress, onWalletConnect, onLogout, connecting }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  useEffect(() => {
    if (walletAddress) {
      loadUserProfile();
    }
  }, [walletAddress]);

  const loadUserProfile = async () => {
    try {
      const savedProfile = getSafeUserProfile();
      if (savedProfile) {
        setUserProfile(savedProfile);
      }
      
      // Also try to fetch from API
      const response = await getUserProfile(walletAddress);
      if (response && response.user) {
        setUserProfile(response.user);
        setItem('userProfile', response.user);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleMenuClose();
    navigate('/profile');
  };

  const handleLogoutClick = () => {
    handleMenuClose();
    if (onLogout) {
      onLogout();
    }
    navigate('/');
  };

  const displayName = userProfile?.displayName || userProfile?.username || walletAddress?.slice(0, 6) + '...' + walletAddress?.slice(-4);
  const avatarUrl = userProfile?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${walletAddress}`;  

  return (
    <AppBar 
      position="sticky" 
      elevation={0}
      sx={{
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid',
        borderColor: 'grey.100',
      }}
    >
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        {/* Logo and Brand */}
        <Box display="flex" alignItems="center">
          <Typography 
            variant="h5" 
            component={Link} 
            to="/home"
            sx={{ 
              fontWeight: 800, 
              background: 'linear-gradient(135deg, #FF6B6B 0%, #FFD93D 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textDecoration: 'none',
              letterSpacing: '-0.025em',
            }}
          >
            crib
          </Typography>
        </Box>

        {/* Search Bar */}
        <Box sx={{ flex: 1, maxWidth: 400, mx: 2, display: { xs: 'none', md: 'block' } }}>
          <UserSearch />
        </Box>

        {/* Notification Bell */}
        {walletAddress && (
          <NotificationBell userAddress={walletAddress} />
        )}

        {/* Navigation Links */}
        <Box 
          sx={{ 
            display: 'flex', 
            gap: 1,
            bgcolor: 'grey.50',
            borderRadius: 'full',
            p: 0.5,
          }}
        >
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Button
                key={link.path}
                component={Link}
                to={link.path}
                startIcon={link.icon}
                sx={{
                  px: 2,
                  py: 1,
                  color: isActive ? 'primary.main' : 'text.secondary',
                  bgcolor: isActive ? 'white' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                  borderRadius: 'full',
                  boxShadow: isActive ? 1 : 0,
                  '&:hover': {
                    bgcolor: isActive ? 'white' : 'grey.100',
                  }
                }}
              >
                {link.label}
              </Button>
            );
          })}
        </Box>

        {/* User Profile / Wallet Button */}
        <Box>
          {walletAddress ? (
            <>
              <Button 
                onClick={handleMenuOpen}
                variant="outlined" 
                color="inherit"
                startIcon={
                  <Avatar 
                    src={avatarUrl} 
                    sx={{ width: 32, height: 32 }} 
                  />
                }
                sx={{ 
                  borderRadius: 'full',
                  fontWeight: 600,
                  px: 2.5,
                  py: 1,
                  borderColor: 'grey.200',
                  color: 'text.primary',
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    borderColor: 'primary.main',
                    bgcolor: 'rgba(255, 107, 107, 0.05)'
                  },
                  display: 'flex',
                  alignItems: 'center',
                  textTransform: 'none',
                  gap: 1,
                }}
              >
                {displayName}
              </Button>
              
              {/* User Menu */}
              <Menu
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                sx={{
                  mt: 1,
                  '& .MuiPaper-root': {
                    borderRadius: 2,
                    minWidth: 200,
                  }
                }}
              >
                <MenuItem onClick={handleProfileClick}>
                  <PersonRoundedIcon sx={{ mr: 1 }} fontSize="small" />
                  View Profile
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogoutClick} sx={{ color: 'error.main' }}>
                  <LogoutRoundedIcon sx={{ mr: 1 }} fontSize="small" />
                  Logout
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={onWalletConnect}
              disabled={connecting}
              sx={{ 
                borderRadius: 'full',
                fontWeight: 600,
                px: 3,
                py: 1.25,
                boxShadow: 3,
                '&:hover': {
                  boxShadow: 4,
                }
              }}
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
