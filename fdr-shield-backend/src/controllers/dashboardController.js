const { query } = require('../config/db');
const { getAllRiskSummary } = require('../services/riskService');

/**
 * @route   GET /api/dashboard/summary
 * @desc    Global AICTE Executive Dashboard (officer+ only)
 * @access  Private (aicte_officer, senior_official, competent_authority, system_admin)
 */
const getOfficerDashboard = async (req, res, next) => {
  try {
    // 1. FDR Metrics
    const fdrMetricsSql = `
      SELECT 
        COUNT(*)::int AS total_fdrs,
        COUNT(CASE WHEN validity_status = 'active' THEN 1 END)::int AS active,
        COUNT(CASE WHEN validity_status != 'released' AND maturity_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END)::int AS expiring_30_days,
        COUNT(CASE WHEN validity_status != 'released' AND maturity_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END)::int AS expiring_7_days,
        COUNT(CASE WHEN validity_status = 'matured' THEN 1 END)::int AS matured,
        COUNT(CASE WHEN validity_status = 'released' THEN 1 END)::int AS released,
        COUNT(CASE WHEN verification_status = 'pending' THEN 1 END)::int AS pending_verification,
        COUNT(CASE WHEN verification_status = 'discrepancy_flagged' THEN 1 END)::int AS discrepancy_flagged,
        COALESCE(SUM(amount), 0)::numeric(15, 2) AS total_portfolio_amount
      FROM fdrs
    `;
    const fdrMetrics = (await query(fdrMetricsSql)).rows[0];

    // 2. Pending Release Requests
    const releaseSql = `
      SELECT COUNT(*)::int AS count 
      FROM release_requests 
      WHERE status IN ('submitted', 'under_review')
    `;
    const pendingReleaseRes = await query(releaseSql);
    const pending_release_requests = pendingReleaseRes.rows[0].count;

    // 3. Institution counts
    const instSql = `SELECT COUNT(*)::int AS count FROM institutions WHERE status = 'active'`;
    const instRes = await query(instSql);
    const total_institutions = instRes.rows[0].count;

    // 4. Alerts sent this month
    const alertSql = `
      SELECT COUNT(*)::int AS count 
      FROM alerts 
      WHERE sent_at >= DATE_TRUNC('month', CURRENT_DATE)
    `;
    const alertRes = await query(alertSql);
    const alerts_sent_this_month = alertRes.rows[0].count;

    // 5. Risk distribution
    const riskSummary = await getAllRiskSummary();
    const high_risk_count = riskSummary.filter((r) => r.level === 'high').length;
    const medium_risk_count = riskSummary.filter((r) => r.level === 'medium').length;

    return res.status(200).json({
      success: true,
      message: 'Officer executive dashboard metrics fetched successfully.',
      data: {
        total_fdrs: fdrMetrics.total_fdrs,
        active: fdrMetrics.active,
        expiring_30_days: fdrMetrics.expiring_30_days,
        expiring_7_days: fdrMetrics.expiring_7_days,
        matured: fdrMetrics.matured,
        released: fdrMetrics.released,
        pending_verification: fdrMetrics.pending_verification,
        discrepancy_flagged: fdrMetrics.discrepancy_flagged,
        pending_release_requests,
        total_institutions,
        high_risk_count,
        medium_risk_count,
        alerts_sent_this_month,
        total_portfolio_amount: fdrMetrics.total_portfolio_amount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/dashboard/my-summary
 * @desc    Institution Admin Dashboard (scoped to caller's institution)
 * @access  Private (institution_admin only)
 */
const getInstitutionDashboard = async (req, res, next) => {
  try {
    const institutionId = req.user.institution_id;
    if (!institutionId) {
      return res.status(400).json({
        success: false,
        message: 'No institution linked to your user profile.',
      });
    }

    const fdrMetricsSql = `
      SELECT 
        COUNT(*)::int AS total_fdrs,
        COUNT(CASE WHEN validity_status = 'active' THEN 1 END)::int AS active,
        COUNT(CASE WHEN validity_status != 'released' AND maturity_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END)::int AS expiring_30_days,
        COUNT(CASE WHEN validity_status != 'released' AND maturity_date <= CURRENT_DATE + INTERVAL '7 days' THEN 1 END)::int AS expiring_7_days,
        COUNT(CASE WHEN validity_status = 'matured' THEN 1 END)::int AS matured,
        COUNT(CASE WHEN validity_status = 'released' THEN 1 END)::int AS released,
        COUNT(CASE WHEN verification_status = 'pending' THEN 1 END)::int AS pending_verification,
        COUNT(CASE WHEN verification_status = 'discrepancy_flagged' THEN 1 END)::int AS discrepancy_flagged,
        COALESCE(SUM(amount), 0)::numeric(15, 2) AS total_institution_amount
      FROM fdrs
      WHERE institution_id = $1
    `;
    const fdrMetrics = (await query(fdrMetricsSql, [institutionId])).rows[0];

    const releaseSql = `
      SELECT COUNT(*)::int AS count 
      FROM release_requests 
      WHERE institution_id = $1 AND status IN ('submitted', 'under_review')
    `;
    const pendingReleaseRes = await query(releaseSql, [institutionId]);
    const pending_release_requests = pendingReleaseRes.rows[0].count;

    const alertSql = `
      SELECT COUNT(*)::int AS count 
      FROM alerts 
      WHERE institution_id = $1 AND sent_at >= DATE_TRUNC('month', CURRENT_DATE)
    `;
    const alertRes = await query(alertSql, [institutionId]);
    const alerts_sent_this_month = alertRes.rows[0].count;

    return res.status(200).json({
      success: true,
      message: 'Institution dashboard metrics fetched successfully.',
      data: {
        institution_id: institutionId,
        total_fdrs: fdrMetrics.total_fdrs,
        active: fdrMetrics.active,
        expiring_30_days: fdrMetrics.expiring_30_days,
        expiring_7_days: fdrMetrics.expiring_7_days,
        matured: fdrMetrics.matured,
        released: fdrMetrics.released,
        pending_verification: fdrMetrics.pending_verification,
        discrepancy_flagged: fdrMetrics.discrepancy_flagged,
        pending_release_requests,
        alerts_sent_this_month,
        total_institution_amount: fdrMetrics.total_institution_amount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/dashboard/risk
 * @desc    Risk Intelligence Dashboard - All institutions with risk scores & levels
 * @access  Private (aicte_officer, senior_official, competent_authority, system_admin)
 */
const getRiskDashboard = async (req, res, next) => {
  try {
    const riskSummary = await getAllRiskSummary();

    return res.status(200).json({
      success: true,
      message: 'Institution risk analysis summary fetched successfully.',
      data: {
        total_evaluated: riskSummary.length,
        high_risk_count: riskSummary.filter((r) => r.level === 'high').length,
        medium_risk_count: riskSummary.filter((r) => r.level === 'medium').length,
        low_risk_count: riskSummary.filter((r) => r.level === 'low').length,
        institutions: riskSummary,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOfficerDashboard,
  getInstitutionDashboard,
  getRiskDashboard,
};
