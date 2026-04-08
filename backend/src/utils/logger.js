/**
 * Structured Logger — replaces raw console.log with winston
 *
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.info('Server started', { port: 4001 });
 *   logger.warn('Deprecated endpoint hit', { path: req.path });
 *   logger.error('DB query failed', { error: err.message });
 */

const { createLogger, format, transports } = require('winston');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';

// Custom format: compact, coloured for dev, JSON for prod
const devFormat = format.combine(
  format.timestamp({ format: 'HH:mm:ss' }),
  format.colorize(),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

const prodFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'crib-backend' },
  transports: [
    new transports.Console(),
    // In production, also write to files
    ...(isProduction
      ? [
          new transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error',
            maxsize: 5 * 1024 * 1024, // 5 MB
            maxFiles: 5,
          }),
          new transports.File({
            filename: path.join(__dirname, '../../logs/combined.log'),
            maxsize: 10 * 1024 * 1024, // 10 MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

// Create a morgan-compatible stream
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
