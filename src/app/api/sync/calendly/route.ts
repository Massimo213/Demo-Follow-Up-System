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
  text_reminder_number?: string;
  questions_and_answers?: Array<{
    question: string;
    answer: string;
  }>;
}

// Support both GET (browser/curl) and POST (cron services like Vercel/QStash)
export async function GET() {
  const syncId = crypto.randomUUID().slice(0, 8);
  
  try {
    console.log(`[SYNC:${syncId}] Starting Calendly sync...`);
    
    if (!CALENDLY_TOKEN) {
      return NextResponse.json({ error: 'Missing Calendly token' }, { status: 500 });
    }

    const supabase = getSupabase();

    // Get scheduled events from last 7 days to next 90 days (covers everything)
    const minTime = new Date();
    minTime.setDate(minTime.getDate() - 7);
    const maxTime = addHours(new Date(), 24 * 90); // 90 days out

    // Fetch ALL events with pagination
    let events: CalendlyEvent[] = [];
    let nextPageToken: string | null = null;
    let pageCount = 0;
    const MAX_PAGES = 20; // Safety limit

    do {
      const url = new URL('https://api.calendly.com/scheduled_events');
      url.searchParams.set('user', CALENDLY_USER_URI);
      url.searchParams.set('min_start_time', minTime.toISOString());
      url.searchParams.set('max_start_time', maxTime.toISOString());
      url.searchParams.set('status', 'active');
      url.searchParams.set('count', '100'); // Max per page
      if (nextPageToken) {
        url.searchParams.set('page_token', nextPageToken);
      }

      const eventsRes = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${CALENDLY_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!eventsRes.ok) {
        const error = await eventsRes.text();
        console.error(`[SYNC:${syncId}] Calendly API error:`, error);
        return NextResponse.json({ error: 'Calendly API error', details: error }, { status: 500 });
      }

      const eventsData = await eventsRes.json();
      const pageEvents: CalendlyEvent[] = eventsData.collection || [];
      events = events.concat(pageEvents);
      
      // Check for next page
      nextPageToken = eventsData.pagination?.next_page_token || null;
      pageCount++;
      
      console.log(`[SYNC:${syncId}] Page ${pageCount}: fetched ${pageEvents.length} events (total: ${events.length})`);
    } while (nextPageToken && pageCount < MAX_PAGES);

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

      // Extract phone from text_reminder_number or questions
      let phone: string | null = invitee.text_reminder_number || null;
      if (!phone && invitee.questions_and_answers) {
        const phoneAnswer = invitee.questions_and_answers.find(
          (qa) => qa.question.toLowerCase().includes('phone') || 
                  qa.question.toLowerCase().includes('cell') ||
                  qa.question.toLowerCase().includes('mobile') ||
                  qa.question.toLowerCase().includes('number') ||
                  qa.question.toLowerCase().includes('sms') ||
                  qa.question.toLowerCase().includes('text') ||
                  qa.question.toLowerCase().includes('contact')
        );
        if (phoneAnswer && phoneAnswer.answer) {
          // Clean phone number - remove non-digits except +
          phone = phoneAnswer.answer.replace(/[^\d+]/g, '');
          if (phone && phone.length >= 10 && !phone.startsWith('+')) {
            phone = '+1' + phone; // Assume North American
          }
          if (phone && phone.length < 10) {
            phone = null; // Invalid phone
          }
        }
      }
      
      console.log(`[SYNC:${syncId}] Invitee ${invitee.email} - phone: ${phone}, questions:`, JSON.stringify(invitee.questions_and_answers));

      // ATOMIC INSERT - uses ON CONFLICT to handle race conditions
      const { data: newDemo, error: insertError } = await supabase
        .from('demos')
        .upsert({
          calendly_event_id: eventUuid,
          calendly_invitee_id: invitee.uri.split('/').pop() || '',
          email: invitee.email,
          name: invitee.name,
          phone,
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

    // Handle cancellations (with pagination)
    let cancelledEvents: CalendlyEvent[] = [];
    nextPageToken = null;
    pageCount = 0;

    do {
      const cancelUrl = new URL('https://api.calendly.com/scheduled_events');
      cancelUrl.searchParams.set('user', CALENDLY_USER_URI);
      cancelUrl.searchParams.set('min_start_time', minTime.toISOString());
      cancelUrl.searchParams.set('max_start_time', maxTime.toISOString());
      cancelUrl.searchParams.set('status', 'canceled');
      cancelUrl.searchParams.set('count', '100');
      if (nextPageToken) {
        cancelUrl.searchParams.set('page_token', nextPageToken);
      }

      const cancelledRes = await fetch(cancelUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${CALENDLY_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (cancelledRes.ok) {
        const cancelledData = await cancelledRes.json();
        cancelledEvents = cancelledEvents.concat(cancelledData.collection || []);
        nextPageToken = cancelledData.pagination?.next_page_token || null;
        pageCount++;
      } else {
        break;
      }
    } while (nextPageToken && pageCount < MAX_PAGES);

    let cancelledCount = 0;
    if (cancelledEvents.length > 0) {
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

// POST alias for cron services (QStash, Vercel Cron, etc.)
export async function POST() {
  return GET();
}
