const express = require("express");
const cors = require("cors");
const moderationRoutes = require("./api/moderationRoutes");
const blockchainRoutes = require("./api/blockchainRoutes");
const socialRoutes = require("./api/socialRoutes");
const governanceRoutes = require("./api/governanceRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use("/api/moderation", moderationRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/governance", governanceRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
