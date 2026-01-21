/**
 * SMS Reply Webhook
 * Receives incoming SMS from Twilio and processes them
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
  
  if (lower === 'yes' || lower === 'y' || lower === 'yep' || lower === 'yeah') {
    return 'YES';
  }
  if (lower === 'stop' || lower === 'unsubscribe' || lower === 'cancel') {
    return 'STOP';
  }
  if (lower === 'no' || lower === 'nope' || lower.includes("can't make")) {
    return 'CANCEL';
  }
  if (lower.includes('reschedule') || lower.includes('different time') || lower.includes('another time')) {
    return 'RESCHEDULE';
  }
  
  return 'UNKNOWN';
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
    
    // Save reply to database
    const { error: insertError } = await supabase
      .from('replies')
      .insert({
        demo_id: demo?.id || null,
        channel: 'SMS',
        from_address: from,
        body: body,
        intent: intent,
        processed: false,
      });

    if (insertError) {
      console.error('[SMS REPLY] Failed to save:', insertError);
    }

    // Take action based on intent
    if (demo) {
      if (intent === 'STOP' || intent === 'CANCEL') {
        // Cancel all pending jobs and remove phone
        await supabase
          .from('scheduled_jobs')
          .update({ cancelled: true })
          .eq('demo_id', demo.id)
          .eq('executed', false);
        
        await supabase
          .from('demos')
          .update({ phone: null })
          .eq('id', demo.id);
        
        console.log(`[SMS REPLY] Cancelled SMS for ${demo.email} due to ${intent}`);
      }
      
      if (intent === 'YES') {
        await supabase
          .from('demos')
          .update({ status: 'CONFIRMED' })
          .eq('id', demo.id);
        
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
        
        console.log(`[SMS REPLY] Marked reschedule for ${demo.email}`);
      }
    }

    // Return TwiML (empty response = no auto-reply)
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






