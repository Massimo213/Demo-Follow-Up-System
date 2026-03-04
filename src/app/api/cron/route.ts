/**
 * Local Cron Endpoint
 * Call this every minute to process due messages
 * 
 * Handles BOTH pre-demo (scheduled_jobs) and post-demo (prospect_scheduled_jobs).
 * 
 * IDEMPOTENCY GUARANTEES:
 * 1. Jobs are claimed atomically (processing=true) before execution
 * 2. Messages table has UNIQUE(demo_id/prospect_id, message_type) - DB rejects duplicates
 * 3. Resend receives idempotency key - prevents duplicate sends on retry
 * 4. Stale locks auto-release after 5 minutes
 * 
 * GET /api/cron
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MessagingService } from '@/services/messaging.service';
import { ProspectMessagingService } from '@/services/prospect-messaging.service';
import type { Demo, ScheduledJob, MessageType } from '@/types/demo';
import type { Prospect, ProspectScheduledJob, ProspectMessageType } from '@/types/prospect';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// Support both GET (browser/curl) and POST (cron services like Vercel/QStash)
export async function GET() {
  const runId = crypto.randomUUID().slice(0, 8);
  
  try {
    const now = new Date();
    console.log(`[CRON:${runId}] Running at ${now.toISOString()}`);

    const supabase = getSupabase();

    // Release stale locks for both pipelines
    try {
      await supabase.rpc('release_stale_jobs');
    } catch { /* not yet created */ }
    try {
      await supabase.rpc('release_stale_prospect_jobs');
    } catch { /* not yet created */ }

    // ─── PRE-DEMO JOBS ───
    const { data: dueJobs, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('executed', false)
      .eq('cancelled', false)
      .eq('processing', false)
      .lte('scheduled_for', now.toISOString())
      .limit(25);

    if (error) {
      console.error(`[CRON:${runId}] Demo jobs query error:`, error);
    }

    // ─── POST-DEMO JOBS ───
    const { data: dueProspectJobs, error: pError } = await supabase
      .from('prospect_scheduled_jobs')
      .select('*')
      .eq('executed', false)
      .eq('cancelled', false)
      .eq('processing', false)
      .lte('scheduled_for', now.toISOString())
      .limit(25);

    if (pError) {
      console.error(`[CRON:${runId}] Prospect jobs query error:`, pError);
    }

    const demoCount = dueJobs?.length || 0;
    const prospectCount = dueProspectJobs?.length || 0;

    if (demoCount === 0 && prospectCount === 0) {
      console.log(`[CRON:${runId}] No due jobs found`);
      return NextResponse.json({ status: 'ok', demo_processed: 0, prospect_processed: 0 });
    }

    console.log(`[CRON:${runId}] Found ${demoCount} demo jobs, ${prospectCount} prospect jobs`);

    const demoResults = [];
    for (const job of (dueJobs || []) as ScheduledJob[]) {
      try {
        const result = await processJobWithLock(supabase, job, runId);
        demoResults.push(result);
      } catch (err) {
        console.error(`[CRON:${runId}] Job ${job.id} failed:`, err);
        demoResults.push({ job_id: job.id, status: 'error', error: String(err) });
      }
    }

    const prospectResults = [];
    for (const job of (dueProspectJobs || []) as ProspectScheduledJob[]) {
      try {
        const result = await processProspectJobWithLock(supabase, job, runId);
        prospectResults.push(result);
      } catch (err) {
        console.error(`[CRON:${runId}] Prospect job ${job.id} failed:`, err);
        prospectResults.push({ job_id: job.id, status: 'error', error: String(err) });
      }
    }

    return NextResponse.json({ 
      status: 'ok', 
      run_id: runId,
      demo_processed: demoResults.length,
      prospect_processed: prospectResults.length,
      demo_results: demoResults,
      prospect_results: prospectResults,
    });
  } catch (error) {
    console.error(`[CRON:${runId}] Error:`, error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function processJobWithLock(
  supabase: ReturnType<typeof getSupabase>,
  job: ScheduledJob,
  runId: string
): Promise<{ job_id: string; status: string; message_id?: string; error?: string }> {
  
  // Step 1: Atomically claim the job
  const { data: claimed, error: claimError } = await supabase
    .from('scheduled_jobs')
    .update({ 
      processing: true, 
      processing_started_at: new Date().toISOString() 
    })
    .eq('id', job.id)
    .eq('executed', false)
    .eq('cancelled', false)
    .eq('processing', false)
    .select('id')
    .single();

  if (claimError || !claimed) {
    // Another process already claimed this job
    console.log(`[CRON:${runId}] Job ${job.id} already claimed by another process`);
    return { job_id: job.id, status: 'already_claimed' };
  }

  try {
    // Step 2: Get the demo
    const { data: demo, error: demoError } = await supabase
      .from('demos')
      .select('*')
      .eq('id', job.demo_id)
      .single();

    if (demoError || !demo) {
      await markCompleted(supabase, job.id);
      return { job_id: job.id, status: 'skipped_no_demo' };
    }

    // Step 3: Check if demo is in terminal state (only skip if actually cancelled/rescheduled)
    if (['CANCELLED', 'RESCHEDULED'].includes(demo.status)) {
      await markCompleted(supabase, job.id);
      return { job_id: job.id, status: 'skipped_terminal_state' };
    }

    // Step 4: Check if message already sent (defense in depth)
    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('demo_id', job.demo_id)
      .eq('message_type', job.message_type)
      .limit(1);

    if (existingMsg && existingMsg.length > 0) {
      await markCompleted(supabase, job.id);
      return { job_id: job.id, status: 'already_sent' };
    }

    // Step 6: Send the message with idempotency key
    const idempotencyKey = `${job.demo_id}-${job.message_type}`;
    const message = await MessagingService.sendMessage(
      demo as Demo, 
      job.message_type as MessageType,
      idempotencyKey
    );
    
    // Step 7: Mark as completed
    await markCompleted(supabase, job.id);

    console.log(`[CRON:${runId}] Sent ${job.message_type} to ${demo.email}`);
    
    return { 
      job_id: job.id, 
      status: 'sent',
      message_id: message?.id 
    };
  } catch (err) {
    // Increment retry count and release lock
    const newRetryCount = (job.retry_count || 0) + 1;
    const maxRetries = 3;
    
    if (newRetryCount >= maxRetries) {
      // Too many failures - mark as cancelled to stop retrying
      await supabase
        .from('scheduled_jobs')
        .update({ 
          cancelled: true,
          processing: false,
          processing_started_at: null,
          last_error: String(err).slice(0, 500)
        })
        .eq('id', job.id);
      console.error(`[CRON:${runId}] Job ${job.id} permanently failed after ${maxRetries} retries: ${err}`);
      return { job_id: job.id, status: 'permanently_failed', error: String(err) };
    } else {
      // Release lock for retry
    await supabase
      .from('scheduled_jobs')
        .update({ 
          processing: false, 
          processing_started_at: null,
          retry_count: newRetryCount,
          last_error: String(err).slice(0, 500)
        })
      .eq('id', job.id);
    }
    throw err;
  }
}

async function markCompleted(supabase: ReturnType<typeof getSupabase>, jobId: string) {
  await supabase
    .from('scheduled_jobs')
    .update({ 
      executed: true, 
      executed_at: new Date().toISOString(),
      processing: false,
      processing_started_at: null
    })
    .eq('id', jobId);
}

// ─── POST-DEMO PROSPECT JOB PROCESSOR ───

async function processProspectJobWithLock(
  supabase: ReturnType<typeof getSupabase>,
  job: ProspectScheduledJob,
  runId: string
): Promise<{ job_id: string; status: string; message_id?: string; error?: string }> {
  
  const { data: claimed, error: claimError } = await supabase
    .from('prospect_scheduled_jobs')
    .update({ processing: true, processing_started_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('executed', false)
    .eq('cancelled', false)
    .eq('processing', false)
    .select('id')
    .single();

  if (claimError || !claimed) {
    console.log(`[CRON:${runId}] Prospect job ${job.id} already claimed`);
    return { job_id: job.id, status: 'already_claimed' };
  }

  try {
    const { data: prospect, error: pError } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', job.prospect_id)
      .single();

    if (pError || !prospect) {
      await markProspectJobCompleted(supabase, job.id);
      return { job_id: job.id, status: 'skipped_no_prospect' };
    }

    if (['CLOSED_WON', 'CLOSED_LOST'].includes(prospect.status)) {
      await markProspectJobCompleted(supabase, job.id);
      return { job_id: job.id, status: 'skipped_terminal_state' };
    }

    if (prospect.status === 'PAUSED') {
      // Release lock — job stays pending, will retry when unpaused
      await supabase
        .from('prospect_scheduled_jobs')
        .update({ processing: false, processing_started_at: null })
        .eq('id', job.id);
      return { job_id: job.id, status: 'skipped_paused' };
    }

    const { data: existingMsg } = await supabase
      .from('prospect_messages')
      .select('id')
      .eq('prospect_id', job.prospect_id)
      .eq('message_type', job.message_type)
      .limit(1);

    if (existingMsg && existingMsg.length > 0) {
      await markProspectJobCompleted(supabase, job.id);
      return { job_id: job.id, status: 'already_sent' };
    }

    const message = await ProspectMessagingService.sendMessage(
      prospect as Prospect,
      job.message_type as ProspectMessageType
    );

    await markProspectJobCompleted(supabase, job.id);

    console.log(`[CRON:${runId}] Sent prospect ${job.message_type} to ${prospect.email}`);

    return { job_id: job.id, status: 'sent', message_id: message?.id };
  } catch (err) {
    const newRetryCount = (job.retry_count || 0) + 1;
    const maxRetries = 3;

    if (newRetryCount >= maxRetries) {
      await supabase
        .from('prospect_scheduled_jobs')
        .update({
          cancelled: true,
          processing: false,
          processing_started_at: null,
          last_error: String(err).slice(0, 500),
        })
        .eq('id', job.id);
      console.error(`[CRON:${runId}] Prospect job ${job.id} permanently failed after ${maxRetries} retries`);
      return { job_id: job.id, status: 'permanently_failed', error: String(err) };
    } else {
      await supabase
        .from('prospect_scheduled_jobs')
        .update({
          processing: false,
          processing_started_at: null,
          retry_count: newRetryCount,
          last_error: String(err).slice(0, 500),
        })
        .eq('id', job.id);
    }
    throw err;
  }
}

async function markProspectJobCompleted(
  supabase: ReturnType<typeof getSupabase>,
  jobId: string
) {
  await supabase
    .from('prospect_scheduled_jobs')
    .update({
      executed: true,
      executed_at: new Date().toISOString(),
      processing: false,
      processing_started_at: null,
    })
    .eq('id', jobId);
}

// POST alias for cron services (QStash, Vercel Cron, etc.)
export async function POST() {
  return GET();
}
