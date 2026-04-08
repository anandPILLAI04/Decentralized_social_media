import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { useToast } from '../hooks/useToast';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Box,
  IconButton,
  Typography,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  RotateRight as RotateRightIcon,
  RotateLeft as RotateLeftIcon,
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  Crop as CropIcon
} from '@mui/icons-material';

/**
 * Helper function to create cropped image
 */
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

/**
 * Get cropped and rotated image as blob
 */
async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);

  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  );

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg', 0.95);
  });
}

/**
 * ImageCropModal Component
 * Allows users to crop, rotate, and zoom images before upload
 */
export default function ImageCropModal({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatioPreset = 'free', // 'square', 'landscape', 'portrait', 'free'
  title = 'Crop Image'
}) {
  const toast = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(aspectRatioPreset);

  // Get aspect ratio value from preset name
  const getAspectRatio = (preset) => {
    switch (preset) {
      case 'square':
        return 1;
      case 'landscape':
        return 16 / 9;
      case 'portrait':
        return 4 / 5;
      case 'free':
        return undefined;
      default:
        return 1;
    }
  };

  const onCropChange = useCallback((crop) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom) => {
    setZoom(zoom);
  }, []);

  const onRotationChange = useCallback((rotation) => {
    setRotation(rotation);
  }, []);

  const handleCropAreaComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleAspectRatioChange = (event, newRatio) => {
    if (newRatio !== null) {
      setSelectedAspectRatio(newRatio);
    }
  };

  const handleRotateLeft = () => {
    setRotation((prev) => prev - 90);
  };

  const handleRotateRight = () => {
    setRotation((prev) => prev + 90);
  };

  const handleApply = async () => {
    try {
      setIsProcessing(true);
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation
      );
      
      // Create a file from the blob with a proper name
      const file = new File([croppedBlob], 'cropped-image.jpg', {
        type: 'image/jpeg'
      });
      
      onCropComplete(file);
      handleClose();
    } catch (error) {
      console.error('Error applying crop:', error);
      toast.error('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    setIsProcessing(false);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        pb: 2
      }}>
        <Box display="flex" alignItems="center" gap={1}>
          <CropIcon color="primary" />
          <Typography variant="h6" fontWeight={600}>
            {title}
          </Typography>
        </Box>
        <IconButton 
          onClick={handleClose} 
          size="small"
          disabled={isProcessing}
          sx={{ 
            color: 'text.secondary',
            '&:hover': { bgcolor: 'action.hover' }
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {/* Crop Area */}
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: 400,
            bgcolor: 'grey.900',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={getAspectRatio(selectedAspectRatio)}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onRotationChange={onRotationChange}
            onCropComplete={handleCropAreaComplete}
            style={{
              containerStyle: {
                borderRadius: '8px'
              }
            }}
          />
        </Box>

        {/* Controls */}
        <Box sx={{ mt: 3 }}>
          {/* Aspect Ratio */}
          <Box mb={2}>
            <Typography variant="body2" fontWeight={600} mb={1} color="text.primary">
              Aspect Ratio
            </Typography>
            <ToggleButtonGroup
              value={selectedAspectRatio}
              exclusive
              onChange={handleAspectRatioChange}
              size="small"
              fullWidth
              sx={{
                '& .MuiToggleButton-root': {
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark'
                    }
                  }
                }
              }}
            >
              <ToggleButton value="square">
                Square (1:1)
              </ToggleButton>
              <ToggleButton value="landscape">
                Landscape (16:9)
              </ToggleButton>
              <ToggleButton value="portrait">
                Portrait (4:5)
              </ToggleButton>
              <ToggleButton value="free">
                Free
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Rotation */}
          <Box mb={2}>
            <Typography variant="body2" fontWeight={600} mb={1} color="text.primary">
              Rotation
            </Typography>
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                startIcon={<RotateLeftIcon />}
                onClick={handleRotateLeft}
                fullWidth
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Rotate Left
              </Button>
              <Button
                variant="outlined"
                startIcon={<RotateRightIcon />}
                onClick={handleRotateRight}
                fullWidth
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Rotate Right
              </Button>
            </Box>
          </Box>

          {/* Zoom */}
          <Box>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="body2" fontWeight={600} color="text.primary">
                Zoom
              </Typography>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                {zoom.toFixed(1)}x
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <ZoomInIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Slider
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e, value) => setZoom(value)}
                sx={{
                  color: 'primary.main',
                  '& .MuiSlider-thumb': {
                    width: 20,
                    height: 20
                  }
                }}
              />
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                3x
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button 
          onClick={handleClose} 
          disabled={isProcessing}
          sx={{ 
            borderRadius: 2, 
            textTransform: 'none', 
            fontWeight: 600,
            px: 3
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={isProcessing}
          startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : null}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            bgcolor: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.dark'
            }
          }}
        >
          {isProcessing ? 'Processing...' : 'Apply Crop'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
