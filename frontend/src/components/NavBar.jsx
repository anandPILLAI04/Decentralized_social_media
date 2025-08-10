import React from "react";
import { Link, useLocation } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";

const navLinks = [
  { label: "Home", path: "/" },
  { label: "Profile", path: "/profile" },
  { label: "Create Post", path: "/create" },
  { label: "Governance", path: "/governance" },
];

export default function NavBar({ walletAddress, onWalletConnect, connecting }) {
  const location = useLocation();
  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Decentralized Social
        </Typography>
        <Box>
          {navLinks.map((link) => (
            <Button
              key={link.path}
              component={Link}
              to={link.path}
              color={location.pathname === link.path ? "primary" : "inherit"}
              sx={{ fontWeight: location.pathname === link.path ? 700 : 400 }}
            >
              {link.label}
            </Button>
          ))}
        </Box>
        <Box ml={3}>
          {walletAddress ? (
            <Button variant="outlined" color="primary" sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700 }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={onWalletConnect}
              disabled={connecting}
              sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700 }}
            >
              {connecting ? "Connecting..." : "Connect Wallet"}
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
