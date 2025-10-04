const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  avatar: { type: String },
  bio: { type: String },
  email: { type: String },
  dateJoined: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
