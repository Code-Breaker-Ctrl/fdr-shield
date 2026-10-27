const crypto = require('crypto');
const { query } = require('../config/db');

/**
 * Computes SHA-256 hash linking previous audit log row to current action
 */
const computeAuditHash = (prevHash, userId, action, entityType, entityId, timestamp) => {
  const payload = `${prevHash}|${userId || 'SYSTEM'}|${action}|${entityType}|${entityId || 'NONE'}|${timestamp}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
};

/**
 * Direct helper to write an immutable audit log entry from inside any controller or service
 */
const recordAudit = async ({
  user_id,
  action,
  entity_type,
  entity_id,
  ip_address,
  details = {},
}) => {
  try {
    const timestamp = new Date().toISOString();

    // Fetch latest hash in audit_logs to chain the record
    let prevHash = '0'.repeat(64);
    try {
      const lastRow = await query(
        'SELECT current_hash FROM audit_logs ORDER BY id DESC LIMIT 1'
      );
      if (lastRow.rows.length > 0 && lastRow.rows[0].current_hash) {
        prevHash = lastRow.rows[0].current_hash;
      }
    } catch (_) {
      // Fallback if current_hash column is not present yet
    }

    const currentHash = computeAuditHash(
      prevHash,
      user_id,
      action,
      entity_type,
      entity_id,
      timestamp
    );

    const insertSql = `
      INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        ip_address,
        details,
        prev_hash,
        current_hash,
        timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;

    await query(insertSql, [
      user_id || null,
      action,
      entity_type,
      entity_id ? String(entity_id) : null,
      ip_address || '127.0.0.1',
      JSON.stringify(details),
      prevHash,
      currentHash,
      timestamp,
    ]);
  } catch (err) {
    // Fallback to minimal 6-column insert if schema only has the basic columns
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user_id || null,
          action,
          entity_type,
          entity_id ? String(entity_id) : null,
          ip_address || '127.0.0.1',
          new Date().toISOString(),
        ]
      );
    } catch (fallbackErr) {
      console.error('[AUDIT LOG ERROR] Failed to write audit log:', fallbackErr.message);
    }
  }
};

/**
 * Express Middleware factory to automatically log route actions after a successful response
 * Usage: router.post('/submit', authenticateToken, auditLog('FDR_SUBMITTED', 'FDR'), controller)
 */
const auditLog = (action, entity_type = 'FDR') => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      // Only log if request succeeded (2xx status code)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const userId = req.user ? req.user.id : body?.data?.user?.id || null;
        const entityId =
          req.params?.id ||
          req.params?.fdrId ||
          body?.data?.id ||
          body?.fdr?.id ||
          body?.id ||
          null;

        const ipAddress =
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
          req.socket?.remoteAddress ||
          req.ip ||
          '127.0.0.1';

        // Fire-and-forget audit recording so response latency isn't blocked
        recordAudit({
          user_id: userId,
          action: action || `${req.method}_${req.baseUrl}`,
          entity_type,
          entity_id: entityId,
          ip_address: ipAddress,
          details: {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
          },
        });
      }

      return originalJson(body);
    };

    next();
  };
};

module.exports = {
  auditLog,
  recordAudit,
};