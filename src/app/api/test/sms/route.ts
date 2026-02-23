/**
 * Test SMS endpoint - uses app's Twilio config from Vercel env
 * POST /api/test/sms
 * Body: { "phone": "4385271026" }
 */

import { NextRequest, NextResponse } from 'next/server';
import Twilio from 'twilio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let phone = body?.phone || body?.to;

    if (!phone) {
      return NextResponse.json({ error: 'phone or to required' }, { status: 400 });
    }

    // Normalize to E.164
    phone = String(phone).replace(/\D/g, '');
    if (phone.length === 10) {
      phone = '+1' + phone;
    } else if (!phone.startsWith('+')) {
      phone = '+' + phone;
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json({
        error: 'Twilio not configured',
        missing: [!accountSid && 'TWILIO_ACCOUNT_SID', !authToken && 'TWILIO_AUTH_TOKEN', !fromNumber && 'TWILIO_PHONE_NUMBER'].filter(Boolean),
      }, { status: 500 });
    }

    const twilio = Twilio(accountSid, authToken);
    const msg = await twilio.messages.create({
      body: 'Test: Elystra follow-up system. If you got this, SMS is working.',
      from: fromNumber,
      to: phone,
    });

    return NextResponse.json({
      status: 'sent',
      to: phone,
      sid: msg.sid,
      messageStatus: msg.status,
    });
  } catch (error: any) {
    console.error('[TEST SMS]', error);
    return NextResponse.json({
      error: error?.message || String(error),
      code: error?.code,
      status: error?.status,
    }, { status: 500 });
  }
}
