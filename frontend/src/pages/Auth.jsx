import React, { useState } from "react";
import { Box, Paper, Typography, Button, Divider, Avatar, TextField, FormControlLabel, Switch } from "@mui/material";
import GoogleIcon from '@mui/icons-material/Google';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

export default function Auth({
  onWalletConnect,
  onGoogleSignIn,
  onManualSignUp,
  walletConnected,
  googleProfile
}) {
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", agree: false });

  const handleManualSubmit = (e) => {
    e.preventDefault();
    onManualSignUp(form);
  };

  return (
    <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" bgcolor="#f7f8fa">
      <Paper elevation={3} sx={{ p: 5, borderRadius: 4, width: 420, maxWidth: '95vw' }}>
        <Typography variant="h4" fontWeight={700} textAlign="center" mb={2}>
          Welcome to Decentralized Social Media
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" textAlign="center" mb={3}>
          Sign up or log in to get started. Connecting your wallet is required.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AccountBalanceWalletIcon />}
          onClick={onWalletConnect}
          fullWidth
          sx={{ fontWeight: 700, borderRadius: 3, mb: 2 }}
          disabled={walletConnected}
        >
          {walletConnected ? "Wallet Connected" : "Connect Wallet (Required)"}
        </Button>
        <Divider sx={{ my: 2 }}>or</Divider>
        {googleProfile ? (
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Avatar src={googleProfile.imageUrl} />
            <Typography>{googleProfile.name}</Typography>
          </Box>
        ) : (
          <Button
            variant="outlined"
            color="primary"
            startIcon={<GoogleIcon />}
            onClick={onGoogleSignIn}
            fullWidth
            sx={{ fontWeight: 700, borderRadius: 3, mb: 2 }}
          >
            Sign in with Google
          </Button>
        )}
        <Divider sx={{ my: 2 }}>or</Divider>
        {!manual ? (
          <Button
            variant="text"
            color="secondary"
            onClick={() => setManual(true)}
            fullWidth
            sx={{ fontWeight: 700, borderRadius: 3, mb: 2 }}
          >
            Sign up manually
          </Button>
        ) : (
          <Box component="form" onSubmit={handleManualSubmit} width="100%" display="flex" flexDirection="column" gap={2}>
            <TextField
              label="Name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              fullWidth
            />
            <FormControlLabel
              control={<Switch checked={form.agree} onChange={e => setForm({ ...form, agree: e.target.checked })} color="primary" />}
              label={<Typography variant="body2">I agree to the Terms and Privacy Policy</Typography>}
              sx={{ alignItems: 'flex-start' }}
            />
            <Button type="submit" variant="contained" color="primary" sx={{ fontWeight: 700, borderRadius: 3 }} disabled={!form.agree}>
              Continue
            </Button>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" textAlign="center" display="block" mt={3}>
          Connecting a wallet is required to use the platform.<br />
          Your data is secure and never shared without your consent.
        </Typography>
      </Paper>
    </Box>
  );
}
