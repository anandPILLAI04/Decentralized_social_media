import React, { useState } from "react";
import { Dialog, DialogTitle, DialogContent, Button, Box, Typography, TextField, Divider, Avatar } from "@mui/material";
import GoogleIcon from '@mui/icons-material/Google';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

export default function AuthModal({ open, onWalletConnect, onGoogleSignIn, onManualSignUp, walletConnected, googleProfile }) {
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });

  const handleManualSubmit = (e) => {
    e.preventDefault();
    onManualSignUp(form);
  };

  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', fontWeight: 700 }}>Sign Up / Log In</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} alignItems="center" mb={2}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AccountBalanceWalletIcon />}
            onClick={onWalletConnect}
            fullWidth
            sx={{ fontWeight: 700, borderRadius: 3 }}
            disabled={walletConnected}
          >
            {walletConnected ? "Wallet Connected" : "Connect Wallet (Required)"}
          </Button>
          <Divider flexItem>or</Divider>
          {googleProfile ? (
            <Box display="flex" alignItems="center" gap={1}>
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
              sx={{ fontWeight: 700, borderRadius: 3 }}
            >
              Sign in with Google
            </Button>
          )}
          <Divider flexItem>or</Divider>
          {!manual ? (
            <Button
              variant="text"
              color="secondary"
              onClick={() => setManual(true)}
              fullWidth
              sx={{ fontWeight: 700, borderRadius: 3 }}
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
              <Button type="submit" variant="contained" color="primary" sx={{ fontWeight: 700, borderRadius: 3 }}>
                Continue
              </Button>
            </Box>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
          Connecting a wallet is required to use the platform.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
