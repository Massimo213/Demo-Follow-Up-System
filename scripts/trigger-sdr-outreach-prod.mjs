/**
 * Triggers POST /api/internal/sdr-outreach on your deployed app.
 * Secrets stay in .env on your machine — nothing is hardcoded here.
 *
 * Required in .env:
 *   APP_URL or ELYSTRA_APP_ORIGIN  — e.g. https://demo-follow-up-system.vercel.app
 *   DEMO_ORGANIZER_SECRET         — same as organizer login (Bearer)
 *
 * Optional:
 *   SDR_OUTREACH_TO — default elystrateam@gmail.com
 *
 * Usage:
 *   node --env-file=.env scripts/trigger-sdr-outreach-prod.mjs
 *   node --env-file=.env scripts/trigger-sdr-outreach-prod.mjs --to other@email.com
 */

function parseArgs() {
  const args = process.argv.slice(2);
  let to = process.env.SDR_OUTREACH_TO || 'elystrateam@gmail.com';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--to' && args[i + 1]) {
      to = args[i + 1];
      i++;
    }
  }
  return { to };
}

function getOrigin() {
  const raw = (process.env.ELYSTRA_APP_ORIGIN || process.env.APP_URL || '').trim();
  if (!raw) return null;
  const withProto = raw.startsWith('http') ? raw : `https://${raw}`;
  try {
    return new URL(withProto).origin;
  } catch {
    return null;
  }
}

async function main() {
  const origin = getOrigin();
  const secret = process.env.DEMO_ORGANIZER_SECRET?.trim();
  const { to } = parseArgs();

  if (!origin) {
    console.error('Set APP_URL or ELYSTRA_APP_ORIGIN in .env (e.g. https://your-app.vercel.app)');
    process.exit(1);
  }
  if (!secret) {
    console.error('Set DEMO_ORGANIZER_SECRET in .env (same value as organizer gate)');
    process.exit(1);
  }

  const url = `${origin}/api/internal/sdr-outreach`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    console.error(res.status, json);
    process.exit(1);
  }

  console.log(json);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
