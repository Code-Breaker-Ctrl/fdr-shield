const { query } = require('../config/db');

/**
 * @route   GET /api/institutions
 * @desc    Get all institutions with FDR breakdown (officer+ only)
 * @access  Private (officer+)
 */
const getAllInstitutions = async (req, res, next) => {
  try {
    const { state, status, search, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (state) {
      params.push(state.trim());
      conditions.push(`i.state ILIKE $${params.length}`);
    }

    if (status) {
      params.push(status.trim());
      conditions.push(`i.status = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(i.name ILIKE $${params.length} OR i.aicte_code ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count
    const countSql = `SELECT COUNT(*)::int AS total FROM institutions i ${whereClause}`;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0].total;

    // Aggregated list query
    const dataParams = [...params, limitNum, offset];
    const dataSql = `
      SELECT 
        i.*,
        COUNT(f.id)::int AS total_fdrs,
        COALESCE(SUM(f.amount), 0)::numeric(15,2) AS total_fdr_amount,
        COUNT(CASE WHEN f.validity_status = 'active' THEN 1 END)::int AS active_fdrs,
        COUNT(CASE WHEN f.validity_status = 'expiring_soon' THEN 1 END)::int AS expiring_soon_fdrs,
        COUNT(CASE WHEN f.validity_status = 'matured' THEN 1 END)::int AS matured_fdrs,
        COUNT(CASE WHEN f.validity_status = 'released' THEN 1 END)::int AS released_fdrs
      FROM institutions i
      LEFT JOIN fdrs f ON i.id = f.institution_id
      ${whereClause}
      GROUP BY i.id
      ORDER BY i.name ASC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const dataRes = await query(dataSql, dataParams);

    return res.status(200).json({
      success: true,
      message: 'Institutions fetched successfully.',
      data: {
        institutions: dataRes.rows,
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
 * @route   GET /api/institutions/:id
 * @desc    Get single institution by ID with full breakdown
 * @access  Private (all authenticated roles - institution_admin restricted to self)
 */
const getInstitutionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isInstitutionAdmin = req.user.role.toLowerCase() === 'institution_admin';

    if (isInstitutionAdmin && req.user.institution_id !== id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view details of your own institution.',
      });
    }

    const sql = `
      SELECT 
        i.*,
        COUNT(f.id)::int AS total_fdrs,
        COALESCE(SUM(f.amount), 0)::numeric(15,2) AS total_fdr_amount,
        COUNT(CASE WHEN f.validity_status = 'active' THEN 1 END)::int AS active_fdrs,
        COUNT(CASE WHEN f.validity_status = 'expiring_soon' THEN 1 END)::int AS expiring_soon_fdrs,
        COUNT(CASE WHEN f.validity_status = 'matured' THEN 1 END)::int AS matured_fdrs,
        COUNT(CASE WHEN f.validity_status = 'released' THEN 1 END)::int AS released_fdrs,
        COUNT(CASE WHEN f.verification_status = 'pending' THEN 1 END)::int AS pending_verification_fdrs,
        COUNT(CASE WHEN f.verification_status = 'verified' THEN 1 END)::int AS verified_fdrs,
        COUNT(CASE WHEN f.verification_status = 'discrepancy_flagged' THEN 1 END)::int AS discrepancy_fdrs
      FROM institutions i
      LEFT JOIN fdrs f ON i.id = f.institution_id
      WHERE i.id = $1
      GROUP BY i.id
    `;

    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Institution not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Institution details retrieved successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllInstitutions,
  getInstitutionById,
};
