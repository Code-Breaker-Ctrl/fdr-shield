const cron = require('node-cron');
const { query } = require('../config/db');
const { sendFDRAlert, sendEmail } = require('../services/alertService');

/**
 * Main routine to evaluate all FDRs against alert thresholds and send notices
 */
async function runAlertCheck() {
  console.log('[ALERT CRON] Starting scheduled FDR maturity alert check...');

  let sentCount = 0;
  let skippedCount = 0;
  const processedAlerts = [];

  try {
    // 1. Query candidate FDRs matching thresholds: 30 days, 15 days, 7 days, and overdue
    // Note: Overdue applies to all non-released FDRs past their maturity date
    const thresholdQuery = `
      SELECT 
        f.id AS fdr_id,
        f.fdr_number,
        f.bank_name,
        f.amount,
        f.maturity_date,
        f.validity_status,
        f.institution_id,
        i.name AS institution_name,
        i.aicte_code,
        i.contact_email,
        i.contact_phone,
        (f.maturity_date - CURRENT_DATE)::int AS days_remaining,
        CASE 
          WHEN (f.maturity_date - CURRENT_DATE) = 30 THEN '30_days'
          WHEN (f.maturity_date - CURRENT_DATE) = 15 THEN '15_days'
          WHEN (f.maturity_date - CURRENT_DATE) = 7 THEN '7_days'
          WHEN f.maturity_date < CURRENT_DATE THEN 'overdue'
          ELSE NULL
        END AS alert_type
      FROM fdrs f
      JOIN institutions i ON f.institution_id = i.id
      WHERE f.validity_status != 'released'
        AND (
          (f.maturity_date - CURRENT_DATE) IN (30, 15, 7)
          OR f.maturity_date < CURRENT_DATE
        )
      ORDER BY f.maturity_date ASC
    `;

    const candidates = (await query(thresholdQuery)).rows;
    console.log(`[ALERT CRON] Found ${candidates.length} candidate FDRs matching thresholds.`);

    // 2. Query all AICTE Officers (to notify for overdue FDRs)
    const officersRes = await query(
      "SELECT email, name FROM users WHERE role = 'aicte_officer' AND is_active = true"
    );
    const aicteOfficers = officersRes.rows;

    // 3. Process each candidate
    for (const item of candidates) {
      if (!item.alert_type) continue;

      // Check if alert already sent today for this fdr_id + alert_type
      const checkSql = `
        SELECT id FROM alerts
        WHERE fdr_id = $1 
          AND alert_type = $2
          AND sent_at >= CURRENT_DATE
        LIMIT 1
      `;
      const duplicateRes = await query(checkSql, [item.fdr_id, item.alert_type]);

      if (duplicateRes.rows.length > 0) {
        skippedCount++;
        continue;
      }

      const fdrObj = {
        id: item.fdr_id,
        fdr_number: item.fdr_number,
        bank_name: item.bank_name,
        amount: item.amount,
        maturity_date: item.maturity_date,
      };

      const instObj = {
        id: item.institution_id,
        name: item.institution_name,
        aicte_code: item.aicte_code,
        contact_email: item.contact_email,
        contact_phone: item.contact_phone,
      };

      // Dispatch alert to institution
      const alertResult = await sendFDRAlert(fdrObj, instObj, item.alert_type, item.days_remaining);
      sentCount++;

      processedAlerts.push({
        fdr_number: item.fdr_number,
        institution: item.institution_name,
        alert_type: item.alert_type,
        days_remaining: item.days_remaining,
        alert_id: alertResult.alertId,
      });

      // If OVERDUE: Also email all assigned AICTE desk officers
      if (item.alert_type === 'overdue' && aicteOfficers.length > 0) {
        for (const officer of aicteOfficers) {
          const officerSubject = `[URGENT OVERDUE] FDR ${item.fdr_number} of ${item.institution_name}`;
          const officerHtml = `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #dc2626;">AICTE Regulatory Escalation</h2>
              <p>Dear <strong>${officer.name}</strong> (AICTE Officer),</p>
              <p>The following FDR has surpassed its statutory validity without a validated renewal or release:</p>
              <ul>
                <li><strong>Institution:</strong> ${item.institution_name} (${item.aicte_code})</li>
                <li><strong>FDR Number:</strong> ${item.fdr_number} (${item.bank_name})</li>
                <li><strong>Amount:</strong> ₹${parseFloat(item.amount).toLocaleString('en-IN')}</li>
                <li><strong>Maturity Date:</strong> ${new Date(item.maturity_date).toLocaleDateString('en-IN')}</li>
                <li><strong>Days Overdue:</strong> ${Math.abs(item.days_remaining)} days</li>
              </ul>
              <p>Please initiate regulatory scrutiny on the FDR Shield administrative portal.</p>
            </div>
          `;
          await sendEmail(officer.email, officerSubject, officerHtml);
        }
      }
    }

    const summary = {
      message: `Alert check complete: ${sentCount} alerts dispatched, ${skippedCount} skipped (already sent today).`,
      candidates_found: candidates.length,
      sent_count: sentCount,
      skipped_count: skippedCount,
      processed: processedAlerts,
      timestamp: new Date().toISOString(),
    };

    console.log(`[ALERT CRON] ${summary.message}`);
    return summary;
  } catch (error) {
    console.error('[ALERT CRON ERROR]:', error.message);
    throw error;
  }
}

// Schedule cron job to run at 9:00 AM daily (0 9 * * *)
const alertCronJob = cron.schedule(
  '0 9 * * *',
  async () => {
    try {
      await runAlertCheck();
    } catch (err) {
      console.error('[CRON EXECUTION FAILURE]:', err.message);
    }
  },
  {
    scheduled: false, // Server will call alertCronJob.start()
    timezone: 'Asia/Kolkata',
  }
);

module.exports = {
  alertCronJob,
  runAlertCheck,
};
