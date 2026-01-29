/**
 * SMS Reply Webhook
 * Receives incoming SMS from Twilio and processes them
 * Auto-replies for RESCHEDULE requests
 * 
 * POST /api/webhooks/reply/sms
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
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
    const firstName = demo?.name?.split(' ')[0] || 'there';
    
    // Save reply to database with sender name
    const { error: insertError } = await supabase
      .from('replies')
      .insert({
        demo_id: demo?.id || null,
        channel: 'SMS',
        from_address: from,
        body: body,
        intent: intent,
        processed: false,
        sender_name: demo?.name || null,
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






