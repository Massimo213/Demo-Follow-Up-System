const COMPANY_NAME = 'Elystra Systems LLC';
const PHONE_DISPLAY = '438 527 1026';
const PHONE_TEL = '+14385271026';
const WEBSITE = 'https://www.elystra.online';
const WEBSITE_LABEL = 'elystra.online';
const TAGLINE = 'Revenue sales infrastructure for agencies';

/** Public HTTPS logo — Gmail reliably loads hosted images; CID inline attachments often fail */
export function getElystraLogoUrl(): string {
  if (process.env.ELYSTRA_LOGO_URL?.trim()) {
    return process.env.ELYSTRA_LOGO_URL.trim();
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}/LogoElystra-email.png`;
  }
  const app = process.env.APP_URL?.trim();
  if (app) {
    const origin = app.startsWith('http') ? app : `https://${app}`;
    return `${origin.replace(/\/$/, '')}/LogoElystra-email.png`;
  }
  return 'https://demo-follow-up-system.vercel.app/LogoElystra-email.png';
}

export function buildEmailFooterHtml(): string {
  const logoUrl = getElystraLogoUrl();
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
  <tr>
    <td style="width:72px;vertical-align:top;padding-right:16px;">
      <img src="${logoUrl}" alt="Elystra" width="64" height="64" style="display:block;border:0;max-width:64px;height:auto;" />
    </td>
    <td style="vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="font-size:13px;font-weight:600;color:#111827;margin:0 0 4px;">${COMPANY_NAME}</div>
      <div style="font-size:13px;line-height:1.5;color:#374151;margin:0 0 4px;">
        <a href="tel:${PHONE_TEL}" style="color:#374151;text-decoration:none;">${PHONE_DISPLAY}</a>
        <span style="color:#9ca3af;margin:0 8px;">·</span>
        <a href="${WEBSITE}" style="color:#374151;text-decoration:none;">${WEBSITE_LABEL}</a>
      </div>
      <div style="font-size:12px;line-height:1.5;color:#6b7280;margin:0 0 6px;">${TAGLINE}</div>
      <div style="font-size:11px;color:#9ca3af;letter-spacing:0.02em;">Trusted by 170+ agencies &nbsp;·&nbsp; Marketing &nbsp;·&nbsp; Performance &nbsp;·&nbsp; Creative</div>
    </td>
  </tr>
</table>`;
}

export function buildEmailFooterText(): string {
  return `—
${COMPANY_NAME}
${PHONE_DISPLAY} · ${WEBSITE_LABEL}
${TAGLINE}
Trusted by 170+ agencies · Marketing · Performance · Creative`;
}

const BASE_EMAIL_STYLES = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; }
    .cta { display: inline-block; background: #0066ff; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .cta:hover { background: #0052cc; }
    .muted { color: #666; font-size: 14px; }
`;

export function wrapEmailHtml(content: string, extraStyles = ''): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${BASE_EMAIL_STYLES}${extraStyles}
  </style>
</head>
<body>
${content}
${buildEmailFooterHtml()}
</body>
</html>`;
}

export function appendEmailTextFooter(text: string): string {
  const trimmed = text.trimEnd();
  return `${trimmed}\n\n${buildEmailFooterText()}`;
}

export const POST_DEMO_EMAIL_STYLES = `
    body { line-height: 1.7; }
    .cta { padding: 14px 28px; margin: 20px 0; font-size: 15px; }
    .numbers-box { background: #f8f9fa; border-left: 4px solid #0066ff; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0; }
    .numbers-box strong { color: #0066ff; }
    .gap-box { background: #fff3f3; border-left: 4px solid #e53e3e; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0; }
    .gap-box strong { color: #e53e3e; }
    .result-box { background: #f0fff4; border-left: 4px solid #38a169; padding: 16px 20px; margin: 20px 0; border-radius: 0 6px 6px 0; }
    .forward-block { background: #f8f9fa; border: 1px solid #e2e8f0; padding: 20px; margin: 20px 0; font-style: italic; border-radius: 6px; }
    table.delta { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    table.delta th, table.delta td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    table.delta th { background: #f8f9fa; font-weight: 600; }
    .result-box strong { color: #38a169; }
    ul.recap { margin: 12px 0; padding-left: 20px; }
    ul.recap li { margin: 6px 0; }
    h3 { font-size: 16px; margin: 24px 0 12px; color: #1a1a1a; }
    hr.sep { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
`;
