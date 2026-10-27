const { query } = require('../config/db');
const { recordAudit } = require('../middleware/auditLog');

/**
 * @route   POST /api/release-requests
 * @desc    Submit a release request for an FDR
 * @access  Private (institution_admin only)
 */
const submitRequest = async (req, res, next) => {
  try {
    const institutionId = req.user.institution_id;
    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: 'Your account is not associated with an institution.',
      });
    }

    const { fdr_id, reason, supporting_docs = [] } = req.body;

    if (!fdr_id || !reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'fdr_id and reason are required.',
      });
    }

    // 1. Verify FDR belongs to this institution
    const fdrRes = await query('SELECT * FROM fdrs WHERE id = $1', [fdr_id]);
    if (fdrRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'FDR record not found.',
      });
    }

    const fdr = fdrRes.rows[0];
    if (fdr.institution_id !== institutionId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: FDR does not belong to your institution.',
      });
    }

    if (fdr.validity_status === 'released') {
      return res.status(400).json({
        success: false,
        message: 'This FDR has already been released.',
      });
    }

    // 2. Check no existing pending or under-review request for same FDR
    const pendingCheck = await query(
      `SELECT id FROM release_requests 
       WHERE fdr_id = $1 AND status IN ('submitted', 'under_review')`,
      [fdr_id]
    );

    if (pendingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A release request for this FDR is already active or under review.',
      });
    }

    // 3. Insert release request
    const insertSql = `
      INSERT INTO release_requests (
        fdr_id,
        institution_id,
        requested_by,
        reason,
        supporting_docs,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'submitted')
      RETURNING *
    `;

    const result = await query(insertSql, [
      fdr_id,
      institutionId,
      req.user.id,
      reason.trim(),
      JSON.stringify(supporting_docs),
    ]);

    const createdReq = result.rows[0];

    await recordAudit({
      user_id: req.user.id,
      action: 'SUBMIT_RELEASE_REQUEST',
      entity_type: 'RELEASE_REQUEST',
      entity_id: createdReq.id,
      ip_address: req.ip,
      details: { fdr_id, institution_id: institutionId },
    });

    return res.status(201).json({
      success: true,
      message: 'Release request submitted successfully.',
      data: createdReq,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/release-requests
 * @desc    Get all release requests
 * @access  Private
 */
const getAllRequests = async (req, res, next) => {
  try {
    const isInstitutionAdmin = req.user.role.toLowerCase() === 'institution_admin';
    const { status, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (isInstitutionAdmin) {
      params.push(req.user.institution_id);
      conditions.push(`r.institution_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`r.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*)::int AS total FROM release_requests r ${whereClause}`;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0].total;

    const dataParams = [...params, limitNum, offset];
    const dataSql = `
      SELECT 
        r.*,
        i.name AS institution_name,
        i.aicte_code AS institution_aicte_code,
        f.fdr_number,
        f.bank_name,
        f.amount AS fdr_amount,
        f.maturity_date AS fdr_maturity_date,
        f.validity_status AS fdr_validity_status,
        u_req.name AS requested_by_name,
        u_rev.name AS reviewed_by_name,
        u_app.name AS approved_by_name
      FROM release_requests r
      JOIN institutions i ON r.institution_id = i.id
      JOIN fdrs f ON r.fdr_id = f.id
      LEFT JOIN users u_req ON r.requested_by = u_req.id
      LEFT JOIN users u_rev ON r.reviewed_by = u_rev.id
      LEFT JOIN users u_app ON r.approved_by = u_app.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const dataRes = await query(dataSql, dataParams);

    return res.status(200).json({
      success: true,
      message: 'Release requests fetched successfully.',
      data: {
        requests: dataRes.rows,
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
 * @route   PATCH /api/release-requests/:id/review
 * @desc    Review release request (aicte_officer+ only)
 * @access  Private (aicte_officer+)
 */
const reviewRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { officer_comment } = req.body;

    const reqCheck = await query('SELECT * FROM release_requests WHERE id = $1', [id]);
    if (reqCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Release request not found.',
      });
    }

    const currentReq = reqCheck.rows[0];
    if (currentReq.status === 'approved' || currentReq.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: `Cannot review request that has already been ${currentReq.status}.`,
      });
    }

    const updateSql = `
      UPDATE release_requests
      SET 
        status = 'under_review',
        officer_comment = COALESCE($1, officer_comment),
        reviewed_by = $2,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const result = await query(updateSql, [
      officer_comment ? officer_comment.trim() : null,
      req.user.id,
      id,
    ]);

    await recordAudit({
      user_id: req.user.id,
      action: 'REVIEW_RELEASE_REQUEST',
      entity_type: 'RELEASE_REQUEST',
      entity_id: id,
      ip_address: req.ip,
      details: { officer_comment: officer_comment || null },
    });

    return res.status(200).json({
      success: true,
      message: 'Release request marked as under review.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/release-requests/:id/approve
 * @desc    Approve release request and mark FDR as released
 * @access  Private (competent_authority only)
 */
const approveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    const reqCheck = await query('SELECT * FROM release_requests WHERE id = $1', [id]);
    if (reqCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Release request not found.',
      });
    }

    const releaseReq = reqCheck.rows[0];
    if (releaseReq.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'This release request has already been approved.',
      });
    }

    // 1. Update release_requests
    const updateReqSql = `
      UPDATE release_requests
      SET 
        status = 'approved',
        approved_by = $1,
        approved_at = CURRENT_TIMESTAMP,
        officer_comment = COALESCE($2, officer_comment),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    const reqResult = await query(updateReqSql, [req.user.id, comment || null, id]);

    // 2. Update FDR validity_status to 'released' and administrative_status to 'released'
    await query(
      `UPDATE fdrs 
       SET validity_status = 'released', administrative_status = 'released', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [releaseReq.fdr_id]
    );

    // 3. Log to audit_logs
    await recordAudit({
      user_id: req.user.id,
      action: 'APPROVE_RELEASE_REQUEST',
      entity_type: 'RELEASE_REQUEST',
      entity_id: id,
      ip_address: req.ip,
      details: {
        fdr_id: releaseReq.fdr_id,
        institution_id: releaseReq.institution_id,
        comment: comment || null,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Release request approved and FDR validity marked as released.',
      data: reqResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/release-requests/:id/reject
 * @desc    Reject release request
 * @access  Private (competent_authority only)
 */
const rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required.',
      });
    }

    const reqCheck = await query('SELECT * FROM release_requests WHERE id = $1', [id]);
    if (reqCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Release request not found.',
      });
    }

    const currentReq = reqCheck.rows[0];
    if (currentReq.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject an already approved request.',
      });
    }

    const updateSql = `
      UPDATE release_requests
      SET 
        status = 'rejected',
        officer_comment = $1,
        approved_by = $2,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const result = await query(updateSql, [reason.trim(), req.user.id, id]);

    await recordAudit({
      user_id: req.user.id,
      action: 'REJECT_RELEASE_REQUEST',
      entity_type: 'RELEASE_REQUEST',
      entity_id: id,
      ip_address: req.ip,
      details: { reason: reason.trim() },
    });

    return res.status(200).json({
      success: true,
      message: 'Release request rejected.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitRequest,
  getAllRequests,
  reviewRequest,
  approveRequest,
  rejectRequest,
};
