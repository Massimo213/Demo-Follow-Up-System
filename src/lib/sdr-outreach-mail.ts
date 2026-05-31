import nodemailer from 'nodemailer';
import { buildEmailFooterHtml, buildEmailFooterText } from '@/lib/email-signature';

export const SDR_OUTREACH_SUBJECT = 'SDR B2B SaaS role - conversation this week';

export function buildSdrOutreachHtml(): string {
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
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;">
            ${buildEmailFooterHtml()}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function buildSdrOutreachText(): string {
  return `Hi There

We reviewed your profile and application and noticed your experience in sales.

We're currently building a small remote SDR team and your background looks relevant enough to have a direct conversation.

So this is not a role where someone is expected to figure everything out alone. The goal is simple: step in, execute, and perform.
Nothing Corporate. We'd like to have a short conversation with you to see if there is a fit on both sides.

What day of the week do you have available between 12 PM and 2 PM?

Send over what works best and we'll move forward from there.

${buildEmailFooterText()}`;
}

export async function sendSdrOutreachEmail(to: string): Promise<{ messageId?: string }> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD not configured');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const from = `"Elystra" <${user}>`;

  const info = await transporter.sendMail({
    from,
    to,
    replyTo: user,
    subject: SDR_OUTREACH_SUBJECT,
    text: buildSdrOutreachText(),
    html: buildSdrOutreachHtml(),
  });

  return { messageId: info.messageId };
}
