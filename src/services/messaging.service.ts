/**
 * Messaging Service
 * Handles email delivery via Resend
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
   */
  static async sendMessage(demo: Demo, messageType: MessageType): Promise<Message | null> {
    return this.sendEmail(demo, messageType);
  }

  /**
   * Send email
   */
  static async sendEmail(demo: Demo, messageType: MessageType): Promise<Message | null> {
    const template = EmailTemplates.getTemplate(messageType, demo);
    if (!template) {
      console.error(`No email template for ${messageType}`);
      return null;
    }

    const from = process.env.EMAIL_FROM;
    if (!from) throw new Error('EMAIL_FROM not configured');

    const resend = getResend();

    try {
      const response = await resend.emails.send({
        from,
        to: demo.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        replyTo: from,
        tags: [
          { name: 'demo_id', value: demo.id },
          { name: 'message_type', value: messageType },
        ],
      });

      // Record message
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
    } catch (error) {
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
