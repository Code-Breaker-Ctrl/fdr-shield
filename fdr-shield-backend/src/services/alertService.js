const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { query } = require('../config/db');
const { transporter } = require('../config/mailer');
require('dotenv').config();

// Twilio Client setup (optional/graceful fallback)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && !process.env.TWILIO_ACCOUNT_SID.startsWith('ACxxxx')) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (err) {
    console.warn('[TWILIO INIT WARNING]:', err.message);
  }
}

/**
 * Send an email using Nodemailer transporter
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML formatted email body
 * @returns {Promise<{sent: boolean, error?: string}>}
 */
async function sendEmail(to, subject, htmlContent) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS || process.env.GMAIL_PASS.includes('google_app_password')) {
      console.log(`[EMAIL MOCK] Email to ${to} simulated. Subject: ${subject}`);
      return { sent: true, simulated: true };
    }

    await transporter.sendMail({
      from: `"AICTE FDR Shield Alert Desk" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });

    console.log(`[EMAIL SUCCESS] Alert sent to: ${to}`);
    return { sent: true };
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Send SMS using MSG91 flow API
 * @param {string} phone - Recipient phone number (e.g. +919810111001)
 * @param {string} message - Text message content
 * @returns {Promise<{sent: boolean, skipped?: boolean, error?: string}>}
 */
async function sendSMS(phone, message) {
  try {
    const apiKey = process.env.MSG91_API_KEY;
    if (!apiKey || apiKey === 'your_msg91_api_key') {
      console.log(`[SMS SKIPPED] No MSG91_API_KEY configured. Target: ${phone}`);
      return { sent: false, skipped: true };
    }

    // Clean phone number: remove non-digits
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    const response = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'authkey': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: process.env.MSG91_SENDER_ID || 'AICTEG',
        mobiles: cleanPhone,
        message,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[SMS API ERROR] MSG91 returned status ${response.status}: ${errText}`);
      return { sent: false, error: errText };
    }

    console.log(`[SMS SUCCESS] Message dispatched to ${phone}`);
    return { sent: true };
  } catch (error) {
    console.error(`[SMS ERROR] Failed to send SMS to ${phone}:`, error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Send WhatsApp message using Twilio client
 * @param {string} phone - Recipient phone number
 * @param {string} message - WhatsApp message content
 * @returns {Promise<{sent: boolean, skipped?: boolean, error?: string}>}
 */
async function sendWhatsApp(phone, message) {
  try {
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
    if (!twilioClient || !fromNumber) {
      console.log(`[WHATSAPP SKIPPED] Twilio credentials not set. Target: ${phone}`);
      return { sent: false, skipped: true };
    }

    const cleanNumber = phone.startsWith('+') ? phone : `+91${phone.replace(/[^0-9]/g, '')}`;

    await twilioClient.messages.create({
      from: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
      to: `whatsapp:${cleanNumber}`,
      body: message,
    });

    console.log(`[WHATSAPP SUCCESS] WhatsApp message sent to ${phone}`);
    return { sent: true };
  } catch (error) {
    console.error(`[WHATSAPP ERROR] Failed to send WhatsApp to ${phone}:`, error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Build professional HTML email with AICTE government header and color-coded alerts
 */
async function buildEmailHTML(fdr, institution, daysRemaining, alertType) {
  const isOverdue = daysRemaining < 0;

  // Color theme: 7 days / overdue = red, 15 days = orange, 30 days = yellow
  let bannerColor = '#ca8a04'; // yellow-600
  let badgeText = `${daysRemaining} DAYS REMAINING`;

  if (isOverdue) {
    bannerColor = '#dc2626'; // red-600
    badgeText = `OVERDUE BY ${Math.abs(daysRemaining)} DAYS`;
  } else if (daysRemaining <= 7) {
    bannerColor = '#dc2626'; // red-600
    badgeText = `CRITICAL: ${daysRemaining} DAYS REMAINING`;
  } else if (daysRemaining <= 15) {
    bannerColor = '#ea580c'; // orange-600
    badgeText = `URGENT: ${daysRemaining} DAYS REMAINING`;
  }

  const maturityDateFormatted = new Date(fdr.maturity_date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const amountFormatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(fdr.amount);

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
      .header { background-color: #1e40af; color: #ffffff; padding: 24px 30px; text-align: center; }
      .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
      .header p { margin: 0; font-size: 13px; opacity: 0.9; }
      .alert-banner { background-color: ${bannerColor}; color: #ffffff; padding: 12px 20px; text-align: center; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
      .content { padding: 30px; }
      .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
      .table-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0; }
      .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
      .row:last-child { border-bottom: none; }
      .label { color: #64748b; font-weight: 500; }
      .val { color: #0f172a; font-weight: 600; text-align: right; }
      .btn { display: block; width: fit-content; margin: 25px auto 10px auto; background-color: #1e40af; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; text-align: center; }
      .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>ALL INDIA COUNCIL FOR TECHNICAL EDUCATION</h1>
        <p>Bureau of Regulation & Approval — AICTE FDR Shield Portal</p>
      </div>

      <div class="alert-banner">
        ⚠️ REGULATORY NOTIFICATION: ${badgeText}
      </div>

      <div class="content">
        <p class="greeting">Dear Nodal Officer / Authorized Signatory,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          This is an automated regulatory alert regarding the security deposit / Fixed Deposit Receipt (FDR) lodged with AICTE for academic approval.
        </p>

        <div class="table-card">
          <div class="row"><span class="label">Institution Name</span><span class="val">${institution.name}</span></div>
          <div class="row"><span class="label">AICTE Permanent ID</span><span class="val">${institution.aicte_code}</span></div>
          <div class="row"><span class="label">FDR Certificate Number</span><span class="val">${fdr.fdr_number}</span></div>
          <div class="row"><span class="label">Issuing Bank</span><span class="val">${fdr.bank_name}</span></div>
          <div class="row"><span class="label">FDR Deposit Amount</span><span class="val">${amountFormatted}</span></div>
          <div class="row"><span class="label">Scheduled Maturity Date</span><span class="val">${maturityDateFormatted}</span></div>
        </div>

        <p style="font-size: 13px; color: #475569; line-height: 1.5;">
          <strong>Action Required:</strong> ${
            isOverdue
              ? '<span style="color:#dc2626; font-weight:700;">This deposit has matured and is currently overdue. Submit an immediate renewal receipt or formal discharge application to avoid compliance proceedings.</span>'
              : 'Please prepare the necessary rollover documentation or apply for a discharge clearance well before the maturity date.'
          }
        </p>

        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" class="btn">
          Login to FDR Shield Portal
        </a>
      </div>

      <div class="footer">
        © 2026 AICTE FDR Shield. Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070.<br/>
        This is an official system-generated notification. Please do not reply directly to this email.
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Dispatch multi-channel alert (Email, SMS, WhatsApp) and record to alerts table
 * @returns {Promise<{emailSent: boolean, smsSent: boolean, whatsappSent: boolean, alertId: string}>}
 */
async function sendFDRAlert(fdr, institution, alertType, daysRemaining) {
  const isOverdue = daysRemaining < 0;
  const statusStr = isOverdue ? 'OVERDUE' : `Expiring in ${daysRemaining} days`;

  const subject = `AICTE Regulatory Notice: FDR ${fdr.fdr_number} is ${statusStr}`;
  const htmlContent = await buildEmailHTML(fdr, institution, daysRemaining, alertType);

  const briefMessage = `AICTE FDR Shield: FDR ${fdr.fdr_number} of ${institution.name} is ${statusStr} (${new Date(fdr.maturity_date).toLocaleDateString('en-IN')}). Login to take action: ${process.env.CLIENT_URL || 'http://localhost:3000'}`;

  // 1. Dispatch Email
  const emailRes = await sendEmail(institution.contact_email, subject, htmlContent);

  // 2. Dispatch SMS
  const smsRes = await sendSMS(institution.contact_phone, briefMessage);

  // 3. Dispatch WhatsApp
  const waRes = await sendWhatsApp(institution.contact_phone, briefMessage);

  const overallStatus = emailRes.sent || smsRes.sent || waRes.sent ? 'sent' : 'failed';

  // 4. Save to alerts table
  const insertSql = `
    INSERT INTO alerts (
      fdr_id,
      institution_id,
      alert_type,
      email_sent,
      sms_sent,
      whatsapp_sent,
      sent_at,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7)
    RETURNING id
  `;

  const alertRow = await query(insertSql, [
    fdr.id,
    institution.id,
    alertType,
    emailRes.sent,
    smsRes.sent,
    waRes.sent,
    overallStatus,
  ]);

  return {
    alertId: alertRow.rows[0].id,
    emailSent: emailRes.sent,
    smsSent: smsRes.sent,
    whatsappSent: waRes.sent,
  };
}

module.exports = {
  sendEmail,
  sendSMS,
  sendWhatsApp,
  buildEmailHTML,
  sendFDRAlert,
};
