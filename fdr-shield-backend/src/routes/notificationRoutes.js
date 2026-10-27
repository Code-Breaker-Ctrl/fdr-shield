const express = require('express');
const { getNotifications } = require('../controllers/alertController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/notifications
 * Returns last 20 alerts relevant to req.user
 */
router.get('/', authenticateToken, getNotifications);

module.exports = router;
