/**
 * Debug Endpoint - Check system status
 * GET /api/debug
 * 
 * Shows:
 * - Recent demos (last 5)
 * - Pending jobs
 * - Recent messages sent
 * - Environment variable status (not values)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase not configured');
  }
  
  return createClient(url, key);
}

export async function GET() {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // Check environment variables (existence only, not values)
  debug.env_vars = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    GMAIL_USER: !!process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: !!process.env.GMAIL_APP_PASSWORD,
    TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: !!process.env.TWILIO_PHONE_NUMBER,
    CALENDLY_WEBHOOK_SECRET: !!process.env.CALENDLY_WEBHOOK_SECRET,
    APP_URL: process.env.APP_URL || 'NOT SET',
    PRE_DEMO_ASSET_URL: process.env.PRE_DEMO_ASSET_URL || 'NOT SET',
  };

  try {
    const supabase = getSupabase();

    // Recent demos
    const { data: recentDemos, error: demoError } = await supabase
      .from('demos')
      .select('id, email, name, scheduled_at, demo_type, status, created_at, focus_metric')
      .order('created_at', { ascending: false })
      .limit(5);

    debug.recent_demos = demoError 
      ? { error: demoError.message }
      : recentDemos;

    // Pending jobs (not executed, not cancelled)
    const { data: pendingJobs, error: jobError } = await supabase
      .from('scheduled_jobs')
      .select('id, demo_id, message_type, scheduled_for, executed, cancelled, processing, retry_count, last_error')
      .eq('executed', false)
      .eq('cancelled', false)
      .order('scheduled_for', { ascending: true })
      .limit(20);

    debug.pending_jobs = jobError 
      ? { error: jobError.message }
      : pendingJobs;

    // Jobs that should have fired already (overdue)
    const now = new Date().toISOString();
    const overdueJobs = (pendingJobs || []).filter(
      (j: { scheduled_for: string }) => j.scheduled_for < now
    );
    debug.overdue_jobs_count = overdueJobs.length;
    debug.overdue_jobs = overdueJobs;

    // Recent messages sent
    const { data: recentMessages, error: msgError } = await supabase
      .from('messages')
      .select('id, demo_id, channel, message_type, recipient, sent_at')
      .order('sent_at', { ascending: false })
      .limit(10);

    debug.recent_messages = msgError 
      ? { error: msgError.message }
      : recentMessages;

    // Jobs executed recently
    const { data: executedJobs, error: execError } = await supabase
      .from('scheduled_jobs')
      .select('id, demo_id, message_type, executed_at, last_error')
      .eq('executed', true)
      .order('executed_at', { ascending: false })
      .limit(10);

    debug.recently_executed_jobs = execError
      ? { error: execError.message }
      : executedJobs;

    // Failed jobs (cancelled due to errors)
    const { data: failedJobs, error: failError } = await supabase
      .from('scheduled_jobs')
      .select('id, demo_id, message_type, last_error, retry_count')
      .eq('cancelled', true)
      .not('last_error', 'is', null)
      .order('id', { ascending: false })
      .limit(5);

    debug.failed_jobs = failError
      ? { error: failError.message }
      : failedJobs;

    // Summary
    debug.summary = {
      demos_found: recentDemos?.length || 0,
      pending_jobs: pendingJobs?.length || 0,
      overdue_jobs: overdueJobs.length,
      messages_sent: recentMessages?.length || 0,
      failed_jobs: failedJobs?.length || 0,
    };

    // Diagnosis
    const issues: string[] = [];
    
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      issues.push('Gmail credentials not configured - emails will fail');
    }
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      issues.push('Twilio credentials not configured - SMS will fail');
    }
    if (!recentDemos || recentDemos.length === 0) {
      issues.push('No demos found - Calendly webhook may not be configured');
    }
    if (overdueJobs.length > 0) {
      issues.push(`${overdueJobs.length} overdue jobs - CRON IS NOT RUNNING! Call /api/cron manually or check Vercel cron config`);
    }
    if (pendingJobs && pendingJobs.length > 0 && (!recentMessages || recentMessages.length === 0)) {
      issues.push('Jobs scheduled but no messages sent - check if cron is running');
    }

    debug.diagnosis = issues.length > 0 ? issues : ['No obvious issues detected'];

    return NextResponse.json(debug, { status: 200 });
  } catch (error) {
    debug.error = String(error);
    return NextResponse.json(debug, { status: 500 });
  }
}
