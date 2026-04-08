/**
 * Standardized API response helpers.
 * Usage:
 *   const { ok, fail } = require('../utils/apiResponse');
 *   res.json(ok({ user }));            // { success: true, data: { user } }
 *   res.status(404).json(fail('Not found'));  // { success: false, error: 'Not found' }
 */

function ok(data = {}) {
  return { success: true, ...data };
}

function fail(error, extra = {}) {
  return { success: false, error, ...extra };
}

module.exports = { ok, fail };
