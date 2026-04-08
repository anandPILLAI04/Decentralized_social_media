const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ethers } = require('ethers');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Exiting.');
  process.exit(1);
}

// In-memory nonce store. In production, use Redis or a DB collection.
const nonceStore = new Map();

/**
 * Generate a nonce for wallet signature verification (challenge-response).
 */
function generateNonce(walletAddress) {
  const nonce = crypto.randomBytes(32).toString('hex');
  const message = `Sign this message to authenticate with Crib.\n\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;
  nonceStore.set(walletAddress.toLowerCase(), { nonce, message, createdAt: Date.now() });
  return { nonce, message };
}

/**
 * Verify that a signed message was produced by the claimed wallet address
 * and that the nonce is valid (one-time use).
 */
function verifyWalletSignature(message, signature, expectedAddress) {
  try {
    const addr = expectedAddress.toLowerCase();
    const storedNonce = nonceStore.get(addr);

    // Check nonce exists
    if (!storedNonce) {
      return false;
    }

    // Check nonce hasn't expired (5 minute window)
    if (Date.now() - storedNonce.createdAt > 5 * 60 * 1000) {
      nonceStore.delete(addr);
      return false;
    }

    // Check message matches expected
    if (message !== storedNonce.message) {
      return false;
    }

    // Recover signer address from the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    const isValid = recoveredAddress.toLowerCase() === addr;

    // Consume nonce (one-time use)
    nonceStore.delete(addr);

    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Authentication middleware
 * Validates JWT tokens for protected routes.
 * Attaches `req.user` with the verified wallet address on success.
 */
const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header is required'
      });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Verify JWT only — no raw wallet address fallback
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.address) {
        req.user = { address: decoded.address.toLowerCase(), method: 'jwt' };
        return next();
      }
    } catch (_jwtErr) {
      // JWT invalid or expired
    }

    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Optional auth – same logic but allows unauthenticated access.
 * Sets req.user when a valid JWT token is present, otherwise continues.
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      req.user = null;
      return next();
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.address) {
        req.user = { address: decoded.address.toLowerCase(), method: 'jwt' };
        return next();
      }
    } catch (_jwtErr) { /* fall through */ }

    req.user = null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

/**
 * Generate a JWT for a verified wallet address.
 */
function generateToken(walletAddress) {
  return jwt.sign(
    { address: walletAddress.toLowerCase() },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = auth;
module.exports.auth = auth;
module.exports.optionalAuth = optionalAuth;
module.exports.generateToken = generateToken;
module.exports.generateNonce = generateNonce;
module.exports.verifyWalletSignature = verifyWalletSignature;