/**
 * Calendly Webhook Handler — PRIMARY ingest path.
 * invitee.created / invitee.canceled → demo row + scheduled_jobs in seconds.
 *
 * POST /api/webhooks/calendly
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  calendlySecretMisconfig,
  verifyCalendlyWebhookSignature,
} from '@/lib/calendly';
import { CalendlyIngestService } from '@/services/calendly-ingest.service';
import type { CalendlyEvent } from '@/types/demo';

export const dynamic = 'force-dynamic';

function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export async function POST(request: NextRequest) {
  try {
    const misconfig = calendlySecretMisconfig();
    if (misconfig) {
      console.error(`[CALENDLY-WH] ${misconfig}`);
      return NextResponse.json({ error: misconfig }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('calendly-webhook-signature');
    const secret = (process.env.CALENDLY_WEBHOOK_SECRET ?? '').trim();

    if (isProduction() && !secret) {
      return NextResponse.json(
        { error: 'CALENDLY_WEBHOOK_SECRET required in production' },
        { status: 500 }
      );
    }

    if (secret) {
      if (!signature) {
        return NextResponse.json({ error: 'Missing calendly-webhook-signature' }, { status: 401 });
      }
      if (!verifyCalendlyWebhookSignature(body, signature, secret)) {
        console.error('[CALENDLY-WH] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event: CalendlyEvent = JSON.parse(body);

    switch (event.event) {
      case 'invitee.created': {
        const result = await CalendlyIngestService.processInviteeCreated(event);
        return NextResponse.json({ status: 'created', ...result });
      }

      case 'invitee.canceled': {
        const result = await CalendlyIngestService.processInviteeCanceled(event);
        return NextResponse.json({ status: 'canceled', ...result });
      }

      default:
        console.log(`[CALENDLY-WH] Ignored event: ${event.event}`);
        return NextResponse.json({ status: 'ignored' });
    }
  } catch (error) {
    console.error('[CALENDLY-WH] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
