import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Alert,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Paper,
  Divider
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Screenshot as ScreenshotIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  PhotoCamera as CameraIcon,
  AttachFile as AttachIcon
} from '@mui/icons-material';
import { 
  uploadEvidence, 
  uploadMultipleEvidence, 
  captureScreenshotEvidence, 
  validateEvidenceFile,
  getEvidenceSummary,
  MAX_FILE_SIZES,
  SUPPORTED_TYPES 
} from '../services/evidenceService.js';

const EvidenceUpload = ({ onEvidenceChange, maxFiles = 5 }) => {
  const [evidence, setEvidence] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [errors, setErrors] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;
    
    const fileList = Array.from(files);
    
    // Check total file count
    if (evidence.length + fileList.length > maxFiles) {
      setErrors([`Maximum ${maxFiles} files allowed. Currently have ${evidence.length} files.`]);
      return;
    }
    
    // Validate files before upload
    const validationErrors = [];
    const validFiles = [];
    
    fileList.forEach(file => {
      const validation = validateEvidenceFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        validationErrors.push(`${file.name}: ${validation.errors.join(', ')}`);
      }
    });
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
    }
    
    if (validFiles.length === 0) return;
    
    // Upload valid files
    await uploadFiles(validFiles);
  };

  // Upload files to IPFS
  const uploadFiles = async (files) => {
    setUploading(true);
    setErrors([]);
    
    try {
      const result = await uploadMultipleEvidence(files, {
        onFileProgress: (progress) => {
          setUploadProgress(progress);
        },
        onOverallProgress: (progress) => {
          setUploadProgress(progress);
        },
        evidenceType: 'USER_UPLOAD',
        submittedBy: 'current_user' // TODO: Get from context
      });
      
      // Update evidence list
      const newEvidence = [...evidence, ...result.evidence];
      setEvidence(newEvidence);
      onEvidenceChange(newEvidence);
      
      // Show any errors
      if (result.errors.length > 0) {
        setErrors(result.errors.map(err => `${err.fileName}: ${err.error}`));
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      // Provide user-friendly error messages for common IPFS/Pinata issues
      let errorMessage = error.message;
      
      if (error.message.includes('IPFS upload failed') || error.message.includes('Pinata')) {
        errorMessage = 'Evidence upload service is temporarily unavailable. You can still submit your report without evidence.';
      } else if (error.message.includes('INVALID_CREDENTIALS')) {
        errorMessage = 'Evidence upload service is temporarily unavailable. You can still submit your report without evidence.';
      } else if (error.message.includes('token is malformed')) {
        errorMessage = 'Evidence upload service is temporarily unavailable. You can still submit your report without evidence.';
      }
      
      setErrors([errorMessage]);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // Handle screenshot capture
  const handleScreenshot = async () => {
    try {
      setUploading(true);
      const result = await captureScreenshotEvidence('Screenshot evidence');
      
      const newEvidence = [...evidence, result.evidence];
      setEvidence(newEvidence);
      onEvidenceChange(newEvidence);
      
    } catch (error) {
      console.error('Screenshot failed:', error);
      setErrors([error.message]);
    } finally {
      setUploading(false);
    }
  };

  // Remove evidence
  const handleRemoveEvidence = (index) => {
    const newEvidence = evidence.filter((_, i) => i !== index);
    setEvidence(newEvidence);
    onEvidenceChange(newEvidence);
  };

  // Preview evidence
  const handlePreview = (evidenceItem) => {
    setPreviewFile(evidenceItem);
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file icon based on category
  const getFileIcon = (category) => {
    switch (category) {
      case 'IMAGE': return <CameraIcon />;
      case 'DOCUMENT': return <AttachIcon />;
      default: return <AttachIcon />;
    }
  };

  return (
    <Box>
      {/* Upload Area */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <UploadIcon color="primary" />
            Evidence Collection (Optional)
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Upload screenshots, documents, or other evidence to support your report.
            Evidence is stored securely on IPFS for community review. You can skip this step if evidence upload is unavailable.
          </Typography>

          {/* Upload Buttons */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFileSelect(e.target.files)}
                multiple
                accept={Object.values(SUPPORTED_TYPES).flat().join(',')}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || evidence.length >= maxFiles}
              >
                Upload Files
              </Button>
            </Grid>
            
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<ScreenshotIcon />}
                onClick={handleScreenshot}
                disabled={uploading || evidence.length >= maxFiles}
              >
                Take Screenshot
              </Button>
            </Grid>
          </Grid>

          {/* File Format Info */}
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              <strong>Supported formats:</strong>
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              <Chip size="small" label="Images: JPG, PNG, GIF, WebP" />
              <Chip size="small" label="Documents: PDF, DOC, TXT" />
              <Chip size="small" label="Max size: 10MB per file" />
            </Box>
          </Box>

          {/* Upload Progress */}
          {uploadProgress && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                {uploadProgress.stage === 'validation' && 'Validating files...'}
                {uploadProgress.stage === 'uploading' && 'Uploading to IPFS...'}
                {uploadProgress.stage === 'metadata' && 'Storing metadata...'}
                {uploadProgress.stage === 'complete' && 'Upload complete!'}
                {uploadProgress.fileName && ` (${uploadProgress.currentFile}/${uploadProgress.totalFiles}: ${uploadProgress.fileName})`}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress.progress || 0} 
                sx={{ borderRadius: 1 }}
              />
            </Box>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom><strong>Upload errors:</strong></Typography>
              {errors.map((error, index) => (
                <Typography key={index} variant="body2">• {error}</Typography>
              ))}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Evidence List */}
      {evidence.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckIcon color="success" />
              Uploaded Evidence ({evidence.length}/{maxFiles})
            </Typography>

            <List>
              {evidence.map((item, index) => (
                <React.Fragment key={item.id || index}>
                  <ListItem>
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                      {getFileIcon(item.category)}
                    </Box>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight="bold">
                          {item.fileName}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatSize(item.fileSize)} • {item.category} • {new Date(item.uploadedAt).toLocaleString()}
                          </Typography>
                          {item.description && (
                            <Typography variant="caption" display="block" sx={{ fontStyle: 'italic' }}>
                              "{item.description}"
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton 
                        size="small" 
                        onClick={() => handlePreview(item)}
                        title="Preview"
                      >
                        <PreviewIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => handleRemoveEvidence(index)}
                        title="Remove"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < evidence.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      {previewFile && (
        <Dialog
          open={Boolean(previewFile)}
          onClose={() => setPreviewFile(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Evidence Preview: {previewFile.fileName}
          </DialogTitle>
          <DialogContent>
            {previewFile.category === 'IMAGE' ? (
              <Box sx={{ textAlign: 'center' }}>
                <img
                  src={previewFile.fileUrl}
                  alt={previewFile.fileName}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '500px',
                    borderRadius: '8px'
                  }}
                />
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                <Box sx={{ mb: 2 }}>
                  {getFileIcon(previewFile.category)}
                </Box>
                <Typography variant="h6" gutterBottom>
                  {previewFile.fileName}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {formatSize(previewFile.fileSize)} • {previewFile.category}
                </Typography>
                <Button
                  variant="outlined"
                  href={previewFile.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<PreviewIcon />}
                  sx={{ mt: 1 }}
                >
                  View on IPFS
                </Button>
              </Paper>
            )}
            
            {previewFile.description && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>Description:</strong> {previewFile.description}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewFile(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default EvidenceUpload;