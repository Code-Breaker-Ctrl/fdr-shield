const express = require('express');
const { body, validationResult } = require('express-validator');
const {
  createFDR,
  getAllFDRs,
  getFDRById,
  updateFDR,
  verifyFDR,
  flagDiscrepancy,
} = require('../controllers/fdrController');
const { extractAndCompare } = require('../controllers/ocrController');
const { authenticateToken, optionalAuthenticateToken, authorizeRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((e) => ({ field: e.path || e.param, message: e.msg })),
    });
  }
  next();
};

const fdrValidation = [
  body('fdr_number').trim().notEmpty().withMessage('fdr_number is required.'),
  body('bank_name').trim().notEmpty().withMessage('bank_name is required.'),
  body('branch_name').trim().notEmpty().withMessage('branch_name is required.'),
  body('ifsc_code').trim().notEmpty().withMessage('ifsc_code is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than 0.'),
  body('issue_date').isISO8601().toDate().withMessage('issue_date must be a valid date.'),
  body('maturity_date').isISO8601().toDate().withMessage('maturity_date must be a valid date.'),
];

// 1. Create FDR
router.post(
  '/',
  authenticateToken,
  authorizeRole('institution_admin', 'aicte_officer', 'system_admin'),
  fdrValidation,
  validate,
  auditLog('CREATE_FDR', 'FDR'),
  createFDR
);

// 2. Get All FDRs (Optional token - public overview displays real database ledger)
router.get('/', optionalAuthenticateToken, getAllFDRs);

// 3. Get FDR By ID
router.get('/:id', authenticateToken, getFDRById);

// 4. Update FDR
router.put(
  '/:id',
  authenticateToken,
  authorizeRole(
    'institution_admin',
    'aicte_officer',
    'senior_official',
    'competent_authority',
    'system_admin'
  ),
  auditLog('UPDATE_FDR', 'FDR'),
  updateFDR
);

// 5. Verify FDR
router.patch(
  '/:id/verify',
  authenticateToken,
  authorizeRole('aicte_officer', 'senior_official', 'competent_authority', 'system_admin'),
  auditLog('VERIFY_FDR', 'FDR'),
  verifyFDR
);

// 6. Flag Discrepancy
router.patch(
  '/:id/flag',
  authenticateToken,
  authorizeRole('aicte_officer', 'senior_official', 'competent_authority', 'system_admin'),
  [body('notes').trim().notEmpty().withMessage('Discrepancy notes are required.')],
  validate,
  auditLog('FLAG_DISCREPANCY', 'FDR'),
  flagDiscrepancy
);

// 7. OCR Extract & Compare
router.post(
  '/:id/ocr-extract',
  authenticateToken,
  authorizeRole('aicte_officer', 'senior_official', 'system_admin'),
  auditLog('OCR_EXTRACT_COMPARE', 'FDR'),
  extractAndCompare
);

module.exports = router;
