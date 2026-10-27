const express = require('express');
const {
  getAllInstitutions,
  getInstitutionById,
} = require('../controllers/institutionController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// 1. Get All Institutions with FDR breakdown (officer+ only)
router.get(
  '/',
  authenticateToken,
  authorizeRole('aicte_officer', 'senior_official', 'competent_authority', 'system_admin'),
  getAllInstitutions
);

// 2. Get Single Institution By ID (officer+ or matching institution_admin)
router.get(
  '/:id',
  authenticateToken,
  getInstitutionById
);

module.exports = router;
