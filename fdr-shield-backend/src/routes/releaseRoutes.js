const express = require('express');
const { body, validationResult } = require('express-validator');
const {
  submitRequest,
  getAllRequests,
  reviewRequest,
  approveRequest,
  rejectRequest,
} = require('../controllers/releaseController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
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

// 1. Submit Request (institution_admin only)
router.post(
  '/',
  authenticateToken,
  authorizeRole('institution_admin'),
  [
    body('fdr_id').isUUID().withMessage('Valid fdr_id UUID is required.'),
    body('reason').trim().notEmpty().withMessage('Reason is required.'),
  ],
  validate,
  auditLog('SUBMIT_RELEASE_REQUEST', 'RELEASE_REQUEST'),
  submitRequest
);

// 2. Get All Requests (institution_admin: own, officer+: all)
router.get('/', authenticateToken, getAllRequests);

// 3. Review Request (aicte_officer+)
router.patch(
  '/:id/review',
  authenticateToken,
  authorizeRole('aicte_officer', 'senior_official', 'competent_authority', 'system_admin'),
  auditLog('REVIEW_RELEASE_REQUEST', 'RELEASE_REQUEST'),
  reviewRequest
);

// 4. Approve Request (competent_authority only)
router.patch(
  '/:id/approve',
  authenticateToken,
  authorizeRole('competent_authority', 'system_admin'),
  auditLog('APPROVE_RELEASE_REQUEST', 'RELEASE_REQUEST'),
  approveRequest
);

// 5. Reject Request (competent_authority only)
router.patch(
  '/:id/reject',
  authenticateToken,
  authorizeRole('competent_authority', 'system_admin'),
  [body('reason').trim().notEmpty().withMessage('Rejection reason is required.')],
  validate,
  auditLog('REJECT_RELEASE_REQUEST', 'RELEASE_REQUEST'),
  rejectRequest
);

module.exports = router;
