/**
 * QStash Webhook Handler
 * Executes scheduled jobs (sends messages)
 * 
 * POST /api/webhooks/qstash
 */

import { NextRequest, NextResponse } from 'next/server';
import { qstash } from '@/lib/qstash';
import { DemoService } from '@/services/demo.service';
import { SchedulerService } from '@/services/scheduler.service';
import { MessagingService } from '@/services/messaging.service';
import type { JobPayload } from '@/types/demo';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('upstash-signature');

    // Verify QStash signature
    if (signature) {
      const isValid = await qstash.receiver.verify({
        signature,
        body,
      });

      if (!isValid) {
        console.error('Invalid QStash signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, require signature
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const payload: JobPayload = JSON.parse(body);
    const { demo_id, message_type, job_id } = payload;

    console.log(`Processing job: ${job_id}`);

    // Check if job should still execute
    const shouldExecute = await SchedulerService.shouldExecute(demo_id, message_type);
    if (!shouldExecute) {
      console.log(`Job ${job_id} skipped - conditions not met`);
      await SchedulerService.markExecuted(demo_id, message_type);
      return NextResponse.json({ status: 'skipped' });
    }

    // Get demo
    const demo = await DemoService.getById(demo_id);
    if (!demo) {
      console.error(`Demo ${demo_id} not found`);
      return NextResponse.json({ status: 'demo_not_found' });
    }

    // Check idempotency - don't send same message twice
    const alreadySent = await MessagingService.wasMessageSent(demo_id, message_type);
    if (alreadySent) {
      console.log(`Message ${message_type} already sent for demo ${demo_id}`);
      await SchedulerService.markExecuted(demo_id, message_type);
      return NextResponse.json({ status: 'already_sent' });
    }

    // Send the message
    const message = await MessagingService.sendMessage(demo, message_type);

    // Mark job as executed
    await SchedulerService.markExecuted(demo_id, message_type);

    console.log(`Job ${job_id} completed - message ${message?.id} sent`);

    return NextResponse.json({
      status: 'sent',
      message_id: message?.id,
    });
  } catch (error) {
    console.error('QStash webhook error:', error);
    
    // Return 500 so QStash retries
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



