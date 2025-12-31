/**
 * Calendly Sync Endpoint
 * Polls Calendly API for new bookings (works on free plan)
 * 
 * GET /api/sync/calendly
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SchedulerService } from '@/services/scheduler.service';
import { DemoService } from '@/services/demo.service';
import { addHours, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

const CALENDLY_TOKEN = process.env.CALENDLY_WEBHOOK_SECRET; // Using the same env var
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
  try {
    console.log('[SYNC] Starting Calendly sync...');
    
    if (!CALENDLY_TOKEN) {
      return NextResponse.json({ error: 'Missing Calendly token' }, { status: 500 });
    }

    const supabase = getSupabase();

    // Get scheduled events from last 24 hours to next 7 days
    const minTime = new Date();
    minTime.setHours(minTime.getHours() - 24);
    const maxTime = addHours(new Date(), 24 * 7);

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
      console.error('[SYNC] Calendly API error:', error);
      return NextResponse.json({ error: 'Calendly API error', details: error }, { status: 500 });
    }

    const eventsData = await eventsRes.json();
    const events: CalendlyEvent[] = eventsData.collection || [];

    console.log(`[SYNC] Found ${events.length} scheduled events`);

    const results = [];

    for (const event of events) {
      // Extract event UUID from URI
      const eventUuid = event.uri.split('/').pop()!;

      // Check if we already have this demo
      const { data: existingDemo } = await supabase
        .from('demos')
        .select('id')
        .eq('calendly_event_id', eventUuid)
        .single();

      if (existingDemo) {
        console.log(`[SYNC] Event ${eventUuid} already exists, skipping`);
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
        console.error(`[SYNC] Failed to fetch invitees for ${eventUuid}`);
        continue;
      }

      const inviteesData = await inviteesRes.json();
      const invitees: CalendlyInvitee[] = inviteesData.collection || [];

      if (invitees.length === 0) {
        console.log(`[SYNC] No invitees for ${eventUuid}, skipping`);
        continue;
      }

      const invitee = invitees[0]; // Primary invitee

      // Create demo record
      const demoTime = parseISO(event.start_time);
      const demoType = DemoService.classifyDemoType(demoTime);

      const { data: newDemo, error: insertError } = await supabase
        .from('demos')
        .insert({
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
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[SYNC] Failed to create demo for ${eventUuid}:`, insertError);
        continue;
      }

      console.log(`[SYNC] Created demo ${newDemo.id} for ${invitee.email}`);

      // Schedule follow-up messages
      await SchedulerService.scheduleSequence(newDemo);

      results.push({
        event_id: eventUuid,
        email: invitee.email,
        scheduled_at: event.start_time,
        demo_type: demoType
      });
    }

    // Also check for cancellations
    const cancelledRes = await fetch(
      `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(CALENDLY_USER_URI)}&min_start_time=${minTime.toISOString()}&max_start_time=${maxTime.toISOString()}&status=canceled`,
      {
        headers: {
          'Authorization': `Bearer ${CALENDLY_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (cancelledRes.ok) {
      const cancelledData = await cancelledRes.json();
      const cancelledEvents: CalendlyEvent[] = cancelledData.collection || [];

      for (const event of cancelledEvents) {
        const eventUuid = event.uri.split('/').pop()!;

        // Update demo status if exists
        await supabase
          .from('demos')
          .update({ status: 'CANCELLED' })
          .eq('calendly_event_id', eventUuid)
          .eq('status', 'PENDING');
      }
    }

    return NextResponse.json({
      status: 'ok',
      synced: results.length,
      events_found: events.length,
      new_demos: results
    });
  } catch (error) {
    console.error('[SYNC] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

