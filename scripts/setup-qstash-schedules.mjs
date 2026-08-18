#!/usr/bin/env node
/**
 * Create QStash schedules for /api/cron (every minute) and /api/sync/calendly (every 5 min).
 * Requires valid QSTASH_TOKEN in env (refresh from Upstash console if 401).
 *
 * Usage: node --env-file=.env scripts/setup-qstash-schedules.mjs
 */

const token = (process.env.QSTASH_TOKEN ?? '').trim();
const appUrl = (process.env.APP_URL ?? 'https://demo-followup.vercel.app').trim().replace(/\/$/, '');

if (!token) {
  console.error('Missing QSTASH_TOKEN');
  process.exit(1);
}

const schedules = [
  {
    destination: `${appUrl}/api/cron`,
    cron: '* * * * *',
    label: 'demo-followup-cron',
  },
  {
    destination: `${appUrl}/api/sync/calendly`,
    cron: '*/5 * * * *',
    label: 'demo-followup-calendly-sync',
  },
];

async function qstash(path, init = {}) {
  const res = await fetch(`https://qstash.upstash.io/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  const existing = await qstash('/schedules');
  const list = Array.isArray(existing) ? existing : existing?.schedules ?? [];

  for (const spec of schedules) {
    const dup = list.find(
      (s) => s.destination === spec.destination || s.scheduleId?.includes(spec.label)
    );
    if (dup) {
      console.log(`skip (exists): ${spec.destination} → ${dup.scheduleId ?? dup.id}`);
      continue;
    }

    const created = await qstash('/schedules', {
      method: 'POST',
      body: JSON.stringify({
        destination: spec.destination,
        cron: spec.cron,
        scheduleId: spec.label,
        method: 'GET',
      }),
    });
    console.log(`created: ${spec.destination}`, created.scheduleId ?? created);
  }

  console.log('done');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
