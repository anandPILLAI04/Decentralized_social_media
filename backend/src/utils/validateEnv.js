/**
 * Environment variable validation
 *
 * Checks that all required env vars are present at startup.
 * Warns about missing optional vars that degrade functionality.
 */

const logger = require('./logger');

const REQUIRED = [
  { key: 'MONGO_URI', fallback: 'mongodb://localhost:27017/decentralized_social', message: 'Using local MongoDB' },
  { key: 'JWT_SECRET', message: 'JWT_SECRET is required for authentication security' },
];

const RECOMMENDED = [
  { key: 'PINATA_API_KEY', message: 'IPFS uploads via Pinata will fail' },
  { key: 'PINATA_API_SECRET', message: 'IPFS uploads via Pinata will fail' },
  { key: 'HUGGING_FACE_API_KEY', message: 'AI moderation will use fallback mode' },
  { key: 'FRONTEND_URL', message: 'CORS will only allow localhost origins' },
];

const OPTIONAL = [
  { key: 'PORT', default: '4001' },
  { key: 'NODE_ENV', default: 'development' },
  { key: 'LOG_LEVEL', default: 'debug' },
  { key: 'ENABLE_AUTO_EXECUTION', default: 'false' },
  { key: 'ENABLE_NOTIFICATION_SCHEDULER', default: 'true' },
  { key: 'AMOY_RPC_URL', default: 'https://rpc-amoy.polygon.technology' },
  { key: 'PRIVATE_KEY', message: 'Blockchain transactions will be unavailable' },
];

function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  let hasErrors = false;

  logger.info('🔍 Validating environment variables...');

  // Required vars — fatal in production, warn in dev
  for (const { key, fallback, message } of REQUIRED) {
    if (!process.env[key]) {
      if (fallback) {
        process.env[key] = fallback;
        logger.warn(`⚠️  ${key} not set. ${message || `Defaulting to: ${fallback}`}`);
      } else if (isProduction) {
        logger.error(`❌ Required env var missing: ${key}`);
        hasErrors = true;
      } else {
        logger.warn(`⚠️  Required env var missing: ${key} — will fail at runtime`);
      }
    }
  }

  // Recommended vars — always warn
  for (const { key, message } of RECOMMENDED) {
    if (!process.env[key]) {
      logger.warn(`⚠️  ${key} not set. ${message}`);
    }
  }

  // Optional vars — info only
  for (const { key, default: def, message } of OPTIONAL) {
    if (!process.env[key] && def) {
      process.env[key] = process.env[key] || def;
    }
  }

  if (hasErrors) {
    logger.error('💀 Missing required environment variables. Exiting.');
    process.exit(1);
  }

  logger.info('✅ Environment validation complete');
}

module.exports = validateEnv;
