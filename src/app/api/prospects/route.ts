/**
 * POST /api/prospects — Create prospect + schedule post-demo sequence
 * GET  /api/prospects — List active prospects
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prospectDb } from '@/lib/prospect-db';
import { ProspectSchedulerService } from '@/services/prospect-scheduler.service';
import { calculateROI, formatCurrency } from '@/lib/roi-calculator';
import type { Prospect } from '@/types/prospect';

export const dynamic = 'force-dynamic';

const CreateProspectSchema = z.object({
  name: z.string().min(1, 'Name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().nullish().transform((v) => (v && v.trim() ? v.trim() : null)),
  agency_name: z.string().min(1, 'Agency name required'),
  proposals_per_month: z.preprocess(
    (v) => { if (v === '' || v === undefined || v === null) return null; const n = Number(v); return Number.isNaN(n) ? null : n; },
    z.union([z.number().int().positive(), z.null()])
  ),
  avg_deal_size: z.preprocess(
    (v) => { if (v === '' || v === undefined || v === null) return null; const n = Number(v); return Number.isNaN(n) ? null : n; },
    z.union([z.number().int().positive(), z.null()])
  ),
  close_rate: z.preprocess(
    (v) => { if (v === '' || v === undefined || v === null) return null; const n = Number(v); return Number.isNaN(n) ? null : n; },
    z.union([z.number().min(1).max(99), z.null()])
  ),
  time_to_cash_days: z.preprocess(
    (v) => { if (v === '' || v === undefined || v === null) return null; const n = Number(v); return Number.isNaN(n) ? null : n; },
    z.union([z.number().int().positive(), z.null()])
  ),
  objection_type: z.enum([
    'NEED_PARTNER_APPROVAL',
    'CHECKING_INTEGRATIONS',
    'REVIEWING_PIPELINE',
    'NEED_TIME_TO_THINK',
    'PRICE_CONCERN',
    'OTHER',
  ]).default('OTHER'),
  notes: z.string().nullish().transform((v) => (v && v.trim() ? v.trim() : null)),
  demo_date: z.string().min(1, 'Demo date required'),
  pricing_page_url: z.string().url().optional().or(z.literal('')),
  agency_proposal_link: z
    .union([z.string().url(), z.literal(''), z.null(), z.undefined()])
    .optional()
    .transform((v) => (!v || (typeof v === 'string' && !v.trim()) ? null : v)),
  assessment_link: z
    .union([z.string().url(), z.literal(''), z.null(), z.undefined()])
    .optional()
    .transform((v) => (!v || (typeof v === 'string' && !v.trim()) ? null : v)),
  workspace_link: z
    .union([z.string().url(), z.literal(''), z.null(), z.undefined()])
    .optional()
    .transform((v) => (!v || (typeof v === 'string' && !v.trim()) ? null : v)),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateProspectSchema.parse(body);

    const existing = await prospectDb.prospects.findByEmail(parsed.email);
    if (existing) {
      return NextResponse.json(
        { error: 'Active prospect already exists for this email', prospect_id: existing.id },
        { status: 409 }
      );
    }

    const prospect = await prospectDb.prospects.insert({
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      phone: parsed.phone || null,
      agency_name: parsed.agency_name,
      proposals_per_month: parsed.proposals_per_month ?? null,
      avg_deal_size: parsed.avg_deal_size ?? null,
      close_rate: parsed.close_rate ?? null,
      time_to_cash_days: parsed.time_to_cash_days ?? null,
      objection_type: parsed.objection_type,
      notes: parsed.notes || null,
      demo_date: parsed.demo_date,
      status: 'ACTIVE',
      pricing_page_url: parsed.pricing_page_url || process.env.PRICING_PAGE_URL || 'https://elystra.com/pricing',
      agency_proposal_link: parsed.agency_proposal_link ?? null,
      assessment_link: parsed.assessment_link ?? null,
      workspace_link: parsed.workspace_link ?? null,
    });

    await ProspectSchedulerService.scheduleSequence(prospect);

    const roi = calculateROI(prospect);

    console.log(
      `[PROSPECT] Created ${prospect.id} for ${prospect.agency_name} (${prospect.email}). ` +
      `Gap: ${formatCurrency(roi.monthly_revenue_gap)}/mo, ${formatCurrency(roi.annual_revenue_gap)}/yr`
    );

    return NextResponse.json({
      status: 'created',
      prospect_id: prospect.id,
      agency: prospect.agency_name,
      sequence_scheduled: true,
      roi_summary: {
        current_monthly: formatCurrency(roi.current_monthly_revenue),
        projected_monthly: formatCurrency(roi.elystra_monthly_revenue),
        monthly_gap: formatCurrency(roi.monthly_revenue_gap),
        annual_gap: formatCurrency(roi.annual_revenue_gap),
        extra_deals: roi.extra_deals_per_month,
        time_saved_days: roi.time_to_cash_saved_days,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[PROSPECT] Create error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    const prospects = statusFilter
      ? await prospectDb.prospects.listActive()
      : await prospectDb.prospects.listAll();

    const enriched = prospects.map((p: Prospect) => {
      const roi = calculateROI(p);
      return {
        ...p,
        roi: {
          monthly_gap: roi.monthly_revenue_gap,
          annual_gap: roi.annual_revenue_gap,
          elystra_close_rate: roi.elystra_close_rate,
        },
      };
    });

    return NextResponse.json({ prospects: enriched });
  } catch (error) {
    console.error('[PROSPECT] List error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
