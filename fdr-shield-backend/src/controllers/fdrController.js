const { query } = require('../config/db');
const { recordAudit } = require('../middleware/auditLog');

/**
 * Helper to compute validity status based on maturity date
 */
const computeValidityStatus = (maturityDateStr) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maturityDate = new Date(maturityDateStr);
  maturityDate.setHours(0, 0, 0, 0);

  const diffTime = maturityDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'matured';
  } else if (diffDays <= 30) {
    return 'expiring_soon';
  } else {
    return 'active';
  }
};

/**
 * @route   POST /api/fdrs
 * @desc    Create new FDR record (institution_admin only)
 * @access  Private (institution_admin)
 */
const createFDR = async (req, res, next) => {
  try {
    let institutionId = req.user.institution_id || req.body.institution_id;
    if (!institutionId) {
      const instRes = await query('SELECT id FROM institutions LIMIT 1');
      institutionId = instRes.rows[0]?.id;
    }
    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: 'No institution found to link this FDR.',
      });
    }

    const {
      fdr_number,
      bank_name,
      branch_name,
      ifsc_code,
      amount,
      issue_date,
      maturity_date,
    } = req.body;

    // Check unique fdr_number
    const checkRes = await query('SELECT id FROM fdrs WHERE LOWER(fdr_number) = LOWER($1)', [
      fdr_number.trim(),
    ]);
    if (checkRes.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `FDR number '${fdr_number}' already exists in the system.`,
      });
    }

    if (new Date(maturity_date) <= new Date(issue_date)) {
      return res.status(400).json({
        success: false,
        message: 'Maturity date must be after issue date.',
      });
    }

    const validity_status = computeValidityStatus(maturity_date);

    const insertSql = `
      INSERT INTO fdrs (
        institution_id,
        fdr_number,
        bank_name,
        branch_name,
        ifsc_code,
        amount,
        issue_date,
        maturity_date,
        validity_status,
        verification_status,
        administrative_status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 'under_review', $10)
      RETURNING *
    `;

    const result = await query(insertSql, [
      institutionId,
      fdr_number.trim(),
      bank_name.trim(),
      branch_name.trim(),
      ifsc_code.trim().toUpperCase(),
      parseFloat(amount),
      issue_date,
      maturity_date,
      validity_status,
      req.user.id,
    ]);

    const createdFDR = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'FDR created successfully.',
      data: createdFDR,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/fdrs
 * @desc    Get all FDRs (paginated & filtered)
 * @access  Private (all authenticated roles)
 */
const getAllFDRs = async (req, res, next) => {
  try {
    const isInstitutionAdmin = req.user && req.user.role && req.user.role.toLowerCase() === 'institution_admin';
    const {
      status,
      institution_id,
      search,
      days_to_maturity,
      page = 1,
      limit = 100,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    // Role-based scope
    if (isInstitutionAdmin) {
      params.push(req.user.institution_id);
      conditions.push(`f.institution_id = $${params.length}`);
    } else if (institution_id) {
      params.push(institution_id);
      conditions.push(`f.institution_id = $${params.length}`);
    }

    // Filter by validity_status
    if (status) {
      params.push(status);
      conditions.push(`f.validity_status = $${params.length}`);
    }

    // Search query on fdr_number, bank_name, institution name
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(f.fdr_number ILIKE $${params.length} OR f.bank_name ILIKE $${params.length} OR i.name ILIKE $${params.length})`
      );
    }

    // Filter by days to maturity (maturity_date <= today + N days and maturity_date >= today)
    if (days_to_maturity !== undefined && days_to_maturity !== '') {
      const days = parseInt(days_to_maturity, 10);
      if (!isNaN(days)) {
        params.push(days);
        conditions.push(`f.maturity_date <= CURRENT_DATE + ($${params.length} * INTERVAL '1 day')`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count query
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM fdrs f
      JOIN institutions i ON f.institution_id = i.id
      ${whereClause}
    `;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0].total;

    // Data query
    const dataParams = [...params, limitNum, offset];
    const dataSql = `
      SELECT 
        f.*,
        i.name AS institution_name,
        i.aicte_code AS institution_aicte_code,
        u_verify.name AS verified_by_name,
        u_create.name AS created_by_name
      FROM fdrs f
      JOIN institutions i ON f.institution_id = i.id
      LEFT JOIN users u_verify ON f.verified_by = u_verify.id
      LEFT JOIN users u_create ON f.created_by = u_create.id
      ${whereClause}
      ORDER BY f.created_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;
    const dataRes = await query(dataSql, dataParams);

    return res.status(200).json({
      success: true,
      message: 'FDRs fetched successfully.',
      data: {
        fdrs: dataRes.rows,
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/fdrs/:id
 * @desc    Get single FDR by ID with joined institution & documents
 * @access  Private
 */
const getFDRById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const fdrSql = `
      SELECT 
        f.*,
        i.name AS institution_name,
        i.aicte_code AS institution_aicte_code,
        i.state AS institution_state,
        u_verify.name AS verified_by_name,
        u_create.name AS created_by_name
      FROM fdrs f
      JOIN institutions i ON f.institution_id = i.id
      LEFT JOIN users u_verify ON f.verified_by = u_verify.id
      LEFT JOIN users u_create ON f.created_by = u_create.id
      WHERE f.id = $1
    `;
    const fdrRes = await query(fdrSql, [id]);

    if (fdrRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'FDR record not found.',
      });
    }

    const fdr = fdrRes.rows[0];

    // Restrict institution_admin to own institution
    if (
      req.user.role.toLowerCase() === 'institution_admin' &&
      fdr.institution_id !== req.user.institution_id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: This FDR does not belong to your institution.',
      });
    }

    // Fetch documents linked to this FDR
    const docsSql = `
      SELECT d.*, u.name AS uploaded_by_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.fdr_id = $1
      ORDER BY d.uploaded_at DESC
    `;
    const docsRes = await query(docsSql, [id]);
    fdr.documents = docsRes.rows;

    return res.status(200).json({
      success: true,
      message: 'FDR details retrieved successfully.',
      data: fdr,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/fdrs/:id
 * @desc    Update FDR record
 * @access  Private
 */
const updateFDR = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isInstitutionAdmin = req.user.role.toLowerCase() === 'institution_admin';

    // 1. Fetch current FDR
    const oldRes = await query('SELECT * FROM fdrs WHERE id = $1', [id]);
    if (oldRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'FDR record not found.',
      });
    }

    const oldFDR = oldRes.rows[0];

    // 2. Enforce institution_admin rules
    if (isInstitutionAdmin) {
      if (oldFDR.institution_id !== req.user.institution_id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only update FDRs for your institution.',
        });
      }
      if (oldFDR.verification_status === 'verified') {
        return res.status(403).json({
          success: false,
          message: 'Cannot modify an FDR that has already been verified by AICTE.',
        });
      }
    }

    const {
      fdr_number,
      bank_name,
      branch_name,
      ifsc_code,
      amount,
      issue_date,
      maturity_date,
      validity_status,
      administrative_status,
    } = req.body;

    // Check unique fdr_number if changing
    if (fdr_number && fdr_number.trim() !== oldFDR.fdr_number) {
      const dupCheck = await query(
        'SELECT id FROM fdrs WHERE LOWER(fdr_number) = LOWER($1) AND id != $2',
        [fdr_number.trim(), id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: `FDR number '${fdr_number}' is already taken by another record.`,
        });
      }
    }

    const newIssueDate = issue_date || oldFDR.issue_date;
    const newMaturityDate = maturity_date || oldFDR.maturity_date;

    if (new Date(newMaturityDate) <= new Date(newIssueDate)) {
      return res.status(400).json({
        success: false,
        message: 'Maturity date must be after issue date.',
      });
    }

    // Auto-calculate validity_status unless officer explicitly overrides
    const computedStatus = maturity_date
      ? computeValidityStatus(newMaturityDate)
      : oldFDR.validity_status;
    const finalValidity = !isInstitutionAdmin && validity_status ? validity_status : computedStatus;
    const finalAdminStatus = !isInstitutionAdmin && administrative_status ? administrative_status : oldFDR.administrative_status;

    const updateSql = `
      UPDATE fdrs
      SET
        fdr_number = COALESCE($1, fdr_number),
        bank_name = COALESCE($2, bank_name),
        branch_name = COALESCE($3, branch_name),
        ifsc_code = COALESCE($4, ifsc_code),
        amount = COALESCE($5, amount),
        issue_date = COALESCE($6, issue_date),
        maturity_date = COALESCE($7, maturity_date),
        validity_status = $8,
        administrative_status = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;

    const updatedRes = await query(updateSql, [
      fdr_number ? fdr_number.trim() : null,
      bank_name ? bank_name.trim() : null,
      branch_name ? branch_name.trim() : null,
      ifsc_code ? ifsc_code.trim().toUpperCase() : null,
      amount ? parseFloat(amount) : null,
      issue_date || null,
      maturity_date || null,
      finalValidity,
      finalAdminStatus,
      id,
    ]);

    const updatedFDR = updatedRes.rows[0];

    // Log to audit_logs
    await recordAudit({
      user_id: req.user.id,
      action: 'UPDATE_FDR',
      entity_type: 'FDR',
      entity_id: id,
      ip_address: req.ip,
      details: {
        old: oldFDR,
        new: updatedFDR,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'FDR updated successfully.',
      data: updatedFDR,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/fdrs/:id/verify
 * @desc    Verify FDR (aicte_officer+ only)
 * @access  Private (officer+)
 */
const verifyFDR = async (req, res, next) => {
  try {
    const { id } = req.params;

    const checkRes = await query('SELECT * FROM fdrs WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'FDR record not found.',
      });
    }

    const updateSql = `
      UPDATE fdrs
      SET 
        verification_status = 'verified',
        verified_by = $1,
        verified_at = CURRENT_TIMESTAMP,
        administrative_status = 'approved',
        discrepancy_notes = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await query(updateSql, [req.user.id, id]);

    await recordAudit({
      user_id: req.user.id,
      action: 'VERIFY_FDR',
      entity_type: 'FDR',
      entity_id: id,
      ip_address: req.ip,
      details: { verified_by: req.user.id },
    });

    return res.status(200).json({
      success: true,
      message: 'FDR verified and approved successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/fdrs/:id/flag
 * @desc    Flag discrepancy on FDR (aicte_officer+ only)
 * @access  Private (officer+)
 */
const flagDiscrepancy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    if (!notes || !notes.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Discrepancy notes are required.',
      });
    }

    const checkRes = await query('SELECT * FROM fdrs WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'FDR record not found.',
      });
    }

    const updateSql = `
      UPDATE fdrs
      SET 
        verification_status = 'discrepancy_flagged',
        discrepancy_notes = $1,
        administrative_status = 'rejected',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await query(updateSql, [notes.trim(), id]);

    await recordAudit({
      user_id: req.user.id,
      action: 'FLAG_DISCREPANCY_FDR',
      entity_type: 'FDR',
      entity_id: id,
      ip_address: req.ip,
      details: { notes: notes.trim() },
    });

    return res.status(200).json({
      success: true,
      message: 'FDR discrepancy flagged successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createFDR,
  getAllFDRs,
  getFDRById,
  updateFDR,
  verifyFDR,
  flagDiscrepancy,
};
