/**
 * Rate Limiting Configuration
 *
 * Different limiters for different endpoint categories.
 * Uses express-rate-limit with in-memory store (swap for Redis in production).
 */

const rateLimit = require('express-rate-limit');

// General API limiter — 300 requests per 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests — please try again later.',
    retryAfter: '15 minutes',
  },
});

// Auth endpoints — stricter to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts — please try again in 15 minutes.',
  },
});

// Content creation — moderate limit
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Posting too frequently — please slow down.',
  },
});

// File upload — tighter limit
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many uploads — please try again later.',
  },
});

// Search — allow generous searching
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many search requests — please slow down.',
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  createLimiter,
  uploadLimiter,
  searchLimiter,
};
