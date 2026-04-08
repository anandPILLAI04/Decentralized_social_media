/**
 * Input Validation Helpers
 *
 * Lightweight validation functions for API route input sanitization.
 * No external dependencies required.
 */

/**
 * Validates an Ethereum wallet address.
 * Must start with '0x' followed by exactly 40 hexadecimal characters (42 total).
 *
 * @param {*} address - The value to validate
 * @returns {boolean} True if the address is a valid hex wallet address
 */
function isValidWalletAddress(address) {
  if (typeof address !== 'string') return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

/**
 * Validates a username.
 * Must be 3-30 characters, containing only alphanumeric characters and underscores.
 *
 * @param {*} username - The value to validate
 * @returns {boolean} True if the username meets the format requirements
 */
function isValidUsername(username) {
  if (typeof username !== 'string') return false;
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

/**
 * Sanitizes a string by trimming whitespace and truncating to a maximum length.
 * Returns an empty string for non-string inputs.
 *
 * @param {*} str - The value to sanitize
 * @param {number} maxLength - Maximum allowed length after trimming
 * @returns {string} The sanitized string
 */
function sanitizeString(str, maxLength) {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (maxLength && trimmed.length > maxLength) {
    return trimmed.substring(0, maxLength);
  }
  return trimmed;
}

/**
 * Checks whether a value is a non-empty string after trimming.
 *
 * @param {*} str - The value to check
 * @returns {boolean} True if the value is a string with content after trimming
 */
function isNonEmptyString(str) {
  return typeof str === 'string' && str.trim().length > 0;
}

module.exports = {
  isValidWalletAddress,
  isValidUsername,
  sanitizeString,
  isNonEmptyString
};
