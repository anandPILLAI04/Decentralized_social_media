import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, Chip, CircularProgress,
  Alert, Snackbar, Tabs, Tab, TextField, Paper, Grid, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  LinearProgress, Switch, FormControlLabel
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import ArticleIcon from '@mui/icons-material/Article';
import ShieldIcon from '@mui/icons-material/Shield';
import GavelIcon from '@mui/icons-material/Gavel';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PolicyIcon from '@mui/icons-material/Policy';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import LockIcon from '@mui/icons-material/Lock';
import { adminAPI } from '../services/apiService';

const TAB_CONFIG = [
  { label: 'Overview', icon: <DashboardIcon /> },
  { label: 'Users', icon: <PeopleIcon /> },
  { label: 'Content', icon: <ArticleIcon /> },
  { label: 'Moderation', icon: <ShieldIcon /> },
  { label: 'Governance', icon: <GavelIcon /> },
  { label: 'Appeals', icon: <PolicyIcon /> },
  { label: 'Health', icon: <MonitorHeartIcon /> },
];

/* ---------- Stat Card ---------- */
const StatCard = ({ label, value, color = 'primary.main', sub }) => (
  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2, height: '100%' }}>
    <Typography variant="h5" fontWeight={700} sx={{ color }}>{value ?? '—'}</Typography>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    {sub && <Typography variant="caption" display="block" color="text.disabled">{sub}</Typography>}
  </Paper>
);

/* ---------- Key-Value Table ---------- */
const KVTable = ({ data, title }) => {
  if (!data || typeof data !== 'object') return null;
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object');
  if (entries.length === 0) return null;
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
      {title && <CardContent sx={{ pb: 0 }}><Typography variant="subtitle2" fontWeight={600}>{title}</Typography></CardContent>}
      <TableContainer>
        <Table size="small">
          <TableBody>
            {entries.map(([k, v]) => (
              <TableRow key={k}>
                <TableCell sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                  {k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                </TableCell>
                <TableCell align="right">{String(v)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
};

/* ---------- Alert chip ---------- */
const AlertChip = ({ severity }) => {
  const map = { critical: 'error', high: 'warning', medium: 'info', low: 'default' };
  return <Chip size="small" label={severity} color={map[severity] || 'default'} />;
};

/* ============================== */
/* ===== ADMIN DASHBOARD ======== */
/* ============================== */

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [adminKey, setAdminKey] = useState(localStorage.getItem('admin_key') || '');
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
  const [timeframe, setTimeframe] = useState('7d');

  const showToast = (message, severity = 'success') => setToast({ open: true, message, severity });

  // Auth check
  const handleLogin = async () => {
    if (!adminKey.trim()) {
      showToast('Please enter admin key', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await adminAPI.getOverview(adminKey, '7d');
      if (res.success) {
        setAuthenticated(true);
        localStorage.setItem('admin_key', adminKey);
        setData(res.data);
        showToast('Admin access granted');
      } else {
        showToast('Invalid admin key', 'error');
      }
    } catch (e) {
      if (e.status === 403) {
        showToast('Invalid admin key', 'error');
      } else {
        // Could still be valid — network error
        showToast(e.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthenticated(false);
    setAdminKey('');
    localStorage.removeItem('admin_key');
    setData(null);
  };

  // Fetch data for current tab
  const fetchTabData = useCallback(async () => {
    if (!authenticated) return;
    setLoading(true);
    setError(null);
    try {
      let res;
      switch (tab) {
        case 0: res = await adminAPI.getOverview(adminKey, timeframe); break;
        case 1: res = await adminAPI.getUsers(adminKey, timeframe); break;
        case 2: res = await adminAPI.getContent(adminKey, timeframe); break;
        case 3: res = await adminAPI.getModeration(adminKey, timeframe, true); break;
        case 4: res = await adminAPI.getGovernance(adminKey, timeframe); break;
        case 5: res = await adminAPI.getAppeals(adminKey, null, timeframe); break;
        case 6: res = await adminAPI.getHealth(adminKey); break;
        default: return;
      }
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error || 'Failed to load data');
      }
    } catch (e) {
      if (e.status === 403) {
        setAuthenticated(false);
        showToast('Session expired — please re-enter admin key', 'warning');
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [authenticated, adminKey, tab, timeframe]);

  useEffect(() => { fetchTabData(); }, [fetchTabData]);

  const handleExport = async (type) => {
    try {
      const res = await adminAPI.exportData(adminKey, type, timeframe, 'json');
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export_${timeframe}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`${type} data exported`);
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // ---- Login screen ----
  if (!authenticated) {
    return (
      <Box sx={{ maxWidth: 440, mx: 'auto', mt: 10, p: 3 }}>
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ textAlign: 'center', py: 4, px: 3 }}>
            <LockIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} gutterBottom>Admin Access</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter the platform admin key to access the dashboard.
            </Typography>
            <TextField
              fullWidth
              type="password"
              label="Admin Key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth variant="contained" size="large"
              onClick={handleLogin} disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Authenticate'}
            </Button>
            <Button sx={{ mt: 2 }} onClick={() => navigate('/home')}>Back to Home</Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // ---- Render tab content ----
  const renderContent = () => {
    if (loading) return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>;
    if (error) return <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>;
    if (!data) return <Typography color="text.secondary" textAlign="center" py={4}>No data available</Typography>;

    switch (tab) {
      case 0: return <OverviewTab data={data} />;
      case 1: return <UsersTab data={data} />;
      case 2: return <ContentTab data={data} />;
      case 3: return <ModerationTab data={data} />;
      case 4: return <GovernanceTab data={data} adminKey={adminKey} showToast={showToast} />;
      case 5: return <AppealsTab data={data} />;
      case 6: return <HealthTab data={data} />;
      default: return null;
    }
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/home')} sx={{ mb: 2 }}>Back to Home</Button>

      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={3}>
        <Typography variant="h4" fontWeight={700}>
          <DashboardIcon sx={{ mr: 1, verticalAlign: 'middle' }} /> Admin Dashboard
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <TextField
            select
            size="small"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            sx={{ minWidth: 100 }}
            SelectProps={{ native: true }}
          >
            <option value="1d">1 Day</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
          </TextField>
          <IconButton onClick={fetchTabData} title="Refresh"><RefreshIcon /></IconButton>
          <IconButton onClick={() => handleExport(TAB_CONFIG[tab].label.toLowerCase())} title="Export">
            <DownloadIcon />
          </IconButton>
          <Button size="small" color="warning" onClick={handleLogout}>Logout</Button>
        </Box>
      </Box>

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {TAB_CONFIG.map((t, i) => (
          <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" />
        ))}
      </Tabs>

      {renderContent()}

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

/* =========================== */
/* ====== TAB COMPONENTS ===== */
/* =========================== */

const OverviewTab = ({ data }) => {
  const { platformStats, growth, recentActivity } = data || {};
  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={2}>Platform Overview</Typography>
      {platformStats && (
        <Grid container spacing={2} mb={3}>
          {Object.entries(platformStats).map(([key, val]) => (
            <Grid item xs={6} sm={3} key={key}>
              <StatCard label={key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')} value={val} />
            </Grid>
          ))}
        </Grid>
      )}
      <KVTable data={growth} title="Growth Metrics" />
      <KVTable data={recentActivity} title="Recent Activity" />
      {/* Render any other top-level properties */}
      {Object.entries(data || {}).filter(([k]) => !['platformStats', 'growth', 'recentActivity'].includes(k)).map(([k, v]) => (
        typeof v === 'object' && v !== null ? <KVTable key={k} data={v} title={k.replace(/([A-Z])/g, ' $1')} /> : null
      ))}
    </Box>
  );
};

const UsersTab = ({ data }) => {
  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={2}>User Analytics</Typography>
      {data && typeof data === 'object' ? (
        Object.entries(data).map(([section, sData]) => (
          typeof sData === 'object' && sData !== null && !Array.isArray(sData) ? (
            <KVTable key={section} data={sData} title={section.replace(/([A-Z])/g, ' $1')} />
          ) : Array.isArray(sData) ? (
            <Card key={section} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>
                  {section.replace(/([A-Z])/g, ' $1')}
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {sData[0] && Object.keys(sData[0]).map(h => (
                          <TableCell key={h} sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                            {h.replace(/_/g, ' ')}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sData.slice(0, 20).map((row, i) => (
                        <TableRow key={i}>
                          {Object.values(row).map((v, j) => (
                            <TableCell key={j}>{typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          ) : (
            <StatCard key={section} label={section} value={sData} />
          )
        ))
      ) : (
        <Typography color="text.secondary">No user data available.</Typography>
      )}
    </Box>
  );
};

const ContentTab = ({ data }) => (
  <Box>
    <Typography variant="h6" fontWeight={600} mb={2}>Content Analytics</Typography>
    {data && typeof data === 'object' ? (
      Object.entries(data).map(([section, sData]) => (
        typeof sData === 'object' && sData !== null ? (
          <KVTable key={section} data={sData} title={section.replace(/([A-Z])/g, ' $1')} />
        ) : null
      ))
    ) : (
      <Typography color="text.secondary">No content data available.</Typography>
    )}
  </Box>
);

const ModerationTab = ({ data }) => (
  <Box>
    <Typography variant="h6" fontWeight={600} mb={2}>AI Moderation Analytics</Typography>
    {data && typeof data === 'object' ? (
      Object.entries(data).map(([section, sData]) => (
        typeof sData === 'object' && sData !== null && !Array.isArray(sData) ? (
          <KVTable key={section} data={sData} title={section.replace(/([A-Z])/g, ' $1')} />
        ) : Array.isArray(sData) ? (
          <Card key={section} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} mb={1}>{section.replace(/([A-Z])/g, ' $1')}</Typography>
              {sData.slice(0, 15).map((item, i) => (
                <Chip key={i} label={typeof item === 'object' ? JSON.stringify(item) : String(item)} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
              ))}
            </CardContent>
          </Card>
        ) : null
      ))
    ) : (
      <Typography color="text.secondary">No moderation data available.</Typography>
    )}
  </Box>
);

const GovernanceTab = ({ data, adminKey, showToast }) => {
  const [schedulerRunning, setSchedulerRunning] = useState(false);

  useEffect(() => {
    if (data?.scheduler?.status?.running !== undefined) {
      setSchedulerRunning(data.scheduler.status.running);
    }
  }, [data]);

  const toggleScheduler = async () => {
    try {
      const action = schedulerRunning ? 'stop' : 'start';
      const res = await adminAPI.schedulerAction(adminKey, action);
      if (res.success) {
        setSchedulerRunning(!schedulerRunning);
        showToast(`Scheduler ${action}ed`);
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={600}>Governance Analytics</Typography>
        <FormControlLabel
          control={<Switch checked={schedulerRunning} onChange={toggleScheduler} color="primary" />}
          label={schedulerRunning ? 'Scheduler Running' : 'Scheduler Stopped'}
        />
      </Box>
      {data && typeof data === 'object' ? (
        Object.entries(data).filter(([k]) => k !== 'scheduler').map(([section, sData]) => (
          typeof sData === 'object' && sData !== null ? (
            <KVTable key={section} data={sData} title={section.replace(/([A-Z])/g, ' $1')} />
          ) : null
        ))
      ) : (
        <Typography color="text.secondary">No governance data available.</Typography>
      )}
      {data?.scheduler && (
        <KVTable data={data.scheduler.stats || data.scheduler.status} title="Scheduler Status" />
      )}
    </Box>
  );
};

const AppealsTab = ({ data }) => {
  const { appeals = [], statistics = {} } = data || {};
  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={2}>Appeals Management</Typography>
      {statistics && (
        <Grid container spacing={2} mb={3}>
          {Object.entries(statistics).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
            <Grid item xs={6} sm={3} key={k}>
              <StatCard label={k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')} value={v} />
            </Grid>
          ))}
        </Grid>
      )}
      {appeals.length > 0 ? (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Appeal ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Content Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Submitted</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {appeals.map((a, i) => (
                <TableRow key={a.appealId || i}>
                  <TableCell>{a.appealId || a._id || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={a.status || '—'}
                      color={
                        a.status === 'approved' ? 'success' :
                        a.status === 'rejected' ? 'error' :
                        a.status === 'pending' ? 'warning' : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{a.reason?.replace(/_/g, ' ') || '—'}</TableCell>
                  <TableCell>{a.contentType || '—'}</TableCell>
                  <TableCell>{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography color="text.secondary" textAlign="center" py={4}>No pending appeals.</Typography>
      )}
    </Box>
  );
};

const HealthTab = ({ data }) => {
  const { health = {}, alerts = [] } = data || {};

  const getStatusIcon = (status) => {
    if (status === 'healthy' || status === 'ok' || status === true) return <CheckCircleIcon color="success" fontSize="small" />;
    if (status === 'warning' || status === 'degraded') return <WarningAmberIcon color="warning" fontSize="small" />;
    return <ErrorIcon color="error" fontSize="small" />;
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={2}>System Health</Typography>

      {health && typeof health === 'object' && (
        <Grid container spacing={2} mb={3}>
          {Object.entries(health).map(([section, sData]) => (
            typeof sData === 'object' && sData !== null ? (
              <Grid item xs={12} sm={6} key={section}>
                <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      {getStatusIcon(sData.status || sData.state)}
                      <Typography variant="subtitle2" fontWeight={600} textTransform="capitalize">
                        {section.replace(/([A-Z])/g, ' $1')}
                      </Typography>
                    </Box>
                    {Object.entries(sData).filter(([k, v]) => typeof v !== 'object').map(([k, v]) => (
                      <Typography key={k} variant="body2" color="text.secondary">
                        {k.replace(/([A-Z])/g, ' $1')}: <strong>{String(v)}</strong>
                      </Typography>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            ) : (
              <Grid item xs={6} sm={3} key={section}>
                <StatCard label={section} value={String(sData)} />
              </Grid>
            )
          ))}
        </Grid>
      )}

      {alerts.length > 0 && (
        <>
          <Typography variant="h6" fontWeight={600} mb={2}>Active Alerts</Typography>
          {alerts.map((alert, i) => (
            <Alert
              key={i}
              severity={alert.severity === 'critical' ? 'error' : alert.severity === 'high' ? 'warning' : 'info'}
              sx={{ mb: 1, borderRadius: 2 }}
            >
              <Typography variant="subtitle2">{alert.title || alert.type || 'Alert'}</Typography>
              <Typography variant="body2">{alert.message || alert.description || JSON.stringify(alert)}</Typography>
            </Alert>
          ))}
        </>
      )}

      {alerts.length === 0 && (
        <Alert severity="success" sx={{ borderRadius: 2 }}>
          <Typography variant="body2">No active alerts — system is healthy.</Typography>
        </Alert>
      )}
    </Box>
  );
};

export default AdminDashboard;
