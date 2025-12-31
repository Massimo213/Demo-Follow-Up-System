/**
 * Local Cron Endpoint
 * Call this every minute to process due messages
 * 
 * GET /api/cron
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MessagingService } from '@/services/messaging.service';
import type { Demo, ScheduledJob, MessageType } from '@/types/demo';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function GET() {
  try {
    const now = new Date();
    console.log(`[CRON] Running at ${now.toISOString()}`);

    const supabase = getSupabase();

    // Get all pending jobs that are due
    const { data: dueJobs, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('executed', false)
      .eq('cancelled', false)
      .lte('scheduled_for', now.toISOString());

    if (error) {
      console.error('[CRON] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!dueJobs || dueJobs.length === 0) {
      console.log('[CRON] No due jobs found');
      return NextResponse.json({ status: 'ok', processed: 0, due_jobs: 0 });
    }

    console.log(`[CRON] Found ${dueJobs.length} due jobs`);

    const results = [];
    for (const job of dueJobs as ScheduledJob[]) {
      try {
        const result = await processJob(supabase, job);
        results.push(result);
      } catch (err) {
        console.error(`[CRON] Job ${job.id} failed:`, err);
        results.push({ job_id: job.id, status: 'error', error: String(err) });
      }
    }

    return NextResponse.json({ 
      status: 'ok', 
      processed: results.length,
      results 
    });
  } catch (error) {
    console.error('[CRON] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

async function processJob(
  supabase: ReturnType<typeof createClient>,
  job: ScheduledJob
): Promise<{ job_id: string; status: string; message_id?: string }> {
  
  // Get the demo
  const { data: demo, error: demoError } = await supabase
    .from('demos')
    .select('*')
    .eq('id', job.demo_id)
    .single();

  if (demoError || !demo) {
    await markExecuted(supabase, job.demo_id, job.message_type);
    return { job_id: job.id, status: 'skipped_no_demo' };
  }

  // Check if demo is in terminal state
  if (['CANCELLED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW'].includes(demo.status)) {
    await markExecuted(supabase, job.demo_id, job.message_type);
    return { job_id: job.id, status: 'skipped_terminal_state' };
  }

  // For JOIN_LINK on FUTURE demos, require confirmation
  if (job.message_type === 'JOIN_LINK' && demo.demo_type === 'FUTURE' && demo.status !== 'CONFIRMED') {
    await markExecuted(supabase, job.demo_id, job.message_type);
    return { job_id: job.id, status: 'skipped_not_confirmed' };
  }

  // Check if already sent
  const { data: existingMsg } = await supabase
    .from('messages')
    .select('id')
    .eq('demo_id', job.demo_id)
    .eq('message_type', job.message_type)
    .limit(1);

  if (existingMsg && existingMsg.length > 0) {
    await markExecuted(supabase, job.demo_id, job.message_type);
    return { job_id: job.id, status: 'already_sent' };
  }

  // Send the message
  const message = await MessagingService.sendMessage(demo as Demo, job.message_type as MessageType);
  
  // Mark as executed
  await markExecuted(supabase, job.demo_id, job.message_type);

  console.log(`[CRON] Sent ${job.message_type} to ${demo.email}`);
  
  return { 
    job_id: job.id, 
    status: 'sent',
    message_id: message?.id 
  };
}

async function markExecuted(
  supabase: ReturnType<typeof createClient>,
  demoId: string,
  messageType: string
) {
  await supabase
    .from('scheduled_jobs')
    .update({ executed: true, executed_at: new Date().toISOString() })
    .eq('demo_id', demoId)
    .eq('message_type', messageType);
}
