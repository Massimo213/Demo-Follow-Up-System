/**
 * POST /api/prospects/stop
 * Stop follow-ups for a prospect by name, email, or agency.
 * Body: { query: "Justin Archer" } or { query: "email@example.com" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prospectDb } from '@/lib/prospect-db';
import { ProspectSchedulerService } from '@/services/prospect-scheduler.service';

export const dynamic = 'force-dynamic';

const Schema = z.object({ query: z.string().min(1, 'query required') });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query } = Schema.parse(body);

    const prospect = await prospectDb.prospects.findActiveBySearch(query);
    if (!prospect) {
      return NextResponse.json(
        { error: 'No active prospect found', query },
        { status: 404 }
      );
    }

    await ProspectSchedulerService.cancelAllJobs(prospect.id);
    const updated = await prospectDb.prospects.updateStatus(prospect.id, 'CLOSED_LOST');

    return NextResponse.json({
      status: 'stopped',
      prospect: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        agency_name: updated.agency_name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'query required' }, { status: 400 });
    }
    console.error('[PROSPECT] Stop error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
