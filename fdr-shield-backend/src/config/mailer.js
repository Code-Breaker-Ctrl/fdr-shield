const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS, // Use a 16-character Google App Password
  },
});

/**
 * Send an official AICTE FDR Shield notification email
 * @param {Object} options - { to, subject, html, text, attachments }
 */
const sendMail = async ({ to, subject, html, text, attachments = [] }) => {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      console.warn(`[MAILER MOCK] Email to ${to} skipped (GMAIL credentials not set). Subject: ${subject}`);
      return { mocked: true, to, subject };
    }

    const info = await transporter.sendMail({
      from: `"AICTE Regulation Bureau - FDR Shield" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: text || 'Please view this email in an HTML-compatible client.',
      html,
      attachments,
    });

    console.log(`[MAILER] Email sent to ${to} | MessageID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[MAILER ERROR] Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

module.exports = {
  transporter,
  sendMail,
};