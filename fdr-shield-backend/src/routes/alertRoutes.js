const express = require('express');
const {
  getAlerts,
  triggerManualCheck,
  getNotifications,
} = require('../controllers/alertController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/alerts
 * Scoped for institution_admin, global for officer+
 */
router.get('/', authenticateToken, getAlerts);

/**
 * POST /api/alerts/trigger-check
 * Immediate manual execution (system_admin only)
 */
router.post(
  '/trigger-check',
  authenticateToken,
  authorizeRole('system_admin'),
  triggerManualCheck
);

module.exports = router;
