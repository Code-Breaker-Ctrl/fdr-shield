const { query } = require('../config/db');
const { runAlertCheck } = require('../jobs/alertCron');

/**
 * @route   GET /api/alerts
 * @desc    Get alerts with filtering & pagination
 * @access  Private
 */
const getAlerts = async (req, res, next) => {
  try {
    const isInstitutionAdmin = req.user.role.toLowerCase() === 'institution_admin';
    const { status, type, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (isInstitutionAdmin) {
      params.push(req.user.institution_id);
      conditions.push(`a.institution_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }

    if (type) {
      params.push(type);
      conditions.push(`a.alert_type = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*)::int AS total FROM alerts a ${whereClause}`;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0].total;

    const dataParams = [...params, limitNum, offset];
    const dataSql = `
      SELECT 
        a.*,
        i.name AS institution_name,
        i.aicte_code,
        f.fdr_number,
        f.bank_name,
        f.amount,
        f.maturity_date
      FROM alerts a
      JOIN institutions i ON a.institution_id = i.id
      JOIN fdrs f ON a.fdr_id = f.id
      ${whereClause}
      ORDER BY a.sent_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const dataRes = await query(dataSql, dataParams);

    return res.status(200).json({
      success: true,
      message: 'Alerts retrieved successfully.',
      data: {
        alerts: dataRes.rows,
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
 * @route   POST /api/alerts/trigger-check
 * @desc    Manually trigger the maturity alert evaluation routine (system_admin only)
 * @access  Private (system_admin only)
 */
const triggerManualCheck = async (req, res, next) => {
  try {
    const summary = await runAlertCheck();
    return res.status(200).json({
      success: true,
      message: 'Manual alert evaluation check executed successfully.',
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/notifications
 * @desc    Get last 20 relevant notifications for the logged in user
 * @access  Private
 */
const getNotifications = async (req, res, next) => {
  try {
    const isInstitutionAdmin = req.user.role.toLowerCase() === 'institution_admin';
    const params = [];
    let filter = '';

    if (isInstitutionAdmin) {
      params.push(req.user.institution_id);
      filter = `WHERE a.institution_id = $1`;
    }

    const querySql = `
      SELECT 
        a.id,
        a.fdr_id,
        a.alert_type,
        a.sent_at,
        a.status,
        a.email_sent,
        a.sms_sent,
        a.whatsapp_sent,
        i.name AS institution_name,
        i.aicte_code,
        f.fdr_number,
        f.bank_name,
        f.amount,
        f.maturity_date
      FROM alerts a
      JOIN institutions i ON a.institution_id = i.id
      JOIN fdrs f ON a.fdr_id = f.id
      ${filter}
      ORDER BY a.sent_at DESC
      LIMIT 20
    `;

    const result = await query(querySql, params);

    return res.status(200).json({
      success: true,
      message: 'Notifications fetched successfully.',
      data: {
        notifications: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAlerts,
  triggerManualCheck,
  getNotifications,
};
