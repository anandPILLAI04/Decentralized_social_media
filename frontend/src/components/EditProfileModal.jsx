import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Avatar,
  IconButton,
  CircularProgress,
  Alert,
  Typography,
  Grid
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CloseIcon from '@mui/icons-material/Close';
import { updateUserProfile, uploadAvatar } from '../services/apiService';

const EditProfileModal = ({ open, onClose, user, onProfileUpdated }) => {
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    username: user?.username || '',
    bio: user?.bio || '',
    email: user?.email || '',
    location: user?.location || '',
    website: user?.website || '',
    twitter: user?.twitter || ''
  });
  
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [uploading, setUploading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      setAvatarFile(file);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile || !user?.walletAddress) {
      return null;
    }
    
    try {
      setUploadingAvatar(true);
      setError(null);
      
      console.log('📸 Uploading new avatar...');
      const result = await uploadAvatar(user.walletAddress, avatarFile);
      
      if (result.success) {
        console.log('✅ Avatar uploaded:', result);
        setSuccess(true);
        return result;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      setError('Failed to upload avatar. Please try again.');
      return null;
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      let updates = { ...formData };

      // Upload avatar first if selected
      if (avatarFile) {
        console.log('📸 Uploading avatar before profile update...');
        const avatarResult = await handleUploadAvatar();
        if (avatarResult) {
          updates.avatar = avatarResult.avatar;
          updates.avatarIpfsHash = avatarResult.ipfsHash;
        }
      }

      // Update profile
      console.log('📝 Updating profile...');
      const result = await updateUserProfile(user.walletAddress, updates);

      if (result.user) {
        console.log('✅ Profile updated successfully');
        setSuccess(true);
        
        // Update localStorage
        localStorage.setItem('userProfile', JSON.stringify(result.user));
        
        // Notify parent component
        if (onProfileUpdated) {
          onProfileUpdated(result.user);
        }

        // Close modal after 1 second
        setTimeout(() => {
          onClose();
          // Reload page to reflect changes
          window.location.reload();
        }, 1000);
      } else {
        throw new Error('Update failed');
      }
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.error || 'Failed to update profile. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        pb: 1, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid',
        borderColor: 'grey.200'
      }}>
        <Typography variant="h6" fontWeight={700}>
          Edit Profile
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Profile updated successfully! Refreshing...
            </Alert>
          )}

          {/* Avatar Upload Section */}
          <Box mb={3} textAlign="center">
            <Typography variant="subtitle2" fontWeight={600} mb={2}>
              Profile Picture
            </Typography>
            <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
              <Avatar
                src={avatarPreview || user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.walletAddress}`}
                sx={{
                  width: 120,
                  height: 120,
                  border: '4px solid',
                  borderColor: 'primary.light',
                  boxShadow: 3
                }}
              />
              <Box>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="avatar-upload-edit"
                  type="file"
                  onChange={handleAvatarChange}
                />
                <label htmlFor="avatar-upload-edit">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={uploadingAvatar ? <CircularProgress size={20} /> : <PhotoCameraIcon />}
                    disabled={uploadingAvatar}
                    sx={{ 
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      borderWidth: 2,
                      '&:hover': {
                        borderWidth: 2
                      }
                    }}
                  >
                    {uploadingAvatar ? 'Uploading...' : (avatarFile ? 'Change Photo' : 'Upload New Photo')}
                  </Button>
                </label>
                {avatarFile && (
                  <Typography variant="caption" display="block" mt={1} color="text.secondary">
                    {avatarFile.name} ({(avatarFile.size / 1024).toFixed(0)} KB)
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>

          <Grid container spacing={2.5}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Display Name"
                name="displayName"
                value={formData.displayName}
                onChange={handleInputChange}
                variant="outlined"
                InputProps={{ sx: { borderRadius: 2 } }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                variant="outlined"
                InputProps={{ 
                  sx: { borderRadius: 2 },
                  startAdornment: <Typography color="text.secondary" mr={0.5}>@</Typography>
                }}
                helperText="Changing username may affect your profile URL"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                multiline
                rows={3}
                variant="outlined"
                InputProps={{ sx: { borderRadius: 2 } }}
                placeholder="Tell others about yourself..."
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                variant="outlined"
                InputProps={{ sx: { borderRadius: 2 } }}
                helperText="Used for notifications only, never shared"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                variant="outlined"
                InputProps={{ sx: { borderRadius: 2 } }}
                placeholder="City, Country"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Website"
                name="website"
                type="url"
                value={formData.website}
                onChange={handleInputChange}
                variant="outlined"
                InputProps={{ sx: { borderRadius: 2 } }}
                placeholder="https://..."
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Twitter Handle"
                name="twitter"
                value={formData.twitter}
                onChange={handleInputChange}
                variant="outlined"
                InputProps={{ 
                  sx: { borderRadius: 2 },
                  startAdornment: <Typography color="text.secondary" mr={0.5}>@</Typography>
                }}
                placeholder="username"
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        px: 3, 
        py: 2.5, 
        borderTop: '1px solid', 
        borderColor: 'grey.200' 
      }}>
        <Button 
          onClick={onClose} 
          disabled={uploading}
          sx={{ 
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600
          }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          variant="contained" 
          disabled={uploading}
          startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : null}
          sx={{ 
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 700,
            px: 3
          }}
        >
          {uploading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditProfileModal;
