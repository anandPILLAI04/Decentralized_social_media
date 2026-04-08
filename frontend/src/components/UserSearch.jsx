import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField,
  InputAdornment,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Box,
  CircularProgress,
  Popper,
  ClickAwayListener
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { searchUsers } from '../services/apiService';

const UserSearch = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
        setOpen(false);
      }
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearch = async (query) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setOpen(false);
      return;
    }

    try {
      setLoading(true);
      const response = await searchUsers(query);
      if (response.success) {
        setSearchResults(response.users || []);
        setOpen(response.users.length > 0);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (address) => {
    setSearchQuery('');
    setSearchResults([]);
    setOpen(false);
    navigate(`/profile/${address}`);
  };

  const handleClickAway = () => {
    setOpen(false);
  };

  const getAvatarUrl = (user) => {
    return user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.walletAddress}`;  
  };

  const getUserDisplay = (user) => {
    return user.displayName || user.username || `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`;
  };

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', width: { xs: '100%', md: 300 } }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setAnchorEl(e.currentTarget);
          }}
          onFocus={(e) => {
            setAnchorEl(e.currentTarget);
            if (searchResults.length > 0) {
              setOpen(true);
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: loading && (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 'full',
              bgcolor: 'background.paper',
              '&:hover': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.light',
                }
              }
            }
          }}
        />

        <Popper
          open={open}
          anchorEl={anchorEl}
          placement="bottom-start"
          sx={{ width: anchorEl ? anchorEl.clientWidth : 300, zIndex: 1300 }}
        >
          <Paper 
            elevation={8}
            sx={{ 
              mt: 1, 
              maxHeight: 400, 
              overflow: 'auto',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'grey.200'
            }}
          >
            {searchResults.length === 0 && searchQuery.trim().length > 0 && !loading && (
              <Box p={3} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  No users found
                </Typography>
              </Box>
            )}
            
            <List sx={{ py: 0 }}>
              {searchResults.map((user, index) => (
                <ListItem
                  key={user.walletAddress}
                  button
                  onClick={() => handleUserClick(user.walletAddress)}
                  sx={{
                    borderBottom: index < searchResults.length - 1 ? '1px solid' : 'none',
                    borderColor: 'grey.100',
                    '&:hover': {
                      bgcolor: 'primary.light',
                      '& .MuiListItemText-primary': {
                        color: 'primary.main'
                      }
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar 
                      src={getAvatarUrl(user)}
                      sx={{ 
                        width: 40, 
                        height: 40,
                        border: '2px solid',
                        borderColor: 'grey.100'
                      }}
                    >
                      {getUserDisplay(user)[0]?.toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2" fontWeight={600}>
                        {getUserDisplay(user)}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          @{user.username}
                        </Typography>
                        {user.bio && (
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            display="block"
                            sx={{ 
                              mt: 0.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {user.bio}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" display="block">
                          {user.followersCount || 0} followers
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default UserSearch;
