/**
 * Send footer preview via Gmail SMTP (falls back to Resend if GMAIL_* missing).
 * Usage: node --env-file=.env.local scripts/send-footer-preview.mjs
 */

import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const to = process.argv.includes('--to')
  ? process.argv[process.argv.indexOf('--to') + 1]
  : 'elystrateam@gmail.com';

const COMPANY_NAME = 'Elystra Systems LLC';
const PHONE_DISPLAY = '438 527 1026';
const PHONE_TEL = '+14385271026';
const WEBSITE = 'https://www.elystra.online';
const WEBSITE_LABEL = 'elystra.online';
const TAGLINE = 'Revenue sales infrastructure for agencies';
const LOGO_URL =
  process.env.ELYSTRA_LOGO_URL ||
  'https://demo-follow-up-system.vercel.app/LogoElystra-email.png';
const RESCHEDULE_URL = 'https://elystra.online/reschedule';

const footerHtml = `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
  <tr>
    <td style="width:72px;vertical-align:top;padding-right:16px;">
      <img src="${LOGO_URL}" alt="Elystra" width="64" height="64" style="display:block;border:0;max-width:64px;height:auto;" />
    </td>
    <td style="vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="font-size:13px;font-weight:600;color:#111827;margin:0 0 4px;">${COMPANY_NAME}</div>
      <div style="font-size:13px;line-height:1.5;color:#374151;margin:0 0 4px;">
        <a href="tel:${PHONE_TEL}" style="color:#374151;text-decoration:none;">${PHONE_DISPLAY}</a>
        <span style="color:#9ca3af;margin:0 8px;">·</span>
        <a href="${WEBSITE}" style="color:#374151;text-decoration:none;">${WEBSITE_LABEL}</a>
      </div>
      <div style="font-size:12px;line-height:1.5;color:#6b7280;margin:0 0 6px;">${TAGLINE}</div>
      <div style="font-size:11px;color:#9ca3af;">Trusted by 170+ agencies · Marketing · Performance · Creative</div>
    </td>
  </tr>
</table>`;

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;padding:20px;">
<p>Hey Massimo,</p>
<p>This is a <strong>test email</strong> from the follow-up system — same footer + logo URL as production.</p>
<p><strong>Reply YES to confirm.</strong></p>
<p><a href="${RESCHEDULE_URL}" style="display:inline-block;background:#0066ff;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600;">Reschedule</a> if you need a different time.</p>
${footerHtml}
</body></html>`;

const text = `Hey Massimo,

This is a test email from the follow-up system.

Reply YES to confirm.
Reschedule: ${RESCHEDULE_URL}

—
${COMPANY_NAME}
${PHONE_DISPLAY} · ${WEBSITE_LABEL}
${TAGLINE}
Trusted by 170+ agencies · Marketing · Performance · Creative`;

const subject = 'TEST — Elystra follow-up (logo + footer)';

const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;

if (gmailUser && gmailPass) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  const info = await transporter.sendMail({
    from: `"David from Elystra" <${gmailUser}>`,
    to,
    subject,
    html,
    text,
    replyTo: gmailUser,
  });

  console.log(JSON.stringify({ status: 'sent', via: 'gmail', to, from: gmailUser, id: info.messageId }));
  process.exit(0);
}

const from = process.env.EMAIL_FROM;
const apiKey = process.env.RESEND_API_KEY;

if (!from || !apiKey) {
  console.error('Set GMAIL_USER + GMAIL_APP_PASSWORD, or EMAIL_FROM + RESEND_API_KEY');
  process.exit(1);
}

const resend = new Resend(apiKey);
const result = await resend.emails.send({
  from,
  to,
  subject,
  html,
  text,
});

if (result.error) {
  console.error('Resend error:', result.error);
  process.exit(1);
}

console.log(JSON.stringify({ status: 'sent', via: 'resend', to, from, id: result.data?.id }));
