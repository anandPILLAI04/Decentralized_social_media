const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const morgan = require("morgan");

// Load environment variables first
dotenv.config();

// Structured logger & env validation (must come after dotenv)
const logger = require("./utils/logger");
const validateEnv = require("./utils/validateEnv");
validateEnv();

// Rate limiters
const { generalLimiter, authLimiter, createLimiter, uploadLimiter } = require("./middleware/rateLimiter");

// Import routes and database connection
const connectDB = require("./config/db");
const moderationRoutes = require("./api/moderationRoutes");
const blockchainRoutes = require("./api/blockchainRoutes");
const socialRoutes = require("./api/socialRoutes");
const enhancedGovernanceRoutes = require("./api/enhancedGovernanceRoutes");
const evidenceRoutes = require("./api/evidenceRoutes");
const authRoutes = require("./api/authRoutes");
const notificationRoutes = require("./api/notificationRoutes");
const appealRoutes = require("./api/appealRoutes");
const adminRoutes = require("./api/adminRoutes");
const userModerationRoutes = require("./api/userModerationRoutes");
const votingPowerRoutes = require("./api/votingPowerRoutes");
const caseExecutionRoutes = require("./api/caseExecutionRoutes");
const executionScheduler = require("./services/executionScheduler");
const notificationScheduler = require("./services/notificationScheduler");
const socketService = require("./services/socketService");

// Connect to MongoDB
connectDB();

const app = express();

// ── CORS (must be first so preflight OPTIONS always gets headers) ────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== 'production') {
      callback(null, true); // Allow all in dev
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-wallet-address'],
}));

// ── Body parsing ─────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Security middleware ──────────────────────────────────────────────
app.use(helmet());                     // Sets secure HTTP headers
app.use(mongoSanitize());             // Prevents NoSQL injection ($gt, $ne, etc.)
app.use(hpp());                        // Prevents HTTP parameter pollution

// Global rate limiter — disabled in development for testing, enabled in production
if (process.env.NODE_ENV === 'production') {
  app.use(generalLimiter);
}

// ── HTTP request logging ─────────────────────────────────────────────
app.use(morgan('short', { stream: logger.stream }));

// ── Route-specific rate limiters ─────────────────────────────────────
app.use('/api/auth', authLimiter);
app.use('/api/social/upload', uploadLimiter);
// Apply createLimiter only to POST/PUT/DELETE on posts (not GET reads)
app.use('/api/social/posts', (req, res, next) => {
  if (req.method === 'GET') return next(); // skip rate-limit for reads
  return createLimiter(req, res, next);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Crib Social Media Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      social: '/api/social',
      governance: '/api/enhanced-governance',
      'voting-power': '/api/voting-power',
      'case-execution': '/api/case-execution',
      blockchain: '/api/blockchain',
      moderation: '/api/moderation'
    },
    documentation: 'See /docs for full API documentation'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    wsConnections: socketService.getConnectedCount()
  });
});

// API Routes
app.use("/api/moderation", moderationRoutes);
app.use("/api/user-moderation", userModerationRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/governance", enhancedGovernanceRoutes); // Unified governance API (case-based)
app.use("/api/enhanced-governance", enhancedGovernanceRoutes); // Legacy alias — frontend components use this path
app.use("/api/evidence", evidenceRoutes); // Evidence management API
app.use("/api/voting-power", votingPowerRoutes); // Voting power calculation API
app.use("/api/case-execution", caseExecutionRoutes); // Case execution engine API
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api", appealRoutes); // Appeals routes
app.use("/api/admin", adminRoutes); // Admin dashboard routes

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: status === 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { message: err.message, stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

const PORT = process.env.PORT || 4001;

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
socketService.init(server);

server.listen(PORT, () => {
  logger.info(`🚀 Backend server running on http://localhost:${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  
  // Start the automated execution scheduler if enabled
  if (process.env.ENABLE_AUTO_EXECUTION === 'true') {
    logger.info('🤖 Starting automated case execution scheduler...');
    executionScheduler.startScheduler();
  } else {
    logger.info('ℹ️  Automated execution is disabled. Set ENABLE_AUTO_EXECUTION=true to enable.');
  }
  
  // Start the notification scheduler if enabled
  if (process.env.ENABLE_NOTIFICATION_SCHEDULER !== 'false') {
    logger.info('🔔 Starting governance notification scheduler...');
    setTimeout(() => {
      const status = notificationScheduler.getStatus();
      logger.info('📬 Notification scheduler status', status);
    }, 6000);
  } else {
    logger.info('ℹ️  Notification scheduler is disabled.');
  }
});
