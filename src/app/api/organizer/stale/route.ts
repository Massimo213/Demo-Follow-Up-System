import { NextRequest, NextResponse } from 'next/server';
import { isOrganizerRequest } from '@/lib/organizer-auth';
import { db } from '@/lib/db';
import { isStalePendingAlert } from '@/lib/phase0-rules';
import { isTestDemo } from '@/lib/show-rate';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await isOrganizerRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const nowMs = Date.now();
  const demos = await db.demos.listForAnalytics();
  const stale = demos.filter((d) => !isTestDemo(d) && isStalePendingAlert(d, nowMs));

  return NextResponse.json({
    count: stale.length,
    demos: stale.map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      status: d.status,
      scheduled_at: d.scheduled_at,
    })),
  });
}
