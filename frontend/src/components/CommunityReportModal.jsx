import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  Box,
  Typography,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormLabel,
  Divider,
  IconButton,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  LinearProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Warning as WarningIcon,
  Flag as FlagIcon,
  Gavel as GavelIcon,
  Upload as UploadIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import EvidenceUpload from './EvidenceUpload';

const VIOLATION_TYPES = {
  HARASSMENT: {
    label: 'Harassment or Bullying',
    description: 'Targeting individuals with abuse, threats, or persistent unwelcome contact',
    severity: 'HIGH'
  },
  HATE_SPEECH: {
    label: 'Hate Speech',
    description: 'Content that attacks or dehumanizes groups based on identity',
    severity: 'CRITICAL'
  },
  SPAM: {
    label: 'Spam or Scam',
    description: 'Repetitive content, fake promotions, or fraudulent schemes',
    severity: 'NORMAL'
  },
  FRAUD: {
    label: 'Fraud or Misinformation',
    description: 'Deliberately false information, fraud, impersonation, or deceptive content',
    severity: 'HIGH'
  },
  IMPERSONATION: {
    label: 'Impersonation',
    description: 'Pretending to be someone else to deceive others',
    severity: 'HIGH'
  },
  OTHER: {
    label: 'Other Violation',
    description: 'Violation not covered by other categories (inappropriate content, violence, copyright, privacy, etc.)',
    severity: 'NORMAL'
  }
};

const SUGGESTED_ACTIONS = {
  WARNING: 'Issue a warning to the user',
  DELETE_POST: 'Remove the violating content',
  TEMP_BAN_48H: 'Temporarily suspend the user (48 hours)',
  PERMANENT_BAN: 'Permanently ban the user'
};

export default function CommunityReportModal({ 
  open, 
  onClose, 
  contentType, 
  contentId, 
  contentData, 
  reportedUser, 
  onSubmit 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  
  // Form state
  const [reportData, setReportData] = useState({
    violationType: '',
    title: '',
    description: '',
    suggestedAction: '',
    urgency: 'NORMAL',
    evidence: [],
    additionalContext: '',
    isAnonymous: false
  });

  const steps = ['Report Details', 'Evidence & Context', 'Review & Submit'];

  const handleClose = () => {
    setCurrentStep(0);
    setReportData({
      violationType: '',
      title: '',
      description: '',
      suggestedAction: '',
      urgency: 'NORMAL',
      evidence: [],
      additionalContext: '',
      isAnonymous: false
    });
    setSubmitError('');
    onClose();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleViolationTypeChange = (type) => {
    const violation = VIOLATION_TYPES[type];
    setReportData(prev => ({
      ...prev,
      violationType: type,
      urgency: violation.severity === 'CRITICAL' ? 'CRITICAL' : 
              violation.severity === 'HIGH' ? 'HIGH' : 'NORMAL',
      title: `${violation.label} Report${contentType === 'user' ? ' - User Behavior' : ''}`
    }));
  };

  const isStepValid = (step) => {
    switch (step) {
      case 0:
        return reportData.violationType && reportData.suggestedAction && reportData.description.length >= 20;
      case 1:
        return true;
      case 2:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Validate required fields
      if (!reportData.suggestedAction) {
        throw new Error('Please select an action the community should take');
      }

      // Filter out any evidence that failed to upload (missing required fields)
      const validEvidence = reportData.evidence.filter(e => 
        e.fileName && (e.fileUrl || e.fileCID)
      ).map(e => ({
        type: e.evidenceType || 'USER_UPLOAD',
        description: e.description || `${e.fileName} - ${e.category} file`,
        url: e.fileUrl,
        fileName: e.fileName,
        fileSize: e.fileSize,
        category: e.category,
        fileCID: e.fileCID,
        metadataCID: e.metadataCID,
        uploadedAt: e.uploadedAt
      }));

      const caseData = {
        type: contentType === 'user' ? 'USER_REPORT' : 'CONTENT_REPORT',
        title: reportData.title,
        description: reportData.description,
        urgency: reportData.urgency,
        
        caseData: {
          ...(contentType !== 'user' && {
            originalContent: {
              [contentType === 'post' ? 'postId' : 'commentId']: contentId,
              contentText: contentData?.content || contentData?.text,
              contentMedia: contentData?.images || []
            }
          }),
          
          ...(contentType === 'user' && {
            reportedUser: {
              userId: reportedUser?.id,
              userAddress: reportedUser?.walletAddress,
              username: reportedUser?.username
            }
          }),
          
          violationType: reportData.violationType,
          suggestedAction: reportData.suggestedAction
        },
        
        // Evidence is now optional - only include if we have valid evidence
        evidence: validEvidence
      };

      await onSubmit(caseData);
      handleClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      setSubmitError(error.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FlagIcon color="warning" />
              What type of violation are you reporting?
            </Typography>
            
            <FormControl fullWidth margin="normal">
              <Select
                value={reportData.violationType}
                onChange={(e) => handleViolationTypeChange(e.target.value)}
                displayEmpty
              >
                <MenuItem value="" disabled>Select violation type</MenuItem>
                {Object.entries(VIOLATION_TYPES).map(([key, violation]) => (
                  <MenuItem key={key} value={key}>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">
                        {violation.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {violation.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {reportData.violationType && (
              <Alert 
                severity={VIOLATION_TYPES[reportData.violationType].severity === 'CRITICAL' ? 'error' : 'warning'} 
                sx={{ my: 2 }}
              >
                <Typography variant="body2">
                  <strong>Severity:</strong> {VIOLATION_TYPES[reportData.violationType].severity}
                  {VIOLATION_TYPES[reportData.violationType].severity === 'CRITICAL' && 
                    ' - This report will be expedited for immediate review.'}
                </Typography>
              </Alert>
            )}

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Detailed Description"
              placeholder="Please provide a detailed explanation of the violation. Include specific examples, timestamps, and any relevant context that will help the community understand the issue."
              value={reportData.description}
              onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value }))}
              margin="normal"
              required
              helperText={`${reportData.description.length}/2000 characters (minimum 20)`}
              error={reportData.description.length > 0 && reportData.description.length < 20}
            />

            <FormControl component="fieldset" margin="normal" fullWidth>
              <FormLabel component="legend">What action do you think the community should take?</FormLabel>
              <RadioGroup
                value={reportData.suggestedAction}
                onChange={(e) => setReportData(prev => ({ ...prev, suggestedAction: e.target.value }))}
              >
                {Object.entries(SUGGESTED_ACTIONS).map(([key, label]) => (
                  <FormControlLabel 
                    key={key} 
                    value={key} 
                    control={<Radio size="small" />} 
                    label={<Typography variant="body2">{label}</Typography>}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon color="primary" />
              Additional Evidence & Context
            </Typography>

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                Strong evidence helps the community make informed decisions. Consider providing:
                screenshots, links to similar incidents, or witness accounts.
              </Typography>
            </Alert>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Additional Context"
              placeholder="Any additional information that might be relevant - patterns of behavior, impact on the community, similar incidents, etc."
              value={reportData.additionalContext}
              onChange={(e) => setReportData(prev => ({ ...prev, additionalContext: e.target.value }))}
              margin="normal"
              required
              helperText={`${reportData.additionalContext.length}/1000 characters (minimum 10)`}
            />

            {/* Evidence Upload Component */}
            <EvidenceUpload
              onEvidenceChange={(evidenceList) => {
                setReportData(prev => ({ ...prev, evidence: evidenceList }));
              }}
              maxFiles={5}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={reportData.isAnonymous}
                  onChange={(e) => setReportData(prev => ({ ...prev, isAnonymous: e.target.checked }))}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">Submit anonymously</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Your identity will be hidden from the community, but moderators can still see it
                  </Typography>
                </Box>
              }
              sx={{ mt: 2 }}
            />
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GavelIcon color="success" />
              Review Your Report
            </Typography>

            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Important:</strong> False reports can result in restrictions to your account.
                Please ensure your report is accurate and made in good faith.
              </Typography>
            </Alert>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  <strong>Report Summary</strong>
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Chip 
                    label={VIOLATION_TYPES[reportData.violationType]?.label} 
                    color="warning" 
                    size="small" 
                    sx={{ mr: 1 }}
                  />
                  <Chip 
                    label={`${reportData.urgency} Priority`} 
                    color={reportData.urgency === 'CRITICAL' ? 'error' : 
                           reportData.urgency === 'HIGH' ? 'warning' : 'default'} 
                    size="small" 
                  />
                </Box>

                <Typography variant="body2" gutterBottom>
                  <strong>Description:</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                  "{reportData.description}"
                </Typography>

                <Typography variant="body2" gutterBottom>
                  <strong>Suggested Action:</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {SUGGESTED_ACTIONS[reportData.suggestedAction]}
                </Typography>

                <Typography variant="body2" gutterBottom>
                  <strong>Additional Context:</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {reportData.additionalContext}
                </Typography>

                {reportData.evidence.length > 0 && (
                  <>
                    <Typography variant="body2" gutterBottom>
                      <strong>Evidence Attached ({reportData.evidence.length} files):</strong>
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      {reportData.evidence.map((evidence, index) => (
                        <Chip
                          key={evidence.id || index}
                          label={`${evidence.fileName} (${evidence.category})`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  </>
                )}

                {reportData.isAnonymous && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      This report will be submitted anonymously
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary">
                <strong>What happens next?</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                1. Your report will be reviewed for completeness<br/>
                2. The community will vote on the appropriate action<br/>
                3. You'll be notified of the decision and any actions taken<br/>
                4. You can appeal the decision if you disagree
              </Typography>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          <Typography variant="h6">
            Report to Community
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, py: 1 }}>
        <Stepper activeStep={currentStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent sx={{ pt: 2 }}>
        {isSubmitting && <LinearProgress sx={{ mb: 2 }} />}
        
        {submitError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {submitError}
          </Alert>
        )}

        {renderStepContent(currentStep)}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={handleClose} 
          color="inherit"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        
        {currentStep > 0 && (
          <Button 
            onClick={handleBack}
            color="inherit"
            disabled={isSubmitting}
          >
            Back
          </Button>
        )}
        
        {currentStep < steps.length - 1 ? (
          <Button 
            onClick={handleNext}
            variant="contained"
            disabled={!isStepValid(currentStep) || isSubmitting}
          >
            Next
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit}
            variant="contained"
            color="warning"
            disabled={!isStepValid(currentStep) || isSubmitting}
            startIcon={isSubmitting ? null : <GavelIcon />}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}