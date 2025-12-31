/**
 * Messaging Service
 * Handles email delivery via Resend
 * 
 * IDEMPOTENCY:
 * - Uses Resend's Idempotency-Key header to prevent duplicate sends
 * - DB has UNIQUE(demo_id, message_type) constraint on messages table
 * - Checks for existing message before attempting send
 */

import { Resend } from 'resend';
import { db } from '@/lib/db';
import type { Demo, MessageType, Message } from '@/types/demo';
import { EmailTemplates } from '@/templates/email';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');
  _resend = new Resend(apiKey);
  return _resend;
}

export class MessagingService {
  /**
   * Send message (email only)
   * @param demo - The demo record
   * @param messageType - Type of message to send
   * @param idempotencyKey - Optional key to prevent duplicate sends (recommended: demo_id-message_type)
   */
  static async sendMessage(
    demo: Demo, 
    messageType: MessageType,
    idempotencyKey?: string
  ): Promise<Message | null> {
    return this.sendEmail(demo, messageType, idempotencyKey);
  }

  /**
   * Send email with idempotency protection
   */
  static async sendEmail(
    demo: Demo, 
    messageType: MessageType,
    idempotencyKey?: string
  ): Promise<Message | null> {
    // Defense in depth: Check if already sent before calling Resend
    const alreadySent = await this.wasMessageSent(demo.id, messageType);
    if (alreadySent) {
      console.log(`[MESSAGING] ${messageType} already sent to ${demo.email}, skipping`);
      return null;
    }

    const template = EmailTemplates.getTemplate(messageType, demo);
    if (!template) {
      console.error(`No email template for ${messageType}`);
      return null;
    }

    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error('EMAIL_FROM not configured');

    const resend = getResend();

    // Generate idempotency key if not provided
    const key = idempotencyKey || `${demo.id}-${messageType}-${Date.now()}`;

    try {
      const response = await resend.emails.send({
        from,
        to: demo.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        replyTo: from,
        headers: {
          'X-Idempotency-Key': key,
        },
        tags: [
          { name: 'demo_id', value: demo.id },
          { name: 'message_type', value: messageType },
          { name: 'idempotency_key', value: key },
        ],
      });

      // Record message - DB constraint will reject if duplicate
      try {
        const message = await db.messages.insert({
          demo_id: demo.id,
          channel: 'EMAIL',
          message_type: messageType,
          recipient: demo.email,
          subject: template.subject,
          body: template.text,
          external_id: response.data?.id || null,
        });
        return message;
      } catch (dbError: any) {
        // If duplicate key error, message was already recorded
        if (dbError?.code === '23505') { // PostgreSQL unique violation
          console.log(`[MESSAGING] Message ${messageType} already recorded for ${demo.id}`);
          return null;
        }
        throw dbError;
      }
    } catch (error: any) {
      // Check if Resend rejected due to duplicate idempotency key
      if (error?.statusCode === 409) {
        console.log(`[MESSAGING] Resend rejected duplicate: ${key}`);
        return null;
      }
      console.error(`Failed to send email ${messageType}:`, error);
      throw error;
    }
  }

  /**
   * Get messages for a demo
   */
  static async getMessagesForDemo(demoId: string): Promise<Message[]> {
    return db.messages.findByDemo(demoId);
  }

  /**
   * Check if message type already sent
   */
  static async wasMessageSent(demoId: string, messageType: MessageType): Promise<boolean> {
    return db.messages.exists(demoId, messageType);
  }
}
