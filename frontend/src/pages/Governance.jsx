import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Badge,
  Fab
} from "@mui/material";
import {
  Add as AddIcon,
  HowToVote as VoteIcon,
  TrendingUp as TrendingIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  BarChart as StatsIcon,
  Close as CloseIcon
} from "@mui/icons-material";
import { fetchProposals, createProposal, voteOnProposal, fetchGovernanceStats } from "../services/apiService";

const Governance = () => {
  const [proposals, setProposals] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [newProposal, setNewProposal] = useState({ title: "", description: "" });
  const [voteData, setVoteData] = useState({ support: 1, reason: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [proposalsRes, statsRes] = await Promise.all([
        fetchProposals(),
        fetchGovernanceStats()
      ]);
      
      if (proposalsRes.success) {
        setProposals(proposalsRes.proposals);
      }
      
      if (statsRes.success) {
        setStats(statsRes.stats);
      }
    } catch (error) {
      console.error("Error loading governance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProposal = async () => {
    try {
      setLoading(true);
      const response = await createProposal({
        ...newProposal,
        proposer: "0x1234...abcd", // Replace with actual wallet address
        proposerName: "Alice"
      });
      
      if (response.success) {
        setProposals([response.proposal, ...proposals]);
        setCreateDialogOpen(false);
        setNewProposal({ title: "", description: "" });
        loadData(); // Refresh data
      }
    } catch (error) {
      console.error("Error creating proposal:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async () => {
    try {
      setLoading(true);
      const response = await voteOnProposal(selectedProposal.id, {
        ...voteData,
        voter: "0x1234...abcd", // Replace with actual wallet address
        votingPower: 100
      });
      
      if (response.success) {
        // Update local state
        setProposals(proposals.map(p => 
          p.id === selectedProposal.id 
            ? { ...p, forVotes: response.forVotes, againstVotes: response.againstVotes }
            : p
        ));
        setVoteDialogOpen(false);
        setSelectedProposal(null);
        setVoteData({ support: 1, reason: "" });
        loadData(); // Refresh data
      }
    } catch (error) {
      console.error("Error voting:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active": return "primary";
      case "executed": return "success";
      case "canceled": return "error";
      default: return "default";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "active": return <ScheduleIcon />;
      case "executed": return <CheckIcon />;
      case "canceled": return <CancelIcon />;
      default: return null;
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  const getVotePercentage = (forVotes, againstVotes) => {
    const total = forVotes + againstVotes;
    if (total === 0) return 0;
    return Math.round((forVotes / total) * 100);
  };

  const filteredProposals = proposals.filter(proposal => {
    if (activeTab === 0) return true; // All
    if (activeTab === 1) return proposal.status === "active";
    if (activeTab === 2) return proposal.status === "executed";
    if (activeTab === 3) return proposal.status === "canceled";
    return true;
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Community Governance
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          Participate in decentralized decision-making and shape the future of our platform
        </Typography>
      </Box>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: "center" }}>
                <Typography variant="h4" color="primary" gutterBottom>
                  {stats.totalProposals}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Proposals
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: "center" }}>
                <Typography variant="h4" color="primary" gutterBottom>
                  {stats.activeProposals}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Proposals
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: "center" }}>
                <Typography variant="h4" color="success.main" gutterBottom>
                  {stats.executedProposals}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Executed
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: "center" }}>
                <Typography variant="h4" color="info.main" gutterBottom>
                  {stats.participationRate.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Participation Rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs and Actions */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label={`All (${proposals.length})`} />
            <Tab label={`Active (${proposals.filter(p => p.status === "active").length})`} />
            <Tab label={`Executed (${proposals.filter(p => p.status === "executed").length})`} />
            <Tab label={`Canceled (${proposals.filter(p => p.status === "canceled").length})`} />
          </Tabs>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
            sx={{ borderRadius: 3 }}
          >
            Create Proposal
          </Button>
        </Box>
      </Box>

      {/* Proposals List */}
      {loading ? (
        <Box textAlign="center" py={8}>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography>Loading proposals...</Typography>
        </Box>
      ) : filteredProposals.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No proposals found
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {activeTab === 0 
              ? "Be the first to create a proposal!" 
              : `No ${activeTab === 1 ? "active" : activeTab === 2 ? "executed" : "canceled"} proposals yet.`
            }
          </Typography>
          {activeTab === 0 && (
            <Button
              variant="contained"
              onClick={() => setCreateDialogOpen(true)}
              startIcon={<AddIcon />}
            >
              Create First Proposal
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredProposals.map((proposal) => (
            <Grid item xs={12} key={proposal.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography variant="h6" fontWeight={600}>
                          {proposal.title}
                        </Typography>
                        <Chip
                          icon={getStatusIcon(proposal.status)}
                          label={proposal.status}
                          color={getStatusColor(proposal.status)}
                          size="small"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {proposal.description}
                      </Typography>
                    </Box>
                    
                    <Box display="flex" gap={1}>
                      {proposal.status === "active" && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<VoteIcon />}
                          onClick={() => {
                            setSelectedProposal(proposal);
                            setVoteDialogOpen(true);
                          }}
                        >
                          Vote
                        </Button>
                      )}
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Proposal Details */}
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                          {proposal.proposerName?.[0] || "?"}
                        </Avatar>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Proposer
                          </Typography>
                          <Typography variant="body2" fontWeight={500}>
                            {proposal.proposerName || proposal.proposer}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Start Date
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {formatDate(proposal.startTime)}
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          End Date
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {formatDate(proposal.endTime)}
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Total Votes
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {proposal.forVotes + proposal.againstVotes}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Voting Results */}
                  <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2" color="text.secondary">
                        Voting Results
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {getVotePercentage(proposal.forVotes, proposal.againstVotes)}% For
                      </Typography>
                    </Box>
                    
                    <LinearProgress
                      variant="determinate"
                      value={getVotePercentage(proposal.forVotes, proposal.againstVotes)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    
                    <Box display="flex" justifyContent="space-between" mt={1}>
                      <Typography variant="caption" color="success.main">
                        {proposal.forVotes} For
                      </Typography>
                      <Typography variant="caption" color="error.main">
                        {proposal.againstVotes} Against
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Proposal Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            Create New Proposal
            <IconButton onClick={() => setCreateDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Proposal Title"
            value={newProposal.title}
            onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={4}
            value={newProposal.description}
            onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
            placeholder="Describe your proposal in detail..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateProposal}
            disabled={!newProposal.title.trim() || !newProposal.description.trim() || loading}
          >
            Create Proposal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Vote Dialog */}
      <Dialog 
        open={voteDialogOpen} 
        onClose={() => setVoteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            Vote on Proposal
            <IconButton onClick={() => setVoteDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedProposal && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedProposal.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {selectedProposal.description}
              </Typography>
              
              <Box mb={3}>
                <Typography variant="body2" gutterBottom>
                  How do you vote on this proposal?
                </Typography>
                <Box display="flex" gap={2}>
                  <Button
                    variant={voteData.support === 1 ? "contained" : "outlined"}
                    color="success"
                    onClick={() => setVoteData({ ...voteData, support: 1 })}
                    fullWidth
                  >
                    For
                  </Button>
                  <Button
                    variant={voteData.support === 2 ? "contained" : "outlined"}
                    color="error"
                    onClick={() => setVoteData({ ...voteData, support: 2 })}
                    fullWidth
                  >
                    Against
                  </Button>
                </Box>
              </Box>
              
              <TextField
                fullWidth
                label="Reason (Optional)"
                multiline
                rows={3}
                value={voteData.reason}
                onChange={(e) => setVoteData({ ...voteData, reason: e.target.value })}
                placeholder="Explain your reasoning..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVoteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleVote}
            disabled={loading}
          >
            Submit Vote
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="create proposal"
        onClick={() => setCreateDialogOpen(true)}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
      >
        <AddIcon />
      </Fab>
    </Container>
  );
};

export default Governance;
