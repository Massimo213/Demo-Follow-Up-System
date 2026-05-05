/**
 * One-off SDR outreach via Gmail SMTP (same credentials as the app).
 * Usage:
 *   node --env-file=.env scripts/send-sdr-outreach.mjs
 *   node --env-file=.env scripts/send-sdr-outreach.mjs --to other@example.com
 *
 * Requires: GMAIL_USER, GMAIL_APP_PASSWORD
 */

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOGO_PATH = path.join(ROOT, 'assets', 'elystra-logo.png');

function parseArgs() {
  const args = process.argv.slice(2);
  let to = 'elystrateam@gmail.com';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--to' && args[i + 1]) {
      to = args[i + 1];
      i++;
    }
  }
  return { to };
}

function buildHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr>
          <td style="padding:28px 32px 8px;font-size:16px;line-height:1.65;color:#1a1a1a;">
            <p style="margin:0 0 16px;">Hi There</p>
            <p style="margin:0 0 16px;">We reviewed your profile and application and noticed your experience in sales.</p>
            <p style="margin:0 0 16px;">We're currently building a small remote SDR team and your background looks relevant enough to have a direct conversation.</p>
            <p style="margin:0 0 16px;">So this is not a role where someone is expected to figure everything out alone. The goal is simple: step in, execute, and perform.<br>
            Nothing Corporate. We'd like to have a short conversation with you to see if there is a fit on both sides.</p>
            <p style="margin:0 0 16px;">What day of the week do you have available between 12 PM and 2 PM?</p>
            <p style="margin:0 0 16px;">Send over what works best and we'll move forward from there.</p>
            <p style="margin:24px 0 0;color:#1a1a1a;">Best,</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#0a0f1a 0%,#121a2e 50%,#1a1033 100%);border-radius:10px;overflow:hidden;border:1px solid rgba(56,189,248,.25);">
              <tr>
                <td style="padding:20px 24px;vertical-align:middle;width:120px;">
                  <img src="cid:elystralogo" alt="Elystra" width="104" height="auto" style="display:block;border:0;max-width:104px;height:auto;">
                </td>
                <td style="padding:20px 24px 20px 0;vertical-align:middle;">
                  <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#67e8f9;font-weight:700;margin:0 0 6px;">Elystra Infrastructure Systems LLC</div>
                  <div style="font-size:13px;line-height:1.5;color:#e2e8f0;margin:0;">
                    <span style="color:#a5b4fc;">t.</span> <a href="tel:+14385271026" style="color:#f8fafc;text-decoration:none;">438&nbsp;527&nbsp;1026</a>
                    <span style="color:#475569;margin:0 10px;">·</span>
                    <span style="color:#a5b4fc;">t.</span> <a href="tel:+15148047055" style="color:#f8fafc;text-decoration:none;">514&nbsp;804&nbsp;7055</a>
                  </div>
                  <div style="font-size:12px;color:#94a3b8;margin-top:8px;line-height:1.4;">
                    Proposal-to-cash infrastructure for agencies — scope, send, sign, collect.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function buildText() {
  return `Hi There

We reviewed your profile and application and noticed your experience in sales.

We're currently building a small remote SDR team and your background looks relevant enough to have a direct conversation.

So this is not a role where someone is expected to figure everything out alone. The goal is simple: step in, execute, and perform.
Nothing Corporate. We'd like to have a short conversation with you to see if there is a fit on both sides.

What day of the week do you have available between 12 PM and 2 PM?

Send over what works best and we'll move forward from there.

Best,

—
Elystra Infrastructure Systems LLC
438 527 1026 · 514 804 7055
`;
}

async function main() {
  const { to } = parseArgs();
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error('Missing GMAIL_USER or GMAIL_APP_PASSWORD (use .env via node --env-file=.env)');
    process.exit(1);
  }

  if (!fs.existsSync(LOGO_PATH)) {
    console.error('Logo not found:', LOGO_PATH);
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const fromName = 'Elystra';
  const from = `"${fromName}" <${user}>`;

  const info = await transporter.sendMail({
    from,
    to,
    replyTo: user,
    subject: 'SDR B2B SaaS role - conversation this week',
    text: buildText(),
    html: buildHtml(),
    attachments: [
      {
        filename: 'elystra-logo.png',
        path: LOGO_PATH,
        cid: 'elystralogo',
      },
    ],
  });

  console.log('Sent:', to, info.messageId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
