/**
 * PATCH /api/prospects/:id — Update prospect status (close-won, close-lost, pause)
 * GET   /api/prospects/:id — Get prospect details + ROI
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prospectDb } from '@/lib/prospect-db';
import { ProspectSchedulerService } from '@/services/prospect-scheduler.service';
import { calculateROI, formatCurrency } from '@/lib/roi-calculator';

export const dynamic = 'force-dynamic';

const UpdateSchema = z.object({
  status: z.enum(['CLOSED_WON', 'CLOSED_LOST', 'PAUSED', 'ACTIVE']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { status } = UpdateSchema.parse(body);

    const prospect = await prospectDb.prospects.findById(params.id);
    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    if (['CLOSED_WON', 'CLOSED_LOST'].includes(status)) {
      await ProspectSchedulerService.cancelAllJobs(prospect.id);
    }

    const updated = await prospectDb.prospects.updateStatus(prospect.id, status);

    console.log(`[PROSPECT] ${prospect.agency_name} → ${status}`);

    return NextResponse.json({ status: 'updated', prospect: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    console.error('[PROSPECT] Update error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const prospect = await prospectDb.prospects.findById(params.id);
    if (!prospect) {
      return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    }

    const roi = calculateROI(prospect);
    const messages = await prospectDb.messages.findByProspect(prospect.id);

    return NextResponse.json({
      prospect,
      roi: {
        current_monthly: formatCurrency(roi.current_monthly_revenue),
        projected_monthly: formatCurrency(roi.elystra_monthly_revenue),
        monthly_gap: formatCurrency(roi.monthly_revenue_gap),
        annual_gap: formatCurrency(roi.annual_revenue_gap),
        daily_leak: formatCurrency(roi.daily_leak),
        extra_deals: roi.extra_deals_per_month,
        elystra_close_rate: roi.elystra_close_rate,
      },
      messages_sent: messages.length,
      messages,
    });
  } catch (error) {
    console.error('[PROSPECT] Get error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
