/**
 * Socket.IO WebSocket Service
 * Real-time event broadcasting for notifications, posts, and governance
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;

let io = null;

// Map of walletAddress → Set<socketId> for targeted notifications
const userSockets = new Map();

/**
 * Initialize Socket.IO on the HTTP server
 * @param {import('http').Server} httpServer
 */
function init(httpServer) {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling']
  });

  // Authenticate every socket connection via JWT before allowing events
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required: no token provided'));
    }

    if (!JWT_SECRET) {
      logger.error('JWT_SECRET is not configured');
      return next(new Error('Server authentication configuration error'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      // Attach the verified wallet address to the socket for later use
      socket.verifiedAddress = (decoded.walletAddress || decoded.address || '').toLowerCase();
      if (!socket.verifiedAddress) {
        return next(new Error('Authentication failed: token missing wallet address'));
      }
      next();
    } catch (err) {
      logger.warn('Socket JWT verification failed', { error: err.message, socketId: socket.id });
      return next(new Error('Authentication failed: invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('🔌 Socket connected (authenticated)', { id: socket.id, address: socket.verifiedAddress });

    // Client sends wallet address to register for targeted notifications.
    // Only the address verified by the JWT is allowed.
    socket.on('register', (walletAddress) => {
      if (!walletAddress) return;
      const addr = walletAddress.toLowerCase();

      // Ensure the requested address matches the JWT-verified address
      if (addr !== socket.verifiedAddress) {
        socket.emit('error', { message: 'Cannot register for a different wallet address' });
        logger.warn('Register rejected: address mismatch', {
          requested: addr,
          verified: socket.verifiedAddress,
          socketId: socket.id
        });
        return;
      }

      socket.walletAddress = addr;

      if (!userSockets.has(addr)) {
        userSockets.set(addr, new Set());
      }
      userSockets.get(addr).add(socket.id);

      // Join a personal room for easy targeting
      socket.join(`user:${addr}`);
      logger.info('👤 User registered for notifications', { address: addr, socketId: socket.id });
    });

    // Client can join topic rooms (e.g. governance case updates)
    socket.on('join', (room) => {
      if (room) {
        socket.join(room);
      }
    });

    socket.on('leave', (room) => {
      if (room) {
        socket.leave(room);
      }
    });

    socket.on('disconnect', (reason) => {
      if (socket.walletAddress) {
        const set = userSockets.get(socket.walletAddress);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) userSockets.delete(socket.walletAddress);
        }
      }
      logger.info('🔌 Socket disconnected', { id: socket.id, reason });
    });
  });

  logger.info('🔌 Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO server instance
 */
function getIO() {
  return io;
}

// ── Emit helpers ───────────────────────────────────────────────────────

/**
 * Send a notification to a specific user (all their connected sockets)
 */
function notifyUser(walletAddress, event, data) {
  if (!io || !walletAddress) return;
  io.to(`user:${walletAddress.toLowerCase()}`).emit(event, data);
}

/**
 * Broadcast a new post to all connected clients
 */
function broadcastNewPost(post) {
  if (!io) return;
  io.emit('post:new', post);
}

/**
 * Broadcast a post update (edit, like count, etc.)
 */
function broadcastPostUpdate(post) {
  if (!io) return;
  io.emit('post:updated', post);
}

/**
 * Broadcast a post deletion
 */
function broadcastPostDeleted(postId) {
  if (!io) return;
  io.emit('post:deleted', { postId });
}

/**
 * Broadcast a governance event to everyone in the governance room
 */
function broadcastGovernanceEvent(event, data) {
  if (!io) return;
  io.emit(`governance:${event}`, data);
}

/**
 * Broadcast new comment on a post
 */
function broadcastNewComment(postId, comment) {
  if (!io) return;
  io.emit('comment:new', { postId, comment });
}

/**
 * Get count of currently connected clients
 */
function getConnectedCount() {
  if (!io) return 0;
  return io.engine?.clientsCount || 0;
}

module.exports = {
  init,
  getIO,
  notifyUser,
  broadcastNewPost,
  broadcastPostUpdate,
  broadcastPostDeleted,
  broadcastGovernanceEvent,
  broadcastNewComment,
  getConnectedCount
};
