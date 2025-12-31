/**
 * Calendly Webhook Handler
 * Receives booking events and initiates followup sequences
 * 
 * POST /api/webhooks/calendly
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { DemoService } from '@/services/demo.service';
import { SchedulerService } from '@/services/scheduler.service';
import type { CalendlyEvent } from '@/types/demo';

/**
 * Verify Calendly webhook signature
 * https://developer.calendly.com/api-docs/dcb40d6d4c8e5-webhook-signature-verification
 */
function verifyCalendlySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const [t, v1] = signature.split(',').reduce(
    (acc, part) => {
      const [key, value] = part.split('=');
      if (key === 't') acc[0] = value;
      if (key === 'v1') acc[1] = value;
      return acc;
    },
    ['', '']
  );

  if (!t || !v1) return false;

  const signedPayload = `${t}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(v1),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('calendly-webhook-signature');
    const secret = process.env.CALENDLY_WEBHOOK_SECRET;

    // Verify signature in production
    if (secret && signature) {
      const isValid = verifyCalendlySignature(body, signature, secret);
      if (!isValid) {
        console.error('Invalid Calendly webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const event: CalendlyEvent = JSON.parse(body);

    // Handle different event types
    switch (event.event) {
      case 'invitee.created':
        return handleBookingCreated(event);

      case 'invitee.canceled':
        return handleBookingCanceled(event);

      default:
        console.log(`Unhandled Calendly event: ${event.event}`);
        return NextResponse.json({ status: 'ignored' });
    }
  } catch (error) {
    console.error('Calendly webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle new booking
 */
async function handleBookingCreated(event: CalendlyEvent) {
  console.log('New booking:', event.payload.invitee.email);

  // Create demo record
  const demo = await DemoService.createFromCalendly(event);

  // Schedule the followup sequence
  await SchedulerService.scheduleSequence(demo);

  console.log(`Demo ${demo.id} created with type ${demo.demo_type}`);
  console.log(`Scheduled followup sequence for ${demo.email}`);

  return NextResponse.json({
    status: 'created',
    demo_id: demo.id,
    demo_type: demo.demo_type,
  });
}

/**
 * Handle booking cancellation
 */
async function handleBookingCanceled(event: CalendlyEvent) {
  console.log('Booking canceled:', event.payload.invitee.email);

  const eventId = event.payload.scheduled_event.uuid;

  // Update demo status and cancel jobs
  await DemoService.cancel(eventId);

  const demo = await DemoService.getByCalendlyEventId(eventId);
  if (demo) {
    await SchedulerService.cancelAllJobs(demo.id);
    console.log(`Demo ${demo.id} canceled, all jobs removed`);
  }

  return NextResponse.json({ status: 'canceled' });
}


