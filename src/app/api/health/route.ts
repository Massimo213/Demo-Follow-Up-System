/**
 * Health Check Endpoint
 * Returns system status - use with uptime monitoring (UptimeRobot, Better Uptime, etc.)
 * 
 * GET /api/health
 * 
 * Checks:
 * 1. Database connectivity
 * 2. Recent job execution (detects silent failures)
 * 3. Pending job backlog (detects processing stalls)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'warn' | 'fail'; detail?: string }> = {};
  
  try {
    const supabase = getSupabase();
    
    // Check 1: Database connectivity
    const { error: dbError } = await supabase.from('demos').select('id').limit(1);
    checks.database = dbError 
      ? { status: 'fail', detail: dbError.message }
      : { status: 'ok' };

    // Check 2: Recent execution (any job processed in last 15 min?)
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentJobs } = await supabase
      .from('scheduled_jobs')
      .select('id')
      .gte('executed_at', fifteenMinAgo)
      .limit(1);
    
    // Also check if there SHOULD have been jobs
    const { data: dueJobs } = await supabase
      .from('scheduled_jobs')
      .select('id')
      .eq('executed', false)
      .eq('cancelled', false)
      .lte('scheduled_for', fifteenMinAgo)
      .limit(1);

    if (dueJobs && dueJobs.length > 0) {
      // Jobs are overdue - cron is dead
      checks.cron_execution = { status: 'fail', detail: 'Overdue jobs detected - cron not running' };
    } else if (recentJobs && recentJobs.length > 0) {
      checks.cron_execution = { status: 'ok' };
    } else {
      checks.cron_execution = { status: 'ok', detail: 'No recent jobs (may be idle)' };
    }

    // Check 3: Backlog size
    const { count: backlogCount } = await supabase
      .from('scheduled_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('executed', false)
      .eq('cancelled', false)
      .lte('scheduled_for', new Date().toISOString());

    if (backlogCount && backlogCount > 50) {
      checks.backlog = { status: 'warn', detail: `${backlogCount} jobs in backlog` };
    } else {
      checks.backlog = { status: 'ok', detail: `${backlogCount || 0} pending` };
    }

    // Overall status
    const hasFailure = Object.values(checks).some(c => c.status === 'fail');
    const hasWarning = Object.values(checks).some(c => c.status === 'warn');
    
    const overallStatus = hasFailure ? 'fail' : hasWarning ? 'warn' : 'ok';
    const httpStatus = hasFailure ? 503 : 200;

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks
    }, { status: httpStatus });

  } catch (error) {
    return NextResponse.json({
      status: 'fail',
      timestamp: new Date().toISOString(),
      error: String(error),
      checks
    }, { status: 503 });
  }
}

export async function POST() {
  return GET();
}


