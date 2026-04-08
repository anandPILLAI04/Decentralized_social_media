import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, Grid, CircularProgress,
  Alert, LinearProgress, Chip, Paper, Divider, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Avatar, Snackbar, Tabs, Tab
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { votingPowerAPI } from '../services/apiService';

const POWER_LEVELS = {
  NEWCOMER: { icon: '🌱', color: '#8c8c8c', label: 'Newcomer' },
  PARTICIPANT: { icon: '👤', color: '#1890ff', label: 'Participant' },
  REGULAR_MEMBER: { icon: '⭐', color: '#52c41a', label: 'Regular Member' },
  ACTIVE_MEMBER: { icon: '🔥', color: '#fa8c16', label: 'Active Member' },
  SENIOR_MEMBER: { icon: '👑', color: '#eb2f96', label: 'Senior Member' },
  GOVERNANCE_EXPERT: { icon: '💎', color: '#722ed1', label: 'Governance Expert' },
};

const getPL = (level) => POWER_LEVELS[level] || POWER_LEVELS.NEWCOMER;

const VotingPowerPage = ({ walletAddress }) => {
  const navigate = useNavigate();
  const [userPower, setUserPower] = useState(null);
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [tab, setTab] = useState(0);
  const [lbPage, setLbPage] = useState(0);
  const [lbTotal, setLbTotal] = useState(0);

  useEffect(() => { loadAll(); }, [walletAddress]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        walletAddress ? votingPowerAPI.getMemberPower(walletAddress) : Promise.resolve(null),
        votingPowerAPI.getStats(),
        votingPowerAPI.getLeaderboard(20, 1),
      ]);
      if (results[0]?.value?.success) setUserPower(results[0].value.data);
      if (results[1]?.value?.success) setStats(results[1].value.data);
      if (results[2]?.value?.success) {
        setLeaderboard(results[2].value.data.leaderboard || []);
        setLbTotal(results[2].value.data.pagination?.totalMembers || 0);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!walletAddress) return;
    setCalculating(true);
    try {
      await votingPowerAPI.updatePower(walletAddress);
      const res = await votingPowerAPI.getMemberPower(walletAddress);
      if (res.success) setUserPower(res.data);
      setToast({ open: true, message: 'Voting power updated!', severity: 'success' });
    } catch {
      setToast({ open: true, message: 'Failed to update', severity: 'error' });
    } finally {
      setCalculating(false);
    }
  };

  const handleLbPageChange = async (_e, newPage) => {
    try {
      const res = await votingPowerAPI.getLeaderboard(20, newPage + 1);
      if (res.success) {
        setLeaderboard(res.data.leaderboard || []);
        setLbTotal(res.data.pagination?.totalMembers || 0);
      }
    } catch { /* ignore */ }
    setLbPage(newPage);
  };

  const eligibility = [
    { label: 'Basic Voting', threshold: 50 },
    { label: 'Create Proposals', threshold: 100 },
    { label: 'Moderation Actions', threshold: 200 },
    { label: 'Administrative Voting', threshold: 500 },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={48} />
      </Box>
    );
  }

  const pl = getPL(userPower?.powerLevel);
  const pct = userPower ? (userPower.totalVotingPower / (userPower.maxPossiblePower || 1000)) * 100 : 0;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/governance')} sx={{ mb: 2 }}>
        Back to Governance
      </Button>

      <Typography variant="h4" fontWeight={700} gutterBottom>⚡ Voting Power System</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Your voting power determines your influence in community governance decisions.
        It's calculated based on blockchain activity, account age, and community participation.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* How It Works */}
      <Card variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <InfoOutlinedIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
            How Voting Power Works
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>📊 Power Components</Typography>
              {[
                { icon: '⚡', label: 'Base Power (20%)', desc: 'Minimum democratic participation power' },
                { icon: '🔗', label: 'Blockchain Activity (30%)', desc: 'Rewards for on-chain transaction history' },
                { icon: '⏰', label: 'Account Age (25%)', desc: 'Stability bonus for account longevity' },
                { icon: '🏛️', label: 'Community Participation (25%)', desc: 'Governance engagement and quality contribution' },
              ].map((c, i) => (
                <Box key={i} sx={{ mb: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{c.icon} {c.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.desc}</Typography>
                </Box>
              ))}
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>🎯 Power Levels</Typography>
              {Object.entries(POWER_LEVELS).map(([key, v]) => (
                <Chip
                  key={key}
                  label={`${v.icon} ${v.label}`}
                  size="small"
                  sx={{ bgcolor: `${v.color}18`, color: v.color, fontWeight: 600, mr: 1, mb: 0.5 }}
                />
              ))}
            </Grid>
          </Grid>

          {stats?.overview && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>📈 System Statistics</Typography>
              <Grid container spacing={2}>
                {[
                  { label: 'Total Members', value: stats.overview.totalMembers, color: '#1890ff' },
                  { label: 'Average Power', value: stats.overview.averagePower, color: '#52c41a' },
                  { label: 'Highest Power', value: stats.overview.maxPower, color: '#fa8c16' },
                  { label: 'Total Power', value: stats.overview.totalPower, color: '#722ed1' },
                ].map((s, i) => (
                  <Grid item xs={6} sm={3} key={i}>
                    <Box textAlign="center">
                      <Typography variant="h5" fontWeight={700} sx={{ color: s.color }}>{s.value ?? '—'}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </CardContent>
      </Card>

      {/* User Power + Eligibility */}
      {walletAddress && userPower && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    <EmojiEventsIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#faad14' }} />
                    Your Voting Power
                  </Typography>
                  <IconButton onClick={handleRecalculate} disabled={calculating} size="small">
                    <RefreshIcon sx={{ animation: calculating ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
                  </IconButton>
                </Box>

                <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
                  <Tab label="Overview" />
                  <Tab label="Breakdown" />
                </Tabs>

                {tab === 0 && (
                  <Box>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <Typography variant="h3" fontWeight={800} sx={{ color: pl.color }}>
                        {userPower.totalVotingPower}
                      </Typography>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>VP</Typography>
                        <Chip label={`${pl.icon} ${pl.label}`} size="small" sx={{ bgcolor: `${pl.color}18`, color: pl.color, fontWeight: 600 }} />
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(pct, 100)}
                      sx={{ height: 8, borderRadius: 4, mb: 1, '& .MuiLinearProgress-bar': { bgcolor: pl.color } }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {userPower.totalVotingPower} / {userPower.maxPossiblePower || 1000} max
                    </Typography>
                  </Box>
                )}

                {tab === 1 && userPower.breakdown && (
                  <Box>
                    {[
                      { key: 'base', label: 'Base Power', icon: '⚡' },
                      { key: 'transactions', label: 'Blockchain Activity', icon: '🔗' },
                      { key: 'accountAge', label: 'Account Age', icon: '⏰' },
                      { key: 'participation', label: 'Community', icon: '🏛️' },
                    ].map(({ key, label, icon }) => {
                      const d = userPower.breakdown[key];
                      if (!d) return null;
                      return (
                        <Box key={key} sx={{ mb: 2 }}>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="body2" fontWeight={600}>{icon} {label}</Typography>
                            <Typography variant="body2" fontWeight={700}>{d.weighted || 0}</Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={d.weighted ? (d.weighted / (userPower.totalVotingPower || 1)) * 100 : 0}
                            sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {d.percentage || 0}% weight · {d.raw || 0} raw
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <HowToVoteIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Governance Eligibility
                </Typography>
                {eligibility.map((e) => {
                  const met = (userPower.totalVotingPower || 0) >= e.threshold;
                  return (
                    <Paper
                      key={e.label}
                      variant="outlined"
                      sx={{
                        p: 1.5, mb: 1, borderRadius: 2,
                        bgcolor: met ? 'rgba(76,175,80,0.06)' : 'rgba(244,67,54,0.06)',
                        borderColor: met ? 'success.light' : 'error.light',
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>{e.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {met
                          ? `✅ You can participate (${e.threshold} VP min)`
                          : `❌ Need ${e.threshold - (userPower.totalVotingPower || 0)} more VP`}
                      </Typography>
                    </Paper>
                  );
                })}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Leaderboard */}
      <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              <TrendingUpIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Voting Power Leaderboard
            </Typography>
            <IconButton onClick={loadAll} size="small"><RefreshIcon /></IconButton>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Member</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Level</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Voting Power</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaderboard.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography variant="body2" color="text.secondary" py={3}>No members yet</Typography>
                    </TableCell>
                  </TableRow>
                ) : leaderboard.map((m, idx) => {
                  const mpl = getPL(m.powerLevel);
                  return (
                    <TableRow key={m.walletAddress || idx} hover>
                      <TableCell>{lbPage * 20 + idx + 1}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>
                            {(m.username || m.walletAddress || '?')[0].toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" fontWeight={500}>
                            {m.username || `${(m.walletAddress || '').slice(0, 6)}...${(m.walletAddress || '').slice(-4)}`}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={`${mpl.icon} ${mpl.label}`} size="small"
                          sx={{ bgcolor: `${mpl.color}18`, color: mpl.color, fontWeight: 600 }} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700}>{m.totalVotingPower || 0} VP</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {lbTotal > 20 && (
            <TablePagination
              component="div" count={lbTotal} page={lbPage}
              onPageChange={handleLbPageChange} rowsPerPage={20} rowsPerPageOptions={[20]}
            />
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>💡 Tips to Increase Your Voting Power</Typography>
          <Grid container spacing={3}>
            {[
              { title: '🔗 Blockchain Activity', tips: ['Make regular transactions on Polygon', 'Interact with DeFi protocols', 'Maintain recent activity (last 30 days)', 'Build a long transaction history'] },
              { title: '🏛️ Community Participation', tips: ['Vote on governance cases consistently', 'Create quality governance proposals', 'Provide helpful feedback on cases', 'Maintain high accuracy in voting'] },
              { title: '⏰ Account Stability', tips: ['Maintain account over time', 'Keep consistent wallet activity', 'Build long-term engagement', 'Participate regularly in governance'] },
            ].map((section) => (
              <Grid item xs={12} md={4} key={section.title}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>{section.title}</Typography>
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                  {section.tips.map((t, i) => (
                    <Typography component="li" variant="body2" color="text.secondary" key={i} sx={{ mb: 0.5 }}>{t}</Typography>
                  ))}
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Snackbar open={toast.open} autoHideDuration={4000} onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default VotingPowerPage;
