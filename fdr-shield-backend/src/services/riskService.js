const { query } = require('../config/db');

/**
 * Calculate dynamic risk score for a single institution
 * @param {string} institutionId
 * @returns {Promise<Object>}
 */
async function calculateRiskScore(institutionId) {
  // Query 1: Count FDRs expiring in <= 30 days (validity_status != 'released')
  const expiringSql = `
    SELECT COUNT(*)::int AS count
    FROM fdrs
    WHERE institution_id = $1
      AND validity_status != 'released'
      AND maturity_date <= CURRENT_DATE + INTERVAL '30 days'
  `;
  const expiringRes = await query(expiringSql, [institutionId]);
  const expiring_count = expiringRes.rows[0].count;

  // Query 2: Count FDRs with verification_status = 'discrepancy_flagged' and updated_at < NOW() - INTERVAL '7 days'
  const discrepancySql = `
    SELECT COUNT(*)::int AS count
    FROM fdrs
    WHERE institution_id = $1
      AND verification_status = 'discrepancy_flagged'
      AND updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days'
  `;
  const discrepancyRes = await query(discrepancySql, [institutionId]);
  const unresolved_discrepancies = discrepancyRes.rows[0].count;

  // Query 3: Count FDRs with no documents in documents table
  const missingDocsSql = `
    SELECT COUNT(f.id)::int AS count
    FROM fdrs f
    LEFT JOIN documents d ON f.id = d.fdr_id
    WHERE f.institution_id = $1
      AND d.id IS NULL
  `;
  const missingDocsRes = await query(missingDocsSql, [institutionId]);
  const missing_docs_count = missingDocsRes.rows[0].count;

  // Query 4: Count rejected release_requests in last 6 months
  const rejectedSql = `
    SELECT COUNT(*)::int AS count
    FROM release_requests
    WHERE institution_id = $1
      AND status = 'rejected'
      AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '6 months'
  `;
  const rejectedRes = await query(rejectedSql, [institutionId]);
  const recent_rejections = rejectedRes.rows[0].count;

  // Query 5: Check if ALL FDRs verified and none expiring in 30 days
  const allClearSql = `
    SELECT 
      COUNT(*)::int AS total_fdrs,
      COUNT(CASE WHEN verification_status = 'verified' THEN 1 END)::int AS verified_fdrs,
      COUNT(CASE WHEN validity_status != 'released' AND maturity_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1 END)::int AS expiring_30
    FROM fdrs
    WHERE institution_id = $1
  `;
  const allClearRes = await query(allClearSql, [institutionId]);
  const { total_fdrs, verified_fdrs, expiring_30 } = allClearRes.rows[0];
  const isAllClear = total_fdrs > 0 && verified_fdrs === total_fdrs && expiring_30 === 0;

  // Scoring Calculation
  let totalScore = 0;
  if (expiring_count > 0) totalScore += 40;
  if (unresolved_discrepancies > 0) totalScore += 25;
  if (missing_docs_count > 0) totalScore += 20;
  if (recent_rejections > 0) totalScore += 15;
  if (isAllClear) totalScore -= 50;

  const finalScore = Math.min(100, Math.max(0, totalScore));

  let level = 'low';
  if (finalScore > 60) {
    level = 'high';
  } else if (finalScore > 30) {
    level = 'medium';
  }

  return {
    score: finalScore,
    level,
    breakdown: {
      expiring: expiring_count > 0 ? 40 : 0,
      discrepancies: unresolved_discrepancies > 0 ? 25 : 0,
      missing_docs: missing_docs_count > 0 ? 20 : 0,
      rejections: recent_rejections > 0 ? 15 : 0,
      all_clear_bonus: isAllClear ? -50 : 0,
    },
    counts: {
      expiring_count,
      unresolved_discrepancies,
      missing_docs_count,
      recent_rejections,
      total_fdrs,
    },
  };
}

/**
 * Get aggregated risk scores for all active institutions
 * @returns {Promise<Array<Object>>}
 */
async function getAllRiskSummary() {
  const instSql = `
    SELECT id AS institution_id, name, aicte_code, state, status
    FROM institutions
    WHERE status = 'active'
    ORDER BY name ASC
  `;
  const institutions = (await query(instSql)).rows;

  const results = await Promise.all(
    institutions.map(async (inst) => {
      const risk = await calculateRiskScore(inst.institution_id);
      return {
        institution_id: inst.institution_id,
        name: inst.name,
        aicte_code: inst.aicte_code,
        state: inst.state,
        score: risk.score,
        level: risk.level,
        breakdown: risk.breakdown,
        counts: risk.counts,
      };
    })
  );

  // Sorted by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

module.exports = {
  calculateRiskScore,
  getAllRiskSummary,
};
