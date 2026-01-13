/**
 * Messaging Service
 * Handles email delivery via Resend and SMS via Twilio
 * 
 * IDEMPOTENCY:
 * - Uses Resend's Idempotency-Key header to prevent duplicate sends
 * - DB has UNIQUE(demo_id, message_type) constraint on messages table
 * - Checks for existing message before attempting send
 */

import { Resend } from 'resend';
import Twilio from 'twilio';
import { db } from '@/lib/db';
import type { Demo, MessageType, Message } from '@/types/demo';
import { EmailTemplates } from '@/templates/email';
import { SmsTemplates } from '@/templates/sms';

let _resend: Resend | null = null;
let _twilio: Twilio.Twilio | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');
  _resend = new Resend(apiKey);
  return _resend;
}

function getTwilio(): Twilio.Twilio {
  if (_twilio) return _twilio;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) throw new Error('TWILIO credentials not configured');
  _twilio = Twilio(accountSid, authToken);
  return _twilio;
}

// SMS message types
const SMS_TYPES: MessageType[] = ['SMS_CONFIRM', 'SMS_REMINDER', 'SMS_JOIN_LINK', 'SMS_URGENT'];

export class MessagingService {
  /**
   * Send message (routes to email or SMS based on type)
   * @param demo - The demo record
   * @param messageType - Type of message to send
   * @param idempotencyKey - Optional key to prevent duplicate sends
   */
  static async sendMessage(
    demo: Demo, 
    messageType: MessageType,
    idempotencyKey?: string
  ): Promise<Message | null> {
    if (SMS_TYPES.includes(messageType)) {
      return this.sendSms(demo, messageType);
    }
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
   * Send SMS via Twilio
   */
  static async sendSms(
    demo: Demo,
    messageType: MessageType
  ): Promise<Message | null> {
    // Skip if no phone number
    if (!demo.phone) {
      console.log(`[MESSAGING] No phone for ${demo.email}, skipping SMS`);
      return null;
    }

    // Check if already sent
    const alreadySent = await this.wasMessageSent(demo.id, messageType);
    if (alreadySent) {
      console.log(`[MESSAGING] ${messageType} already sent to ${demo.phone}, skipping`);
      return null;
    }

    const template = SmsTemplates.getTemplate(messageType, demo);
    if (!template) {
      console.error(`No SMS template for ${messageType}`);
      return null;
    }

    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!twilioNumber) throw new Error('TWILIO_PHONE_NUMBER not configured');

    const twilio = getTwilio();

    try {
      const response = await twilio.messages.create({
        body: template.body,
        from: twilioNumber,
        to: demo.phone,
      });

      // Record message
      try {
        const message = await db.messages.insert({
          demo_id: demo.id,
          channel: 'SMS',
          message_type: messageType,
          recipient: demo.phone,
          subject: null,
          body: template.body,
          external_id: response.sid,
        });
        
        console.log(`[MESSAGING] SMS ${messageType} sent to ${demo.phone}`);
        return message;
      } catch (dbError: any) {
        if (dbError?.code === '23505') {
          console.log(`[MESSAGING] SMS ${messageType} already recorded for ${demo.id}`);
          return null;
        }
        throw dbError;
      }
    } catch (error) {
      console.error(`Failed to send SMS ${messageType}:`, error);
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
