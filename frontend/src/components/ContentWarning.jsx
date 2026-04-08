import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Warning,
  Block,
  VideoLibrary,
  Image as ImageIcon,
  Close
} from '@mui/icons-material';

const ContentWarning = ({ 
  children, 
  warning, 
  analysisResult, 
  userPreferences = {},
  onUserPreferenceChange 
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const theme = useTheme();

  // If no warning or user has opted to always show content
  if (!warning || userPreferences.showSensitiveContent) {
    return children;
  }

  // If user has opted to hide sensitive content
  if (userPreferences.hideSensitiveContent) {
    return (
      <Card 
        sx={{ 
          backgroundColor: alpha(theme.palette.error.main, 0.1),
          border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
          borderRadius: 2
        }}
      >
        <CardContent sx={{ textAlign: 'center', p: 3 }}>
          <Block sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" color="error.main" gutterBottom>
            Content Hidden
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This content has been hidden based on your preferences.
          </Typography>
          <Button
            variant="outlined"
            size="small"
            sx={{ mt: 2 }}
            onClick={() => setShowWarningDialog(true)}
          >
            Change Settings
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getBlurStyle = () => {
    const blurValues = {
      light: '10px',
      medium: '15px',
      heavy: '20px'
    };
    return {
      filter: !isRevealed ? `blur(${blurValues[warning.blurLevel] || '10px'})` : 'none',
      transition: 'filter 0.3s ease-in-out',
      cursor: !isRevealed ? 'pointer' : 'default'
    };
  };

  const getWarningIcon = () => {
    switch (warning.type) {
      case 'adult_content':
        return '🔞';
      case 'violent_content':
        return '⚠️';
      case 'video_content':
        return '📹';
      default:
        return '⚠️';
    }
  };

  const handleRevealContent = () => {
    if (!isRevealed) {
      setShowWarningDialog(true);
    } else {
      setIsRevealed(false);
    }
  };

  const confirmReveal = () => {
    setIsRevealed(true);
    setShowWarningDialog(false);
  };

  const getReasonChips = () => {
    const reasonLabels = {
      explicit_content: { label: 'Explicit Content', color: 'error' },
      violence: { label: 'Violence', color: 'warning' },
      video_content: { label: 'Video Content', color: 'info' },
      analysis_failed: { label: 'Unverified', color: 'default' }
    };

    return analysisResult?.reasons?.map(reason => {
      const config = reasonLabels[reason] || { label: reason, color: 'default' };
      return (
        <Chip
          key={reason}
          label={config.label}
          color={config.color}
          size="small"
          sx={{ mr: 1, mb: 1 }}
        />
      );
    });
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Content with blur overlay */}
      <Box 
        sx={getBlurStyle()}
        onClick={handleRevealContent}
      >
        {children}
      </Box>

      {/* Warning overlay */}
      {!isRevealed && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(theme.palette.background.paper, 0.9),
            backdropFilter: 'blur(2px)',
            borderRadius: 1,
            cursor: 'pointer',
            transition: 'opacity 0.3s ease-in-out',
            '&:hover': {
              backgroundColor: alpha(theme.palette.background.paper, 0.95)
            }
          }}
          onClick={handleRevealContent}
        >
          <Card 
            sx={{ 
              maxWidth: 300, 
              textAlign: 'center',
              boxShadow: theme.shadows[8],
              border: `2px solid ${alpha(theme.palette.warning.main, 0.3)}`
            }}
          >
            <CardContent>
              <Typography variant="h4" sx={{ mb: 1 }}>
                {getWarningIcon()}
              </Typography>
              <Typography variant="h6" color="warning.main" gutterBottom>
                {warning.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {warning.message}
              </Typography>
              <Button
                variant="contained"
                color="warning"
                startIcon={<Visibility />}
                onClick={handleRevealContent}
                fullWidth
              >
                {warning.action || 'Click to view'}
              </Button>
              <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
                Confidence: {Math.round((warning.confidence || 0) * 100)}%
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Revealed content controls */}
      {isRevealed && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1
          }}
        >
          <IconButton
            size="small"
            onClick={() => setIsRevealed(false)}
            sx={{
              backgroundColor: alpha(theme.palette.background.paper, 0.8),
              '&:hover': {
                backgroundColor: alpha(theme.palette.background.paper, 0.9)
              }
            }}
          >
            <VisibilityOff />
          </IconButton>
        </Box>
      )}

      {/* Warning confirmation dialog */}
      <Dialog 
        open={showWarningDialog} 
        onClose={() => setShowWarningDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Warning color="warning" sx={{ mr: 1 }} />
              Content Warning
            </Box>
            <IconButton onClick={() => setShowWarningDialog(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {warning.message}
          </Typography>
          
          {analysisResult?.reasons && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Detected content:
              </Typography>
              <Box>{getReasonChips()}</Box>
            </Box>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            This content has been automatically flagged by our AI moderation system. 
            You can choose to view it or adjust your content preferences.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setShowWarningDialog(false)}
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmReveal}
            color="warning"
            variant="contained"
            startIcon={<Visibility />}
          >
            I understand, show content
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContentWarning;