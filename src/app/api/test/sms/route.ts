/**
 * Test SMS endpoint - sends a single SMS via production Twilio
 * POST /api/test/sms
 * Body: { "to": "+14385271026", "body": "optional message" }
 */

import { NextRequest, NextResponse } from 'next/server';
import Twilio from 'twilio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const to = body.to || '+14385271026';
    const customBody = body.body;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER not configured' },
        { status: 500 }
      );
    }

    const twilio = Twilio(accountSid, authToken);
    const messageBody = customBody || 'Test: Elystra follow-up SMS. If you received this, clients will get their reminders.';

    let toFormatted = to.replace(/\D/g, '');
    if (toFormatted.length === 10 && !toFormatted.startsWith('1')) {
      toFormatted = '+1' + toFormatted;
    } else if (!toFormatted.startsWith('1')) {
      toFormatted = '+' + toFormatted;
    } else {
      toFormatted = '+' + toFormatted;
    }

    const response = await twilio.messages.create({
      body: messageBody,
      from: fromNumber,
      to: toFormatted,
    });

    return NextResponse.json({
      status: 'sent',
      to: response.to,
      from: response.from,
      sid: response.sid,
      messageStatus: response.status,
    });
  } catch (error: any) {
    console.error('[TEST SMS] Error:', error);
    return NextResponse.json(
      {
        error: error?.message || String(error),
        code: error?.code,
      },
      { status: 500 }
    );
  }
}
