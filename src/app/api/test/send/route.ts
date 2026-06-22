/**
 * Direct email test - no QStash, no scheduling
 * Just verify Gmail SMTP + templates work
 * 
 * POST /api/test/send
 */

import { NextRequest, NextResponse } from 'next/server';
import { EmailTemplates } from '@/templates/email';
import { sendMail } from '@/lib/resend-mailer';
import type { Demo, MessageType } from '@/types/demo';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, email: emailAlt, name, messageType = 'CONFIRM_INITIAL' } = body;
    const email = to ?? emailAlt;

    if (!email) {
      return NextResponse.json({ error: 'email required' }, { status: 400 });
    }

    // Create a mock demo for testing
    const mockDemo: Demo = {
      id: 'test-demo-id',
      calendly_event_id: 'test-event',
      calendly_invitee_id: 'test-invitee',
      email,
      phone: null,
      name: name || 'Test User',
      scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      timezone: 'America/Toronto',
      demo_type: 'SAME_DAY',
      join_url: 'https://zoom.us/j/123456789',
      status: 'PENDING',
      confirmed_at: null,
      joined_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Get template
    const template = EmailTemplates.getTemplate(messageType as MessageType, mockDemo);
    if (!template) {
      return NextResponse.json({ error: `No template for ${messageType}` }, { status: 400 });
    }

    const replyTo = (process.env.GMAIL_USER ?? '').trim() || undefined;

    const info = await sendMail({
      to: email,
      subject: template.subject,
      text: template.text,
      replyTo,
    });

    console.log('Email sent:', info.id);

    return NextResponse.json({
      status: 'sent',
      to: email,
      subject: template.subject,
      messageId: info.id,
    });
  } catch (error) {
    console.error('Send error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}



