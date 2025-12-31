/**
 * Calendly Sync Endpoint
 * Polls Calendly API for new bookings (works on free plan)
 * 
 * IDEMPOTENCY:
 * - Uses INSERT ON CONFLICT on calendly_event_id (UNIQUE constraint)
 * - Safe to call multiple times - duplicates are ignored
 * 
 * GET /api/sync/calendly
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SchedulerService } from '@/services/scheduler.service';
import { DemoService } from '@/services/demo.service';
import { addHours, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

const CALENDLY_TOKEN = process.env.CALENDLY_WEBHOOK_SECRET;
const CALENDLY_USER_URI = 'https://api.calendly.com/users/b2753ddb-5c42-4488-ac4f-db692038e488';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

interface CalendlyEvent {
  uri: string;
  name: string;
  start_time: string;
  end_time: string;
  event_type: string;
  location?: {
    join_url?: string;
  };
  invitees_counter: {
    active: number;
  };
}

interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  status: string;
  timezone: string;
}

export async function GET() {
  const syncId = crypto.randomUUID().slice(0, 8);
  
  try {
    console.log(`[SYNC:${syncId}] Starting Calendly sync...`);
    
    if (!CALENDLY_TOKEN) {
      return NextResponse.json({ error: 'Missing Calendly token' }, { status: 500 });
    }

    const supabase = getSupabase();

    // Get scheduled events from last 24 hours to next 14 days
    const minTime = new Date();
    minTime.setHours(minTime.getHours() - 24);
    const maxTime = addHours(new Date(), 24 * 14);

    // Fetch scheduled events
    const eventsRes = await fetch(
      `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(CALENDLY_USER_URI)}&min_start_time=${minTime.toISOString()}&max_start_time=${maxTime.toISOString()}&status=active`,
      {
        headers: {
          'Authorization': `Bearer ${CALENDLY_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!eventsRes.ok) {
      const error = await eventsRes.text();
      console.error(`[SYNC:${syncId}] Calendly API error:`, error);
      return NextResponse.json({ error: 'Calendly API error', details: error }, { status: 500 });
    }

    const eventsData = await eventsRes.json();
    const events: CalendlyEvent[] = eventsData.collection || [];

    console.log(`[SYNC:${syncId}] Found ${events.length} scheduled events`);

    const results = [];
    const skipped = [];

    for (const event of events) {
      const eventUuid = event.uri.split('/').pop()!;

      // Check if already exists (quick check before fetching invitees)
      const { data: existingDemo } = await supabase
        .from('demos')
        .select('id')
        .eq('calendly_event_id', eventUuid)
        .single();

      if (existingDemo) {
        skipped.push(eventUuid);
        continue;
      }

      // Fetch invitee details
      const inviteesRes = await fetch(
        `${event.uri}/invitees`,
        {
          headers: {
            'Authorization': `Bearer ${CALENDLY_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!inviteesRes.ok) {
        console.error(`[SYNC:${syncId}] Failed to fetch invitees for ${eventUuid}`);
        continue;
      }

      const inviteesData = await inviteesRes.json();
      const invitees: CalendlyInvitee[] = inviteesData.collection || [];

      if (invitees.length === 0) {
        console.log(`[SYNC:${syncId}] No invitees for ${eventUuid}, skipping`);
        continue;
      }

      const invitee = invitees[0];
      const demoTime = parseISO(event.start_time);
      const demoType = DemoService.classifyDemoType(demoTime);

      // ATOMIC INSERT - uses ON CONFLICT to handle race conditions
      const { data: newDemo, error: insertError } = await supabase
        .from('demos')
        .upsert({
          calendly_event_id: eventUuid,
          calendly_invitee_id: invitee.uri.split('/').pop() || '',
          email: invitee.email,
          name: invitee.name,
          phone: null,
          scheduled_at: event.start_time,
          demo_type: demoType,
          status: 'PENDING',
          join_url: event.location?.join_url || `https://calendly.com/onboarding-elystra/30min`,
          timezone: invitee.timezone || 'America/New_York',
          created_at: new Date().toISOString()
        }, {
          onConflict: 'calendly_event_id',
          ignoreDuplicates: true // Don't update if exists, just skip
        })
        .select()
        .single();

      // If no data returned, it was a duplicate (ignored)
      if (!newDemo) {
        console.log(`[SYNC:${syncId}] Event ${eventUuid} already exists (race condition handled)`);
        skipped.push(eventUuid);
        continue;
      }

      if (insertError) {
        // Check if it's a unique constraint violation (another process inserted first)
        if (insertError.code === '23505') {
          console.log(`[SYNC:${syncId}] Event ${eventUuid} already exists (constraint)`);
          skipped.push(eventUuid);
          continue;
        }
        console.error(`[SYNC:${syncId}] Failed to create demo for ${eventUuid}:`, insertError);
        continue;
      }

      console.log(`[SYNC:${syncId}] Created demo ${newDemo.id} for ${invitee.email}`);

      // Schedule follow-up messages
      await SchedulerService.scheduleSequence(newDemo);

      results.push({
        event_id: eventUuid,
        email: invitee.email,
        scheduled_at: event.start_time,
        demo_type: demoType
      });
    }

    // Handle cancellations
    const cancelledRes = await fetch(
      `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(CALENDLY_USER_URI)}&min_start_time=${minTime.toISOString()}&max_start_time=${maxTime.toISOString()}&status=canceled`,
      {
        headers: {
          'Authorization': `Bearer ${CALENDLY_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let cancelledCount = 0;
    if (cancelledRes.ok) {
      const cancelledData = await cancelledRes.json();
      const cancelledEvents: CalendlyEvent[] = cancelledData.collection || [];

      for (const event of cancelledEvents) {
        const eventUuid = event.uri.split('/').pop()!;

        // Update demo status if exists and is still pending
        const { data: updated } = await supabase
          .from('demos')
          .update({ status: 'CANCELLED' })
          .eq('calendly_event_id', eventUuid)
          .in('status', ['PENDING', 'CONFIRMED'])
          .select('id');

        if (updated && updated.length > 0) {
          // Cancel all pending jobs for this demo
          await supabase
            .from('scheduled_jobs')
            .update({ cancelled: true })
            .eq('demo_id', updated[0].id)
            .eq('executed', false);
          
          cancelledCount++;
        }
      }
    }

    return NextResponse.json({
      status: 'ok',
      sync_id: syncId,
      synced: results.length,
      skipped: skipped.length,
      cancelled: cancelledCount,
      events_found: events.length,
      new_demos: results
    });
  } catch (error) {
    console.error(`[SYNC:${syncId}] Error:`, error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
