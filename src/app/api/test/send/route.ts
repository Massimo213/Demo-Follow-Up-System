/**
 * Direct email test - no QStash, no scheduling
 * Just verify Gmail SMTP + templates work
 * 
 * POST /api/test/send
 */

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
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

    // Send via Gmail SMTP
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPass) {
      return NextResponse.json({ error: 'GMAIL_USER or GMAIL_APP_PASSWORD not configured' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    const fromName = process.env.GMAIL_FROM_NAME || 'Yahya from Elystra';
    const from = `"${fromName}" <${gmailUser}>`;

    const info = await transporter.sendMail({
      from,
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    console.log('Email sent:', info.messageId);

    return NextResponse.json({
      status: 'sent',
      to: email,
      subject: template.subject,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('Send error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}



