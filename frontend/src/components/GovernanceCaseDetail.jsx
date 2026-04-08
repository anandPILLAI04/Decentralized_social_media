import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Avatar,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  HowToVote as VoteIcon,
  Gavel as GavelIcon,
  Assignment as EvidenceIcon,
  Schedule as PendingIcon,
  CheckCircle as CheckIcon,
  Cancel as RejectedIcon,
  PlayArrow as ActivateIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '../hooks/useToast';
import { getToken } from '../utils/safeStorage';

const GovernanceCaseDetail = ({ walletAddress }) => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  // Build headers with JWT auth token
  const getAuthHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    if (walletAddress) headers['x-wallet-address'] = walletAddress;
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banErrorDialogOpen, setBanErrorDialogOpen] = useState(false);
  const [banErrorMessage, setBanErrorMessage] = useState('');
  const [governanceCase, setGovernanceCase] = useState(null);
  const [userVote, setUserVote] = useState(null);
  const [voteStats, setVoteStats] = useState({});
  
  // Voting state
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [selectedVote, setSelectedVote] = useState('');
  const [voteConfidence, setVoteConfidence] = useState(4);
  const [voteReasoning, setVoteReasoning] = useState('');
  const [submittingVote, setSubmittingVote] = useState(false);
  
  // Response/Justification state
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => {
    loadCaseDetails();
  }, [caseId, walletAddress]);

  const loadCaseDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/enhanced-governance/cases/${caseId}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to load case details');
      }

      const data = await response.json();
      setGovernanceCase(data.case);
      setUserVote(data.userVote);
      setVoteStats(data.voteStats || {});

    } catch (err) {
      console.error('Error loading case details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    if (!selectedVote || !voteReasoning.trim()) {
      toast.warning('Please select a vote and provide reasoning');
      return;
    }

    try {
      setSubmittingVote(true);

      const response = await fetch(`/api/enhanced-governance/cases/${caseId}/vote`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          decision: selectedVote,
          confidence: voteConfidence,
          reasoning: voteReasoning
        })
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle banned user error
        if (errorData.error === 'ACCOUNT_BANNED' || errorData.banInfo) {
          throw new Error(`You have been banned. ${errorData.userFriendlyMessage || errorData.banInfo?.appealMessage || 'Contact crib@gmail.com to appeal'}`);
        }

        // Handle not eligible voter error
        if (errorData.error === 'NOT_ELIGIBLE_VOTER') {
          throw new Error(errorData.userFriendlyMessage || errorData.message || 'You are not eligible to vote on this case');
        }

        throw new Error(errorData.message || 'Failed to submit vote');
      }

      setVoteDialogOpen(false);
      setSelectedVote('');
      setVoteReasoning('');
      await loadCaseDetails(); // Refresh data

      toast.success('Vote submitted successfully!');

    } catch (err) {
      console.error('Error submitting vote:', err);

      // Handle ban/restriction errors specially
      if (err.message.includes('banned') || err.message.includes('restricted')) {
        setBanErrorMessage(err.message);
        setBanErrorDialogOpen(true);
      } else {
        toast.error(`Error submitting vote: ${err.message}`);
      }
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleActivateVoting = async () => {
    try {
      const response = await fetch(`/api/enhanced-governance/cases/${caseId}/activate-voting`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to activate voting');
      }

      const result = await response.json();
      await loadCaseDetails(); // Refresh data
      
      toast.success(`Voting activated! Voting period ends ${formatDistanceToNow(new Date(result.case.votingEndTime))} from now.`);

    } catch (err) {
      console.error('Error activating voting:', err);
      toast.error(`Error activating voting: ${err.message}`);
    }
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) {
      toast.warning('Please provide a response');
      return;
    }

    try {
      setSubmittingResponse(true);

      const response = await fetch(`/api/enhanced-governance/cases/${caseId}/evidence`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          type: 'RESPONSE',
          title: 'User Response/Justification',
          description: responseText,
          category: 'DEFENSE'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit response');
      }

      setResponseDialogOpen(false);
      setResponseText('');
      await loadCaseDetails(); // Refresh data

      toast.success('Response submitted successfully!');

    } catch (err) {
      console.error('Error submitting response:', err);
      toast.error(`Error submitting response: ${err.message}`);
    } finally {
      setSubmittingResponse(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE_VOTING': return 'primary';
      case 'PENDING_REVIEW': return 'warning';
      case 'EXECUTED': return 'success';
      case 'REJECTED': return 'error';
      case 'VOTING_ENDED': return 'secondary';
      case 'APPEALED': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ACTIVE_VOTING': return <VoteIcon />;
      case 'PENDING_REVIEW': return <PendingIcon />;
      case 'EXECUTED': return <CheckIcon />;
      case 'REJECTED': return <RejectedIcon />;
      default: return <GavelIcon />;
    }
  };

  const isUserInvolved = () => {
    if (!governanceCase || !walletAddress) return false;
    
    const userAddress = walletAddress.toLowerCase();
    const reporterAddress = governanceCase.reporterAddress?.toLowerCase();
    const reportedUserAddress = governanceCase.caseData?.reportedUser?.userAddress?.toLowerCase();
    
    return userAddress === reporterAddress || userAddress === reportedUserAddress;
  };

  const canUserRespond = () => {
    if (!governanceCase || !walletAddress) return false;
    
    const userAddress = walletAddress.toLowerCase();
    const reportedUserAddress = governanceCase.caseData?.reportedUser?.userAddress?.toLowerCase();
    
    return userAddress === reportedUserAddress && 
           ['PENDING_REVIEW', 'ACTIVE_VOTING'].includes(governanceCase.status);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
        <Box ml={2}>
          <Typography variant="h6">Loading case details...</Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/governance')}>
          Back to Governance
        </Button>
      </Box>
    );
  }

  if (!governanceCase) {
    return (
      <Box p={3}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Governance case not found
        </Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/governance')}>
          Back to Governance
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box mb={3}>
        <Button 
          startIcon={<BackIcon />} 
          onClick={() => navigate('/governance')}
          sx={{ mb: 2 }}
        >
          Back to Governance
        </Button>
        
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Typography variant="h4">
            Case Details
          </Typography>
          <Chip 
            label={governanceCase.type.replace('_', ' ').toUpperCase()}
            color="primary"
            variant="outlined"
          />
          <Chip 
            label={governanceCase.status}
            color={getStatusColor(governanceCase.status)}
            icon={getStatusIcon(governanceCase.status)}
          />
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Main Case Content */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h5" mb={2}>
                {governanceCase.title}
              </Typography>
              
              <Typography variant="body1" paragraph>
                {governanceCase.description}
              </Typography>

              <Box mb={3}>
                <Typography variant="subtitle2" color="textSecondary" mb={1}>
                  Case Information
                </Typography>
                <Typography variant="body2">
                  <strong>ID:</strong> #{governanceCase.caseId || governanceCase._id.slice(-8)}
                </Typography>
                <Typography variant="body2">
                  <strong>Created:</strong> {formatDistanceToNow(new Date(governanceCase.createdAt))} ago
                </Typography>
                <Typography variant="body2">
                  <strong>Urgency:</strong> {governanceCase.urgency}
                </Typography>
                {governanceCase.votingEndTime && (
                  <Typography variant="body2">
                    <strong>Voting Ends:</strong> {formatDistanceToNow(new Date(governanceCase.votingEndTime))} from now
                  </Typography>
                )}
              </Box>

              {/* Case-specific Details */}
              {governanceCase.caseData && (
                <Box mb={3}>
                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="h6" mb={2}>
                    Case Details
                  </Typography>

                  {/* User Report Details */}
                  {governanceCase.type === 'USER_REPORT' && governanceCase.caseData.reportedUser && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" mb={1}>
                        🚨 Reported User
                      </Typography>
                      <Typography variant="body2">
                        <strong>User:</strong> {governanceCase.caseData.reportedUser.username || 
                          `${(governanceCase.caseData.reportedUser.userAddress || '').slice(0, 8)}...`}
                      </Typography>
                      {governanceCase.caseData.violationType && (
                        <Typography variant="body2">
                          <strong>Violation Type:</strong> {governanceCase.caseData.violationType.replace('_', ' ')}
                        </Typography>
                      )}
                      {governanceCase.caseData.suggestedAction && (
                        <Typography variant="body2">
                          <strong>Suggested Action:</strong> {governanceCase.caseData.suggestedAction.replace('_', ' ')}
                        </Typography>
                      )}
                    </Alert>
                  )}

                  {/* Content Report Details */}
                  {governanceCase.type === 'CONTENT_REPORT' && governanceCase.caseData.originalContent && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" mb={1}>
                        📄 Reported Content
                      </Typography>
                      {governanceCase.caseData.originalContent.postId && (
                        <Typography variant="body2">
                          <strong>Post ID:</strong> {governanceCase.caseData.originalContent.postId}
                        </Typography>
                      )}
                      {governanceCase.caseData.originalContent.commentId && (
                        <Typography variant="body2">
                          <strong>Comment ID:</strong> {governanceCase.caseData.originalContent.commentId}
                        </Typography>
                      )}
                      {governanceCase.caseData.originalContent.contentText && (
                        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                          "{governanceCase.caseData.originalContent.contentText}"
                        </Typography>
                      )}
                      {governanceCase.caseData.suggestedAction && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          <strong>Suggested Action:</strong> {governanceCase.caseData.suggestedAction.replace('_', ' ')}
                        </Typography>
                      )}
                    </Alert>
                  )}

                  {/* AI Override Details */}
                  {governanceCase.type === 'AI_OVERRIDE' && governanceCase.caseData.aiModerationResult && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" mb={1}>
                        🤖 AI Moderation Override Request
                      </Typography>
                      <Typography variant="body2">
                        <strong>AI Decision:</strong> {governanceCase.caseData.aiModerationResult.flagged ? 'Flagged' : 'Approved'}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Reason:</strong> {governanceCase.caseData.aiModerationResult.reason}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Confidence:</strong> {Math.round((governanceCase.caseData.aiModerationResult.confidence || 0) * 100)}%
                      </Typography>
                    </Alert>
                  )}
                </Box>
              )}

              {/* Response Section for Involved Users */}
              {canUserRespond() && (
                <Box mb={3}>
                  <Divider sx={{ mb: 2 }} />
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" mb={1}>
                      Your Response
                    </Typography>
                    <Typography variant="body2" mb={2}>
                      You are the subject of this case. You can provide your justification or response.
                    </Typography>
                    <Button 
                      variant="contained" 
                      onClick={() => setResponseDialogOpen(true)}
                      startIcon={<EvidenceIcon />}
                    >
                      Provide Response
                    </Button>
                  </Alert>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Voting Panel */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>
                <VoteIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Voting
              </Typography>

              {/* Voting Status */}
              {governanceCase.status === 'PENDING_REVIEW' && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Voting has not started yet. 
                  {walletAddress && (
                    <Box mt={1}>
                      <Button 
                        variant="contained" 
                        size="small"
                        startIcon={<ActivateIcon />}
                        onClick={handleActivateVoting}
                      >
                        Activate Voting
                      </Button>
                    </Box>
                  )}
                </Alert>
              )}

              {/* Voting Progress */}
              {governanceCase.status === 'ACTIVE_VOTING' && (
                <Box mb={3}>
                  <Typography variant="subtitle2" mb={1}>
                    Current Results
                  </Typography>
                  
                  {voteStats.length > 0 ? voteStats.map(stat => (
                    <Box key={stat._id} mb={1}>
                      <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2">{stat._id}:</Typography>
                        <Typography variant="body2">{stat.count} votes</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={(stat.count / governanceCase.totalVotes) * 100} 
                        sx={{ height: 6, borderRadius: 1 }}
                      />
                    </Box>
                  )) : (
                    <Typography variant="body2" color="textSecondary">
                      No votes yet
                    </Typography>
                  )}
                  
                  <Typography variant="caption" color="textSecondary" mt={2} display="block">
                    Total votes: {governanceCase.totalVotes || 0}
                  </Typography>
                </Box>
              )}

              {/* Voting Buttons */}
              {governanceCase.status === 'ACTIVE_VOTING' && walletAddress && !userVote && (
                <Box>
                  <Typography variant="subtitle2" mb={2}>
                    Cast Your Vote
                  </Typography>
                  <Button 
                    variant="contained" 
                    fullWidth
                    onClick={() => setVoteDialogOpen(true)}
                    startIcon={<VoteIcon />}
                  >
                    Vote on This Case
                  </Button>
                </Box>
              )}

              {/* User's Vote */}
              {userVote && (
                <Alert severity="success">
                  <Typography variant="subtitle2">
                    You voted: {userVote.decision}
                  </Typography>
                  <Typography variant="body2">
                    Confidence: {userVote.confidence}/5
                  </Typography>
                  {userVote.reasoning && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      "{userVote.reasoning}"
                    </Typography>
                  )}
                </Alert>
              )}

              {/* Completed Case Results */}
              {['EXECUTED', 'REJECTED', 'VOTING_ENDED'].includes(governanceCase.status) && (
                <Alert severity={governanceCase.status === 'EXECUTED' ? 'success' : 'warning'}>
                  <Typography variant="subtitle2">
                    Case {governanceCase.status.toLowerCase()}
                  </Typography>
                  <Typography variant="body2">
                    Final result based on community vote
                  </Typography>
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Vote Dialog */}
      <Dialog open={voteDialogOpen} onClose={() => setVoteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cast Your Vote</DialogTitle>
        <DialogContent>
          <Box py={2}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Vote Decision</InputLabel>
              <Select
                value={selectedVote}
                onChange={(e) => setSelectedVote(e.target.value)}
                label="Vote Decision"
              >
                <MenuItem value="APPROVE">Approve</MenuItem>
                <MenuItem value="REJECT">Reject</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Confidence Level</InputLabel>
              <Select
                value={voteConfidence}
                onChange={(e) => setVoteConfidence(e.target.value)}
                label="Confidence Level"
              >
                <MenuItem value={1}>1 - Very Low</MenuItem>
                <MenuItem value={2}>2 - Low</MenuItem>
                <MenuItem value={3}>3 - Medium</MenuItem>
                <MenuItem value={4}>4 - High</MenuItem>
                <MenuItem value={5}>5 - Very High</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Reasoning (Required)"
              value={voteReasoning}
              onChange={(e) => setVoteReasoning(e.target.value)}
              placeholder="Please explain your reasoning for this vote..."
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoteDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleVote} 
            variant="contained"
            disabled={submittingVote || !selectedVote || !voteReasoning.trim()}
          >
            {submittingVote ? <CircularProgress size={20} /> : 'Submit Vote'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Response Dialog */}
      <Dialog open={responseDialogOpen} onClose={() => setResponseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Provide Your Response</DialogTitle>
        <DialogContent>
          <Box py={2}>
            <Typography variant="body2" color="textSecondary" mb={2}>
              This is your opportunity to provide context, justification, or explanation regarding this case.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              label="Your Response/Justification"
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Please provide your response to this case..."
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResponseDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitResponse} 
            variant="contained"
            disabled={submittingResponse || !responseText.trim()}
          >
            {submittingResponse ? <CircularProgress size={20} /> : 'Submit Response'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ban/Restriction Error Dialog */}
      <Dialog
        open={banErrorDialogOpen}
        onClose={() => setBanErrorDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold', fontSize: '1.3rem' }}>
          🚫 Account Permanently Banned
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          <Typography variant="body1" sx={{ mb: 3 }}>
            {banErrorMessage}
          </Typography>

          <Box sx={{
            bgcolor: 'error.lighter',
            p: 2.5,
            borderRadius: 1,
            border: '2px solid',
            borderColor: 'error.main',
            mb: 2
          }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'error.main' }}>
              ✉️ How to Appeal:
            </Typography>
            <Box component="ol" sx={{ pl: 2, mb: 0 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Email:</strong> crib@gmail.com
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Subject:</strong> Account Ban Appeal
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Include in your email:</strong>
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Your wallet address</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Your username</Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Why you believe the ban was made in error</Typography>
                <Typography variant="body2" sx={{ mb: 0 }}>Any supporting evidence or context</Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{
            bgcolor: 'info.lighter',
            p: 2,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'info.main'
          }}>
            <Typography variant="body2" sx={{ color: 'info.dark' }}>
              ⏰ <strong>Appeal Deadline:</strong> 30 days from the ban date
              <br/>
              <strong>Response Time:</strong> Your appeal will be reviewed within 5-7 business days
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBanErrorDialogOpen(false)} variant="contained">
            Okay, I Understand
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GovernanceCaseDetail;