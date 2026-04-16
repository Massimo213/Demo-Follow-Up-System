/**
 * One-shot / manual: email ELYSTRA_TEAM_EMAIL with "{phone} said : …"
 * POST /api/test/team-inbound-sms
 * Body: { "from": "+13433129283" | "343 312-9283", "body": "…", "intent"?, "senderName"? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { MessagingService } from '@/services/messaging.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const from = typeof body.from === 'string' ? body.from : '';
    const text = typeof body.body === 'string' ? body.body : '';
    if (!from || !text) {
      return NextResponse.json({ error: 'from and body required' }, { status: 400 });
    }

    await MessagingService.sendInboundSmsTeamNotification({
      fromPhoneE164: from,
      body: text,
      intent: typeof body.intent === 'string' ? body.intent : undefined,
      senderName: typeof body.senderName === 'string' ? body.senderName : undefined,
      messageSid: typeof body.messageSid === 'string' ? body.messageSid : undefined,
    });

    return NextResponse.json({ status: 'sent' });
  } catch (error) {
    console.error('[test/team-inbound-sms]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
