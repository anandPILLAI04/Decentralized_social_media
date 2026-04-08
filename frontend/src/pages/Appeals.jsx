import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, Chip, CircularProgress,
  Alert, Snackbar, Tabs, Tab, TextField, MenuItem, Dialog,
  DialogTitle, DialogContent, DialogActions, Divider, Paper,
  Grid, IconButton, Pagination
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GavelIcon from '@mui/icons-material/Gavel';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { appealAPI } from '../services/apiService';

const STATUS_COLORS = {
  pending: 'warning',
  under_review: 'info',
  approved: 'success',
  rejected: 'error',
  escalated_to_community: 'secondary',
  withdrawn: 'default',
};

const STATUS_LABELS = {
  pending: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  escalated_to_community: 'Community Vote',
  withdrawn: 'Withdrawn',
};

const Appeals = ({ walletAddress }) => {
  const navigate = useNavigate();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [guidelines, setGuidelines] = useState(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [stats, setStats] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // New appeal dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    contentId: '',
    contentType: 'Post',
    reason: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [flaggedItems, setFlaggedItems] = useState([]);
  const [loadingFlagged, setLoadingFlagged] = useState(false);

  // Withdraw dialog
  const [withdrawDialog, setWithdrawDialog] = useState({ open: false, appealId: null });
  const [withdrawReason, setWithdrawReason] = useState('');

  const statusFilters = [null, 'pending', 'under_review', 'approved', 'rejected', 'escalated_to_community', 'withdrawn'];
  const statusFilter = statusFilters[tab] || null;

  useEffect(() => {
    loadAppeals();
    loadGuidelines();
    loadStats();
  }, [walletAddress, page, tab]);

  const loadAppeals = async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      const res = await appealAPI.getUserAppeals(walletAddress, statusFilter, page, 10);
      if (res.success) {
        setAppeals(res.appeals || []);
        setTotalPages(res.pagination?.totalPages || 1);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadGuidelines = async () => {
    try {
      const res = await appealAPI.getGuidelines();
      if (res.success) setGuidelines(res.guidelines);
    } catch { /* ignore */ }
  };

  const loadStats = async () => {
    try {
      const res = await appealAPI.getStats();
      if (res.success) setStats(res.statistics);
    } catch { /* ignore */ }
  };

  const loadFlaggedContent = async () => {
    if (!walletAddress) return;
    setLoadingFlagged(true);
    try {
      const res = await appealAPI.getFlaggedContent(walletAddress);
      if (res.success) setFlaggedItems(res.items || []);
    } catch { /* ignore */ }
    finally { setLoadingFlagged(false); }
  };

  useEffect(() => {
    if (dialogOpen) loadFlaggedContent();
  }, [dialogOpen]);

  const handleSubmitAppeal = async () => {
    if (!form.contentId || !form.reason || !form.description) {
      setToast({ open: true, message: 'Please fill all required fields', severity: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await appealAPI.submitAppeal({
        contentId: form.contentId,
        contentType: form.contentType,
        appealerAddress: walletAddress,
        reason: form.reason,
        description: form.description,
      });
      if (res.success) {
        setToast({ open: true, message: 'Appeal submitted successfully!', severity: 'success' });
        setDialogOpen(false);
        setForm({ contentId: '', contentType: 'Post', reason: '', description: '' });
        loadAppeals();
      } else {
        setToast({ open: true, message: res.error || 'Failed to submit', severity: 'error' });
      }
    } catch (e) {
      setToast({ open: true, message: e.message, severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawDialog.appealId) return;
    try {
      const res = await appealAPI.withdrawAppeal(withdrawDialog.appealId, walletAddress, withdrawReason);
      if (res.success) {
        setToast({ open: true, message: 'Appeal withdrawn', severity: 'info' });
        setWithdrawDialog({ open: false, appealId: null });
        setWithdrawReason('');
        loadAppeals();
      } else {
        setToast({ open: true, message: res.error || 'Failed to withdraw', severity: 'error' });
      }
    } catch (e) {
      setToast({ open: true, message: e.message, severity: 'error' });
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/home')} sx={{ mb: 2 }}>
        Back to Home
      </Button>

      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <GavelIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            My Appeals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Appeal moderation decisions you believe were incorrect.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          New Appeal
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats summary */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total Appeals', value: stats.total || 0, color: 'primary.main' },
            { label: 'Pending', value: stats.pending || 0, color: 'warning.main' },
            { label: 'Approved', value: stats.approved || 0, color: 'success.main' },
            { label: 'Rejected', value: stats.rejected || 0, color: 'error.main' },
          ].map((s, i) => (
            <Grid item xs={6} sm={3} key={i}>
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                <Typography variant="h5" fontWeight={700} sx={{ color: s.color }}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Guidelines toggle */}
      <Button
        size="small"
        startIcon={<InfoOutlinedIcon />}
        endIcon={showGuidelines ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => setShowGuidelines(!showGuidelines)}
        sx={{ mb: 2 }}
      >
        Appeal Guidelines
      </Button>

      {showGuidelines && guidelines && (
        <Card variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>Guidelines</Typography>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {guidelines.guidelines?.map((g, i) => (
                <Typography component="li" variant="body2" color="text.secondary" key={i} sx={{ mb: 0.5 }}>{g}</Typography>
              ))}
            </Box>
            {guidelines.estimatedProcessingTimes && (
              <Box mt={2}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>Processing Times</Typography>
                {Object.entries(guidelines.estimatedProcessingTimes).map(([k, v]) => (
                  <Typography variant="body2" color="text.secondary" key={k}>
                    {k.replace(/_/g, ' ')}: <strong>{v}</strong>
                  </Typography>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_e, v) => { setTab(v); setPage(1); }}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="All" />
        <Tab label="Pending" />
        <Tab label="Under Review" />
        <Tab label="Approved" />
        <Tab label="Rejected" />
        <Tab label="Community Vote" />
        <Tab label="Withdrawn" />
      </Tabs>

      {/* Appeals list */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
      ) : appeals.length === 0 ? (
        <Box textAlign="center" py={8}>
          <GavelIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No appeals found</Typography>
          <Typography variant="body2" color="text.disabled">
            {tab === 0 ? "You haven't submitted any appeals yet." : "No appeals with this status."}
          </Typography>
        </Box>
      ) : (
        <>
          {appeals.map((appeal) => (
            <Card key={appeal.appealId || appeal._id} variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                  <Box>
                    <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                      <Chip
                        label={STATUS_LABELS[appeal.status] || appeal.status}
                        color={STATUS_COLORS[appeal.status] || 'default'}
                        size="small"
                      />
                      <Chip
                        label={appeal.contentType || 'Post'}
                        variant="outlined"
                        size="small"
                      />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(appeal.submittedAt || appeal.createdAt)}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {appeal.reason?.replace(/_/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase()) || 'Appeal'}
                    </Typography>
                  </Box>
                  <Box display="flex" gap={1}>
                    <IconButton size="small" onClick={() => setExpandedId(expandedId === appeal.appealId ? null : appeal.appealId)}>
                      {expandedId === appeal.appealId ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                    {['pending', 'under_review'].includes(appeal.status) && (
                      <Button
                        size="small"
                        color="warning"
                        onClick={() => setWithdrawDialog({ open: true, appealId: appeal.appealId })}
                      >
                        Withdraw
                      </Button>
                    )}
                  </Box>
                </Box>

                {expandedId === appeal.appealId && (
                  <Box mt={2}>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Description:</strong> {appeal.description || '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      <strong>Content ID:</strong> {appeal.contentId || '—'}
                    </Typography>
                    {appeal.resolution && (
                      <Paper variant="outlined" sx={{ p: 1.5, mt: 1, borderRadius: 2, bgcolor: 'grey.50' }}>
                        <Typography variant="subtitle2" fontWeight={600}>Resolution</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Decision: <strong>{appeal.resolution.decision}</strong>
                        </Typography>
                        {appeal.resolution.reasoning && (
                          <Typography variant="body2" color="text.secondary">
                            Reasoning: {appeal.resolution.reasoning}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.disabled">
                          Resolved: {formatDate(appeal.resolution.decisionDate || appeal.resolvedAt)}
                        </Typography>
                      </Paper>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination count={totalPages} page={page} onChange={(_e, v) => setPage(v)} color="primary" />
            </Box>
          )}
        </>
      )}

      {/* New Appeal Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit New Appeal</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {loadingFlagged ? (
              <Box display="flex" justifyContent="center" py={2}><CircularProgress size={24} /></Box>
            ) : flaggedItems.length > 0 ? (
              <TextField
                select
                label="Select Flagged Content"
                value={form.contentId}
                onChange={(e) => {
                  const item = flaggedItems.find(i => String(i.id) === e.target.value);
                  setForm({
                    ...form,
                    contentId: e.target.value,
                    contentType: item?.type || 'Post',
                  });
                }}
                fullWidth
                required
                helperText="Choose the flagged post or comment you want to appeal"
              >
                {flaggedItems.map((item) => (
                  <MenuItem key={item.id} value={String(item.id)}>
                    <Box>
                      <Typography variant="body2" noWrap>
                        [{item.type}] {item.content || '(no text)'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Reason: {item.reason}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <Alert severity="info">
                No flagged content found. Only posts or comments that have been flagged by moderation can be appealed.
              </Alert>
            )}

            <TextField
              select
              label="Reason for Appeal"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              fullWidth
              required
            >
              {(guidelines?.appealReasons || [
                { value: 'false_positive', label: 'False Positive' },
                { value: 'context_misunderstood', label: 'Context Misunderstood' },
                { value: 'cultural_difference', label: 'Cultural Difference' },
                { value: 'sarcasm_humor', label: 'Sarcasm/Humor' },
                { value: 'educational_content', label: 'Educational Content' },
                { value: 'artistic_expression', label: 'Artistic Expression' },
                { value: 'technical_error', label: 'Technical Error' },
                { value: 'other', label: 'Other' },
              ]).map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                  {r.description && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      — {r.description}
                    </Typography>
                  )}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Detailed Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              fullWidth
              multiline
              rows={4}
              required
              helperText="Explain why you believe the moderation decision was incorrect"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitAppeal} disabled={submitting || flaggedItems.length === 0}>
            {submitting ? <CircularProgress size={20} /> : 'Submit Appeal'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={withdrawDialog.open} onClose={() => setWithdrawDialog({ open: false, appealId: null })} maxWidth="xs" fullWidth>
        <DialogTitle>Withdraw Appeal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Are you sure you want to withdraw this appeal? This action cannot be undone.
          </Typography>
          <TextField
            label="Reason (optional)"
            value={withdrawReason}
            onChange={(e) => setWithdrawReason(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawDialog({ open: false, appealId: null })}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleWithdraw}>Withdraw</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast({ ...toast, open: false })}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default Appeals;
