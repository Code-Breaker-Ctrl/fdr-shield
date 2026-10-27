const multer = require('multer');
const { cloudinary } = require('../config/cloudinary');
const { query } = require('../config/db');
const { recordAudit } = require('../middleware/auditLog');

// Multer memory storage configuration
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file format. Only PDF, JPG, JPEG, and PNG files are allowed.');
    error.statusCode = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});

/**
 * Upload buffer to Cloudinary using upload_stream
 */
const uploadStreamToCloudinary = (buffer, filename, mimetype) => {
  return new Promise((resolve, reject) => {
    const isPdf = mimetype === 'application/pdf';
    const cleanPublicId = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'fdr-shield/documents',
        resource_type: isPdf ? 'raw' : 'image',
        public_id: `${Date.now()}_${cleanPublicId}`,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

/**
 * @route   POST /api/documents/upload
 * @desc    Upload document for an FDR
 * @access  Private
 */
const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided. Please upload a file (PDF, JPG, JPEG, PNG, max 5MB).',
      });
    }

    const { fdr_id } = req.body;
    if (!fdr_id) {
      return res.status(400).json({
        success: false,
        message: 'fdr_id is required.',
      });
    }

    // Check FDR existence and permission
    const fdrRes = await query('SELECT id, institution_id FROM fdrs WHERE id = $1', [fdr_id]);
    if (fdrRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'FDR record not found.',
      });
    }

    const isInstitutionAdmin = req.user.role.toLowerCase() === 'institution_admin';
    if (isInstitutionAdmin && fdrRes.rows[0].institution_id !== req.user.institution_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only upload documents for your institution FDRs.',
      });
    }

    // Upload to Cloudinary
    const cloudResult = await uploadStreamToCloudinary(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Insert into documents table
    const insertSql = `
      INSERT INTO documents (
        fdr_id,
        file_url,
        file_name,
        file_type,
        uploaded_by,
        is_verified
      )
      VALUES ($1, $2, $3, $4, $5, false)
      RETURNING *
    `;

    const docRes = await query(insertSql, [
      fdr_id,
      cloudResult.secure_url || cloudResult.url,
      req.file.originalname,
      req.file.mimetype,
      req.user.id,
    ]);

    const createdDoc = docRes.rows[0];

    await recordAudit({
      user_id: req.user.id,
      action: 'UPLOAD_DOCUMENT',
      entity_type: 'DOCUMENT',
      entity_id: createdDoc.id,
      ip_address: req.ip,
      details: {
        fdr_id,
        file_name: req.file.originalname,
        file_url: createdDoc.file_url,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully.',
      data: createdDoc,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/documents/fdr/:fdr_id
 * @desc    Get all documents for a given FDR
 * @access  Private
 */
const getDocuments = async (req, res, next) => {
  try {
    const { fdr_id } = req.params;

    // Check FDR ownership
    const fdrRes = await query('SELECT id, institution_id FROM fdrs WHERE id = $1', [fdr_id]);
    if (fdrRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'FDR record not found.',
      });
    }

    const isInstitutionAdmin = req.user.role.toLowerCase() === 'institution_admin';
    if (isInstitutionAdmin && fdrRes.rows[0].institution_id !== req.user.institution_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view documents for your own institution FDRs.',
      });
    }

    const docsSql = `
      SELECT d.*, u.name AS uploaded_by_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.fdr_id = $1
      ORDER BY d.uploaded_at DESC
    `;
    const docsRes = await query(docsSql, [fdr_id]);

    return res.status(200).json({
      success: true,
      message: 'Documents fetched successfully.',
      data: docsRes.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to extract public_id from Cloudinary URL
 */
const extractPublicId = (url) => {
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const afterUpload = parts[1].replace(/^v\d+\//, '');
    return afterUpload.replace(/\.[^/.]+$/, '');
  } catch (_) {
    return null;
  }
};

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete document from Cloudinary and DB (officer+ only)
 * @access  Private (officer+)
 */
const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    const docRes = await query('SELECT * FROM documents WHERE id = $1', [id]);
    if (docRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found.',
      });
    }

    const doc = docRes.rows[0];

    // Attempt deleting from Cloudinary
    const publicId = extractPublicId(doc.file_url);
    if (publicId) {
      try {
        const isPdf = doc.file_type === 'application/pdf';
        await cloudinary.uploader.destroy(publicId, {
          resource_type: isPdf ? 'raw' : 'image',
        });
      } catch (cloudErr) {
        console.warn('[CLOUDINARY DESTROY WARNING]:', cloudErr.message);
      }
    }

    // Delete from database
    await query('DELETE FROM documents WHERE id = $1', [id]);

    await recordAudit({
      user_id: req.user.id,
      action: 'DELETE_DOCUMENT',
      entity_type: 'DOCUMENT',
      entity_id: id,
      ip_address: req.ip,
      details: { file_name: doc.file_name, fdr_id: doc.fdr_id },
    });

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully.',
      data: { id },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  upload,
  uploadDocument,
  getDocuments,
  deleteDocument,
};
