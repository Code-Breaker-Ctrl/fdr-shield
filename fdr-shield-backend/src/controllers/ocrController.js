const { query } = require('../config/db');
const { extractFDRData, compareWithEntered } = require('../services/ocrService');
const { recordAudit } = require('../middleware/auditLog');

/**
 * @route   POST /api/fdrs/:id/ocr-extract
 * @desc    Extract text from uploaded document and compare with entered FDR fields
 * @access  Private (aicte_officer, senior_official, system_admin)
 */
const extractAndCompare = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Fetch FDR by ID
    const fdrRes = await query('SELECT * FROM fdrs WHERE id = $1', [id]);
    if (fdrRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'FDR record not found.',
      });
    }
    const fdr = fdrRes.rows[0];

    // 2. Fetch latest document URL for this FDR
    const docRes = await query(
      'SELECT file_url, file_name, file_type FROM documents WHERE fdr_id = $1 ORDER BY uploaded_at DESC LIMIT 1',
      [id]
    );

    if (docRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No document uploaded yet for this FDR.',
      });
    }

    const fileUrl = docRes.rows[0].file_url;

    // 3. Call OCR extraction & comparison
    const { extracted, confidence } = await extractFDRData(fileUrl);
    const comparison = await compareWithEntered(extracted, fdr);

    let action_taken = 'clean';

    // 4. Update database with extraction data and discrepancy flags if mismatches exist
    if (comparison.mismatch_count > 0) {
      action_taken = 'flagged';
      const notes = JSON.stringify(comparison.mismatches);

      const updateSql = `
        UPDATE fdrs
        SET 
          ocr_extracted_data = $1,
          verification_status = 'discrepancy_flagged',
          administrative_status = 'rejected',
          discrepancy_notes = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      await query(updateSql, [JSON.stringify(extracted), notes, id]);
    } else {
      const updateSql = `
        UPDATE fdrs
        SET 
          ocr_extracted_data = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      await query(updateSql, [JSON.stringify(extracted), id]);
    }

    // 5. Audit Logging
    await recordAudit({
      user_id: req.user.id,
      action: 'OCR_EXTRACT_COMPARE',
      entity_type: 'FDR',
      entity_id: id,
      ip_address: req.ip,
      details: {
        file_url: fileUrl,
        confidence,
        mismatch_count: comparison.mismatch_count,
        action_taken,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        action_taken === 'flagged'
          ? 'OCR extraction completed: Discrepancies detected and flagged.'
          : 'OCR extraction completed: All checked fields matched.',
      data: {
        extracted,
        confidence,
        entered: {
          fdr_number: fdr.fdr_number,
          bank_name: fdr.bank_name,
          branch_name: fdr.branch_name,
          ifsc_code: fdr.ifsc_code,
          amount: parseFloat(fdr.amount),
          issue_date: fdr.issue_date,
          maturity_date: fdr.maturity_date,
        },
        comparison,
        action_taken,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  extractAndCompare,
};
