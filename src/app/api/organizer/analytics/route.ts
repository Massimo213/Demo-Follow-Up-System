import { NextRequest, NextResponse } from 'next/server';
import { isOrganizerRequest } from '@/lib/organizer-auth';
import { db } from '@/lib/db';
import { buildShowRateReport, type AnalyticsWindow } from '@/lib/show-rate';
import type { Message } from '@/types/demo';

export const dynamic = 'force-dynamic';

function parseWindow(raw: string | null): AnalyticsWindow {
  if (raw === '7d' || raw === '14d' || raw === '90d') return raw;
  return '30d';
}

export async function GET(request: NextRequest) {
  if (!(await isOrganizerRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const window = parseWindow(request.nextUrl.searchParams.get('window'));
  const [demos, messages] = await Promise.all([
    db.demos.listForAnalytics(),
    db.messages.listForAnalytics(),
  ]);
  const messagesByDemo = new Map<string, Message[]>();
  for (const m of messages) {
    const list = messagesByDemo.get(m.demo_id) || [];
    list.push(m);
    messagesByDemo.set(m.demo_id, list);
  }
  const report = buildShowRateReport(demos, messagesByDemo, window);
  return NextResponse.json(report, {
    headers: {
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
    },
  });
}
