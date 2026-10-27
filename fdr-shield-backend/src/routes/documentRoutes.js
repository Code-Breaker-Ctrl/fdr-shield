const express = require('express');
const {
  upload,
  uploadDocument,
  getDocuments,
  deleteDocument,
} = require('../controllers/documentController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');

const router = express.Router();

// 1. Upload Document (institution_admin, aicte_officer, senior_official, competent_authority, system_admin)
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  auditLog('UPLOAD_DOCUMENT', 'DOCUMENT'),
  uploadDocument
);

// 2. Get Documents by FDR ID
router.get('/fdr/:fdr_id', authenticateToken, getDocuments);

// 3. Delete Document (officer+ only)
router.delete(
  '/:id',
  authenticateToken,
  authorizeRole('aicte_officer', 'senior_official', 'competent_authority', 'system_admin'),
  auditLog('DELETE_DOCUMENT', 'DOCUMENT'),
  deleteDocument
);

module.exports = router;
