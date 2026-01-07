/**
 * Direct email test - no QStash, no scheduling
 * Just verify Resend + templates work
 * 
 * POST /api/test/send
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { EmailTemplates } from '@/templates/email';
import type { Demo, MessageType } from '@/types/demo';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, messageType = 'CONFIRM_INITIAL' } = body;

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
      timezone: 'Europe/Paris',
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

    // Send via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.EMAIL_FROM;

    if (!from) {
      return NextResponse.json({ error: 'EMAIL_FROM not configured' }, { status: 500 });
    }

    const response = await resend.emails.send({
      from,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    console.log('Email sent:', response);

    return NextResponse.json({
      status: 'sent',
      to: email,
      subject: template.subject,
      resend_id: response.data?.id,
    });
  } catch (error) {
    console.error('Send error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}



