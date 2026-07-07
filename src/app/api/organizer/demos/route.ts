import { NextRequest, NextResponse } from 'next/server';
import { isOrganizerRequest } from '@/lib/organizer-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!(await isOrganizerRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const viewParam = request.nextUrl.searchParams.get('view');
  const view =
    viewParam === 'pqad' ? 'pqad' : viewParam === 'rescue' ? 'rescue' : 'booked';
  const periodParam = request.nextUrl.searchParams.get('period');
  const period = periodParam === 'past' ? 'past' : 'upcoming';
  const demos = await db.demos.listForOrganizer(view, period);
  return NextResponse.json({ view, period, demos });
}
