const express = require('express');
const router = express.Router();
const User = require('../models/User');

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { walletAddress, username, avatar, bio, email } = req.body;
    if (!walletAddress || !username) {
      return res.status(400).json({ error: 'walletAddress and username are required.' });
    }
    // Check if user already exists
    const existing = await User.findOne({ walletAddress });
    if (existing) {
      return res.status(409).json({ error: 'User already exists.' });
    }
    // Create new user
    const user = new User({ walletAddress, username, avatar, bio, email });
    await user.save();
    res.status(201).json({ message: 'User created successfully', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required.' });
    }
    const user = await User.findOne({ walletAddress });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ message: 'Login successful', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
