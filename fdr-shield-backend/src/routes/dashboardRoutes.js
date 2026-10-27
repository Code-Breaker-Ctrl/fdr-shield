const express = require('express');
const {
  getOfficerDashboard,
  getInstitutionDashboard,
  getRiskDashboard,
} = require('../controllers/dashboardController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/dashboard/summary
 * Officer+ overview
 */
router.get(
  '/summary',
  authenticateToken,
  authorizeRole('aicte_officer', 'senior_official', 'competent_authority', 'system_admin'),
  getOfficerDashboard
);

/**
 * GET /api/dashboard/my-summary
 * Institution Admin view
 */
router.get(
  '/my-summary',
  authenticateToken,
  authorizeRole('institution_admin'),
  getInstitutionDashboard
);

/**
 * GET /api/dashboard/risk
 * Officer+ risk analysis
 */
router.get(
  '/risk',
  authenticateToken,
  authorizeRole('aicte_officer', 'senior_official', 'competent_authority', 'system_admin'),
  getRiskDashboard
);

module.exports = router;
