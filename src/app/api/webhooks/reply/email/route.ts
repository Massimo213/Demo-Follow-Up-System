/**
 * Email Reply Webhook Handler
 * Receives inbound email replies from Resend
 * 
 * POST /api/webhooks/reply/email
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReplyService } from '@/services/reply.service';
import { z } from 'zod';

// Resend inbound email schema
const ResendInboundSchema = z.object({
  type: z.literal('email.received'),
  data: z.object({
    from: z.string().email(),
    subject: z.string().optional(),
    text: z.string().optional(),
    html: z.string().optional(),
  }),
});

// Postmark inbound email schema (alternative)
const PostmarkInboundSchema = z.object({
  From: z.string(),
  FromFull: z.object({
    Email: z.string().email(),
  }).optional(),
  Subject: z.string().optional(),
  TextBody: z.string().optional(),
  HtmlBody: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let fromEmail: string;
    let textBody: string;

    // Try to parse as Resend format
    const resendResult = ResendInboundSchema.safeParse(body);
    if (resendResult.success) {
      fromEmail = resendResult.data.data.from;
      textBody = resendResult.data.data.text || extractTextFromHtml(resendResult.data.data.html || '');
    } else {
      // Try Postmark format
      const postmarkResult = PostmarkInboundSchema.safeParse(body);
      if (postmarkResult.success) {
        fromEmail = postmarkResult.data.FromFull?.Email || extractEmail(postmarkResult.data.From);
        textBody = postmarkResult.data.TextBody || extractTextFromHtml(postmarkResult.data.HtmlBody || '');
      } else {
        console.error('Unknown email format:', body);
        return NextResponse.json({ error: 'Unknown format' }, { status: 400 });
      }
    }

    if (!fromEmail || !textBody) {
      return NextResponse.json({ error: 'Missing from or body' }, { status: 400 });
    }

    // Clean up the text body (remove quoted replies, signatures)
    const cleanBody = cleanEmailBody(textBody);

    console.log(`Email reply from ${fromEmail}: ${cleanBody.substring(0, 100)}`);

    // Process the reply
    const result = await ReplyService.processReply(fromEmail, cleanBody);

    console.log(`Reply processed: demo=${result.demo?.id}, intent=${result.intent}, action=${result.action}`);

    return NextResponse.json({
      status: 'processed',
      ...result,
    });
  } catch (error) {
    console.error('Email reply webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract email address from "Name <email>" format
 */
function extractEmail(fromString: string): string {
  const match = fromString.match(/<([^>]+)>/);
  return match ? match[1] : fromString;
}

/**
 * Simple HTML to text conversion
 */
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Clean email body - remove quoted replies and signatures
 */
function cleanEmailBody(body: string): string {
  const lines = body.split('\n');
  const cleanLines: string[] = [];

  for (const line of lines) {
    // Stop at quoted content
    if (line.startsWith('>') || line.startsWith('On ') && line.includes(' wrote:')) {
      break;
    }

    // Stop at signature indicators
    if (line.trim() === '--' || line.startsWith('Sent from my')) {
      break;
    }

    // Stop at common reply headers
    if (/^-+\s*Original Message\s*-+$/i.test(line)) {
      break;
    }

    cleanLines.push(line);
  }

  return cleanLines.join('\n').trim();
}
