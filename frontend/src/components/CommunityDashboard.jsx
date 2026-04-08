import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Button,
  Tab,
  Tabs,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Avatar,
  IconButton,
  Badge,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Gavel as GavelIcon,
  HowToVote as VoteIcon,
  Assignment as CaseIcon,
  TrendingUp as TrendingIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  AccountBalance as GovernanceIcon,
  People as CommunityIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckIcon,
  Schedule as PendingIcon,
  Cancel as RejectedIcon,
  Info as InfoIcon,
  PlayArrow as ActivateIcon
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

const CommunityDashboard = ({ walletAddress }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dashboard data
  const [dashboardStats, setDashboardStats] = useState({
    totalCases: 0,
    activeCases: 0,
    pendingCases: 0,
    resolvedCases: 0,
    userVotes: 0,
    userProposals: 0
  });
  
  const [cases, setCases] = useState([]);
  const [userMembership, setUserMembership] = useState(null);
  const [recentCases, setRecentCases] = useState([]);
  const [availableToVote, setAvailableToVote] = useState([]);

  // Filter and search state
  const [caseFilter, setCaseFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (walletAddress) {
      loadDashboard();
    }
  }, [walletAddress]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (walletAddress) {
        loadDashboard();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [walletAddress]);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    
    try {
      const headers = {};
      if (walletAddress) {
        headers['x-wallet-address'] = walletAddress;
      }

      // Load dashboard statistics
      const statsResponse = await fetch('/api/enhanced-governance/dashboard', {
        headers
      });

      if (!statsResponse.ok) {
        throw new Error('Failed to load dashboard statistics');
      }

      const statsData = await statsResponse.json();
      setDashboardStats(statsData.dashboard.stats);
      setUserMembership(statsData.dashboard.userMembership);
      setRecentCases(statsData.dashboard.recentCases || []);
      setAvailableToVote(statsData.dashboard.availableToVote || []);

      // Load cases with user vote information
      const casesResponse = await fetch('/api/enhanced-governance/cases', {
        headers
      });

      if (!casesResponse.ok) {
        throw new Error('Failed to load governance cases');
      }

      const casesData = await casesResponse.json();
      setCases(casesData.cases || []);

    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCases = () => {
    let filtered = [...cases];

    // Apply case type/status filter
    if (caseFilter !== 'all') {
      filtered = filtered.filter(case_ => {
        switch (caseFilter) {
          case 'available':
            // Available to vote: user hasn't voted and case is active/voting
            return !case_.hasUserVoted && case_.status === 'ACTIVE_VOTING';
          case 'voted':
            // Already voted by user
            return case_.hasUserVoted;
          case 'completed':
            // Cases that are voting-ended, approved, executed or rejected
            return ['APPROVED', 'EXECUTED', 'REJECTED', 'VOTING_ENDED', 'APPEALED'].includes(case_.status);
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(case_ =>
        case_.title.toLowerCase().includes(query) ||
        case_.description.toLowerCase().includes(query) ||
        case_._id.includes(query)
      );
    }

    // Limit to 10 cases per page
    return filtered.slice(0, 10);
  };

  const handleActivateVoting = async (caseId) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (walletAddress) {
        headers['x-wallet-address'] = walletAddress;
      }

      const response = await fetch(`/api/enhanced-governance/cases/${caseId}/activate-voting`, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to activate voting');
      }

      // Refresh the dashboard
      await loadDashboard();
      alert('Voting activated successfully!');

    } catch (err) {
      console.error('Error activating voting:', err);
      alert(`Error activating voting: ${err.message}`);
    }
  };

  const getCaseTypeColor = (type) => {
    switch (type) {
      case 'CONTENT_REPORT':
        return 'error';
      case 'USER_REPORT':
        return 'warning';
      case 'policy_update':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE_VOTING':
      case 'voting':
        return 'primary';
      case 'PENDING_REVIEW':
      case 'review':
        return 'warning';
      case 'EXECUTED':
      case 'executed':
        return 'success';
      case 'REJECTED':
      case 'rejected':
        return 'error';
      case 'VOTING_ENDED':
        return 'secondary';
      case 'APPEALED':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ACTIVE_VOTING':
      case 'voting':
        return <VoteIcon />;
      case 'PENDING_REVIEW':
      case 'review':
        return <PendingIcon />;
      case 'EXECUTED':
      case 'executed':
        return <CheckIcon />;
      case 'REJECTED':
      case 'rejected':
        return <RejectedIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const filteredCases = filterAndSortCases();
  const unvotedCases = filteredCases.filter(case_ => 
    !case_.hasUserVoted && 
    (case_.status === 'ACTIVE_VOTING' || case_.status === 'voting')
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="500px">
        <CircularProgress size={60} />
        <Box ml={2}>
          <Typography variant="h6">Loading Community Dashboard...</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box maxWidth={1200} mx="auto" p={3}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h4" mb={1}>
          <GovernanceIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Community Governance Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Participate in community governance and help shape our platform's future
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
          <Button onClick={loadDashboard} sx={{ ml: 2 }}>
            Retry
          </Button>
        </Alert>
      )}

      {/* Community Stats */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="primary">
                {dashboardStats.totalCases}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Cases
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="warning.main">
                {dashboardStats.activeCases}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Active Cases
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="info.main">
                {unvotedCases.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Available to Vote
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" color="success.main">
                {dashboardStats.userVotes}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Your Votes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>


      {/* Case Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Filter Cases</InputLabel>
                <Select
                  value={caseFilter}
                  onChange={(e) => setCaseFilter(e.target.value)}
                  label="Filter Cases"
                >
                  <MenuItem value="all">All Cases</MenuItem>
                  <MenuItem value="available">Available to Vote</MenuItem>
                  <MenuItem value="voted">Already Voted</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                onClick={loadDashboard}
                startIcon={<TimelineIcon />}
                fullWidth
              >
                Refresh
              </Button>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                onClick={() => navigate('/')}
                fullWidth
              >
                View Feed
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Cases List */}
      <Box>
        {filteredCases.length === 0 ? (
          <Card>
            <CardContent>
              <Box textAlign="center" py={4}>
                <CaseIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="textSecondary" mb={1}>
                  No Cases Found
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {cases.length === 0 
                    ? "No governance cases have been created yet." 
                    : "Try adjusting your search filters."}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Un-voted Cases Section */}
            {unvotedCases.length > 0 && (
              <Box mb={4}>
                <Typography variant="h5" mb={3} sx={{ 
                  fontWeight: 'bold', 
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <VoteIcon /> Available to Vote ({unvotedCases.length})
                </Typography>
                <Grid container spacing={3}>
                  {unvotedCases.map((case_) => (
                    <Grid item xs={12} key={case_._id}>
                      <Card sx={{ 
                        border: '2px solid', 
                        borderColor: 'primary.main', 
                        backgroundColor: 'primary.50',
                        '&:hover': {
                          boxShadow: 4
                        }
                      }}>
                        <CardContent>
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={9}>
                              <Box display="flex" alignItems="center" mb={2}>
                                <Chip 
                                  label={case_.type.replace('_', ' ').toUpperCase()}
                                  color={getCaseTypeColor(case_.type)}
                                  size="small"
                                  sx={{ mr: 1 }}
                                />
                                <Chip 
                                  label={case_.status.toUpperCase()}
                                  color={getStatusColor(case_.status)}
                                  size="small"
                                  icon={getStatusIcon(case_.status)}
                                  sx={{ mr: 2 }}
                                />
                                {case_.urgency && (
                                  <Chip 
                                    label={`${case_.urgency.toUpperCase()} PRIORITY`}
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                              </Box>
                              
                              <Typography variant="h6" mb={1}>
                                {case_.title}
                              </Typography>
                              <Typography variant="body2" color="textSecondary" mb={2}>
                                {case_.description}
                              </Typography>

                              {/* Case specific details */}
                              {case_.type === 'CONTENT_REPORT' && case_.caseData?.originalContent && (
                                <Box mb={2} p={2} sx={{ backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                                  <Typography variant="subtitle2" color="textSecondary" mb={1}>
                                    <strong>Reported Content:</strong>
                                  </Typography>
                                  <Typography variant="body2">
                                    {case_.caseData.originalContent.contentText || 'Media content'}
                                  </Typography>
                                </Box>
                              )}

                              {case_.type === 'USER_REPORT' && case_.caseData?.reportedUser && (
                                <Box mb={2} p={2} sx={{ backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                                  <Typography variant="subtitle2" color="textSecondary" mb={1}>
                                    <strong>Reported User:</strong>
                                  </Typography>
                                  <Typography variant="body2">
                                    {case_.caseData.reportedUser.username || 
                                      `${(case_.caseData.reportedUser.userAddress || '').slice(0, 8)}...`}
                                  </Typography>
                                </Box>
                              )}

                              <Typography variant="caption" color="textSecondary">
                                Created {formatDistanceToNow(new Date(case_.createdAt))} ago
                              </Typography>
                            </Grid>

                            <Grid item xs={12} md={3}>
                              <Box textAlign="right">
                                <Box mb={2}>
                                  <Typography variant="body2" color="textSecondary" mb={1}>
                                    Total Votes: {case_.totalVotes || 0}
                                  </Typography>
                                  <LinearProgress 
                                    variant="determinate" 
                                    value={Math.min((case_.totalVotes || 0) * 10, 100)}
                                    sx={{ mb: 1 }}
                                  />
                                  <Typography variant="caption" color="textSecondary">
                                    {case_.votingEndTime ? 
                                      `Ends ${formatDistanceToNow(new Date(case_.votingEndTime))} from now` :
                                      'Voting period active'
                                    }
                                  </Typography>
                                </Box>

                                <Button 
                                  variant="contained" 
                                  color="primary"
                                  fullWidth
                                  onClick={() => navigate(`/governance/case/${case_._id}`)}
                                >
                                  Vote on Case
                                </Button>
                              </Box>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}

            {/* All Cases Section */}
            <Box>
              <Typography variant="h5" mb={3} sx={{ 
                fontWeight: 'bold',
                color: 'text.primary',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <CaseIcon /> All Cases ({filteredCases.length})
              </Typography>
              
              <Grid container spacing={3}>
                {filteredCases.map((case_) => (
                  <Grid item xs={12} key={case_._id}>
                    <Card sx={{ 
                      ...(case_.hasUserVoted && { 
                        backgroundColor: 'action.hover',
                        opacity: 0.8
                      })
                    }}>
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={9}>
                            <Box display="flex" alignItems="center" mb={2}>
                              <Chip 
                                label={case_.type.replace('_', ' ').toUpperCase()}
                                color={getCaseTypeColor(case_.type)}
                                size="small"
                                sx={{ mr: 1 }}
                              />
                              <Chip 
                                label={case_.status.toUpperCase()}
                                color={getStatusColor(case_.status)}
                                size="small"
                                icon={getStatusIcon(case_.status)}
                                sx={{ mr: 2 }}
                              />
                              {case_.urgency && (
                                <Chip 
                                  label={`${case_.urgency.toUpperCase()} PRIORITY`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ mr: 1 }}
                                />
                              )}
                              {case_.hasUserVoted && (
                                <Chip 
                                  label="VOTED"
                                  color="success"
                                  size="small"
                                  icon={<CheckIcon />}
                                />
                              )}
                            </Box>
                            
                            <Typography variant="h6" mb={1}>
                              {case_.title}
                            </Typography>
                            <Typography variant="body2" color="textSecondary" mb={2}>
                              {case_.description}
                            </Typography>

                            {/* Case specific details */}
                            {case_.type === 'CONTENT_REPORT' && case_.caseData?.originalContent && (
                              <Box mb={2} p={2} sx={{ backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                                <Typography variant="subtitle2" color="textSecondary" mb={1}>
                                  <strong>Reported Content:</strong>
                                </Typography>
                                <Typography variant="body2">
                                  {case_.caseData.originalContent.contentText || 'Media content'}
                                </Typography>
                              </Box>
                            )}

                            {case_.type === 'USER_REPORT' && case_.caseData?.reportedUser && (
                              <Box mb={2} p={2} sx={{ backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                                <Typography variant="subtitle2" color="textSecondary" mb={1}>
                                  <strong>Reported User:</strong>
                                </Typography>
                                <Typography variant="body2">
                                  {case_.caseData.reportedUser.username || 
                                    `${(case_.caseData.reportedUser.userAddress || '').slice(0, 8)}...`}
                                </Typography>
                              </Box>
                            )}

                            <Box display="flex" alignItems="center" gap={2} mb={2}>
                              <Typography variant="caption" color="textSecondary">
                                Case #{case_._id.slice(-8)}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                Created {formatDistanceToNow(new Date(case_.createdAt))} ago
                              </Typography>
                              {case_.votes && (
                                <>
                                  <Typography variant="caption" color="textSecondary">
                                    Approve: {case_.votes.approve || 0}
                                  </Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    Reject: {case_.votes.reject || 0}
                                  </Typography>
                                </>
                              )}
                            </Box>
                          </Grid>

                          <Grid item xs={12} md={3}>
                            <Box textAlign="right">
                              {/* Voting Progress */}
                              {(case_.status === 'ACTIVE_VOTING' || case_.status === 'voting') && (
                                <Box mb={2}>
                                  <Typography variant="body2" color="textSecondary" mb={1}>
                                    Total Votes: {case_.totalVotes || 0}
                                  </Typography>
                                  <LinearProgress 
                                    variant="determinate" 
                                    value={Math.min((case_.totalVotes || 0) * 10, 100)}
                                    sx={{ mb: 1 }}
                                  />
                                  <Typography variant="caption" color="textSecondary">
                                    {case_.votingEndTime ? 
                                      `Ends ${formatDistanceToNow(new Date(case_.votingEndTime))} from now` :
                                      'Voting period active'
                                    }
                                  </Typography>
                                </Box>
                              )}

                              {/* Pending Review Status */}
                              {case_.status === 'PENDING_REVIEW' && (
                                <Box mb={2}>
                                  <Alert severity="info" sx={{ mb: 1 }}>
                                    Pending Review
                                  </Alert>
                                  {walletAddress && (
                                    <Button 
                                      variant="contained" 
                                      color="warning" 
                                      size="small"
                                      fullWidth
                                      startIcon={<ActivateIcon />}
                                      onClick={() => handleActivateVoting(case_._id)}
                                      sx={{ mb: 1 }}
                                    >
                                      Activate Voting
                                    </Button>
                                  )}
                                </Box>
                              )}

                              {/* View Details Button */}
                              <Button 
                                variant="outlined" 
                                fullWidth
                                onClick={() => navigate(`/governance/case/${case_._id}`)}
                              >
                                View Details
                              </Button>
                            </Box>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default CommunityDashboard;