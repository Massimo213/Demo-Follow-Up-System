/**
 * SMS Reply Webhook
 * Receives incoming SMS from Twilio and processes them
 * Auto-replies for RESCHEDULE requests
 * Notifies owner on their phone for every reply
 * 
 * POST /api/webhooks/reply/sms
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Twilio from 'twilio';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function getTwilio() {
  return Twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );
}

// Notify owner on their personal phone about SMS replies
async function notifyOwner(senderName: string, message: string, intent: string): Promise<void> {
  const ownerPhone = process.env.OWNER_PHONE_NUMBER;
  if (!ownerPhone) {
    console.log('[SMS REPLY] No OWNER_PHONE_NUMBER configured, skipping notification');
    return;
  }

  try {
    const twilio = getTwilio();
    const truncatedMessage = message.length > 100 ? message.slice(0, 100) + '...' : message;
    
    const notification = `📱 ${senderName} replied:\n"${truncatedMessage}"\n\n→ Intent: ${intent}`;
    
    await twilio.messages.create({
      body: notification,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: ownerPhone,
    });
    
    console.log(`[SMS REPLY] Owner notified about reply from ${senderName}`);
  } catch (error) {
    console.error('[SMS REPLY] Failed to notify owner:', error);
    // Don't throw - notification failure shouldn't break the webhook
  }
}

// Parse intent from message
function parseIntent(body: string): string {
  const lower = body.toLowerCase().trim();
  
  // YES confirmations
  if (lower === 'yes' || lower === 'y' || lower === 'yep' || lower === 'yeah') {
    return 'YES';
  }
  
  // STOP/Cancel - they want out
  if (lower === 'stop' || lower === 'unsubscribe') {
    return 'STOP';
  }
  
  // Reschedule - R, A, or explicit reschedule
  if (lower === 'r' || lower === 'a' || lower.includes('reschedule') || lower.includes('different time') || lower.includes('another time')) {
    return 'RESCHEDULE';
  }
  
  // B = close file (from SMS_URGENT A/B choice)
  if (lower === 'b' || lower === 'close') {
    return 'CLOSE';
  }
  
  // Cancel/can't make it
  if (lower === 'no' || lower === 'nope' || lower.includes("can't make") || lower === 'cancel') {
    return 'CANCEL';
  }
  
  return 'UNKNOWN';
}

// Generate reschedule auto-reply
function getRescheduleReply(firstName: string): string {
  return `${firstName}, no problem – let's find a better time.

What day/time works best for you this week? The walkthrough is only 7 minutes, so pick the closest slot that works – no need to push it far out.

Just text me the day and time.`;
}

// INVARIANT: Every message must have a sender_name. No nulls, no blanks.
function deriveSenderName(demoName: string | null | undefined, phone: string): string {
  // Priority 1: Use demo name if available
  if (demoName && demoName.trim()) {
    return demoName.trim();
  }
  
  // Priority 2: Format phone as fallback (never return empty)
  // +14165551234 → "Contact (416) 555-1234"
  const cleaned = phone.replace(/[^\d]/g, '');
  if (cleaned.length >= 10) {
    const last10 = cleaned.slice(-10);
    const formatted = `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
    return `Contact ${formatted}`;
  }
  
  // Last resort: use raw phone
  return `Contact ${phone}`;
}

export async function POST(request: NextRequest) {
  try {
    // Twilio sends form-urlencoded data
    const formData = await request.formData();
    
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;
    
    console.log(`[SMS REPLY] From: ${from}, Body: ${body}`);
    
    if (!from || !body) {
      return new NextResponse('Missing from or body', { status: 400 });
    }

    const supabase = getSupabase();
    
    // Clean phone number for lookup
    const cleanPhone = from.replace(/[^\d+]/g, '');
    
    // Find demo by phone
    const { data: demo } = await supabase
      .from('demos')
      .select('id, email, name, status')
      .eq('phone', cleanPhone)
      .order('scheduled_at', { ascending: false })
      .limit(1)
      .single();

    const intent = parseIntent(body);
    
    // INVARIANT: sender_name must ALWAYS be present, never null
    // Priority: demo name > phone-derived fallback
    const senderName = deriveSenderName(demo?.name, from);
    const firstName = senderName.split(' ')[0];
    
    // Save reply to database with sender name (REQUIRED)
    const { error: insertError } = await supabase
      .from('replies')
      .insert({
        demo_id: demo?.id || null,
        channel: 'SMS',
        from_address: from,
        body: body,
        intent: intent,
        processed: false,
        sender_name: senderName, // Never null
      });

    if (insertError) {
      console.error('[SMS REPLY] Failed to save:', insertError);
    }

    let autoReply = '';

    // Take action based on intent
    if (demo) {
      if (intent === 'STOP') {
        // Full opt-out - cancel all and remove phone
        await supabase
          .from('scheduled_jobs')
          .update({ cancelled: true })
          .eq('demo_id', demo.id)
          .eq('executed', false);
        
        await supabase
          .from('demos')
          .update({ phone: null, status: 'CANCELLED' })
          .eq('id', demo.id);
        
        console.log(`[SMS REPLY] STOP - removed phone for ${demo.email}`);
      }
      
      if (intent === 'CANCEL' || intent === 'CLOSE') {
        // They're cancelling/closing - cancel jobs, keep phone for potential re-engagement
        await supabase
          .from('scheduled_jobs')
          .update({ cancelled: true })
          .eq('demo_id', demo.id)
          .eq('executed', false);
        
        await supabase
          .from('demos')
          .update({ status: 'CANCELLED' })
          .eq('id', demo.id);
        
        autoReply = `${firstName}, understood – closing the file. If timing improves, you can always rebook: ${process.env.RESCHEDULE_URL}`;
        
        console.log(`[SMS REPLY] CANCEL/CLOSE for ${demo.email}`);
      }
      
      if (intent === 'YES') {
        await supabase
          .from('demos')
          .update({ status: 'CONFIRMED' })
          .eq('id', demo.id);
        
        autoReply = `${firstName}, locked in. I'll send you the join link before we start.`;
        
        console.log(`[SMS REPLY] Confirmed demo for ${demo.email}`);
      }
      
      if (intent === 'RESCHEDULE') {
        await supabase
          .from('demos')
          .update({ status: 'RESCHEDULED' })
          .eq('id', demo.id);
        
        await supabase
          .from('scheduled_jobs')
          .update({ cancelled: true })
          .eq('demo_id', demo.id)
          .eq('executed', false);
        
        // Auto-reply asking for their preferred time
        autoReply = getRescheduleReply(firstName);
        
        console.log(`[SMS REPLY] Reschedule requested for ${demo.email}`);
      }
    }

    // Notify owner on their personal phone about this reply
    await notifyOwner(senderName, body, intent);

    // Return TwiML with auto-reply if needed
    if (autoReply) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(autoReply)}</Message></Response>`;
      return new NextResponse(twiml, { 
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // No auto-reply
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { 
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      }
    );
  } catch (error) {
    console.error('[SMS REPLY] Error:', error);
    return new NextResponse('Error', { status: 500 });
  }
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}






