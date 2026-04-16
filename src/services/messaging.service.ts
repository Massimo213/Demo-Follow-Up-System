/**
 * Messaging Service
 * Handles email delivery via Gmail SMTP and SMS via Twilio
 * 
 * IDEMPOTENCY:
 * - DB has UNIQUE(demo_id, message_type) constraint on messages table
 * - Checks for existing message before attempting send
 * 
 * GMAIL SETUP:
 * 1. Enable 2FA on your Google Account
 * 2. Go to: Google Account → Security → 2-Step Verification → App passwords
 * 3. Create an app password for "Mail"
 * 4. Set GMAIL_USER and GMAIL_APP_PASSWORD env vars
 */

import nodemailer from 'nodemailer';
import Twilio from 'twilio';
import { db } from '@/lib/db';
import type { Demo, MessageType, Message } from '@/types/demo';
import { EmailTemplates } from '@/templates/email';
import { SmsTemplates } from '@/templates/sms';

let _transporter: nodemailer.Transporter | null = null;
let _twilio: Twilio.Twilio | null = null;

function getGmailTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;
  
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  
  if (!user || !pass) {
    throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD not configured');
  }
  
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  
  return _transporter;
}

function getTwilio(): Twilio.Twilio {
  if (_twilio) return _twilio;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) throw new Error('TWILIO credentials not configured');
  _twilio = Twilio(accountSid, authToken);
  return _twilio;
}

/** NANP display: +13433129283 → "343 312-9283" */
export function formatNanpPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const last10 =
    digits.length >= 11 && digits.startsWith('1')
      ? digits.slice(-10)
      : digits.length >= 10
        ? digits.slice(-10)
        : digits;
  if (last10.length === 10) {
    return `${last10.slice(0, 3)} ${last10.slice(3, 6)}-${last10.slice(6)}`;
  }
  return phone.trim() || 'unknown';
}

// SMS message types - routed to Twilio instead of Gmail
const SMS_TYPES: MessageType[] = [
  'SMS_CONFIRM', 'SMS_REMINDER', 'SMS_JOIN_LINK', 'SMS_URGENT',
  'EVENING_BEFORE', 'SMS_DAY_BEFORE',
];

export class MessagingService {
  /**
   * Send message (routes to email or SMS based on type)
   * CONFIRM_REMINDER: email if ext, SMS if !ext (no email)
   */
  static async sendMessage(
    demo: Demo,
    messageType: MessageType,
    idempotencyKey?: string
  ): Promise<Message | null> {
    // CONFIRM_REMINDER: channel varies — email if ext, SMS if !ext
    if (messageType === 'CONFIRM_REMINDER') {
      if (demo.email?.trim()) {
        return this.sendEmail(demo, messageType, idempotencyKey);
      }
      if (demo.phone?.trim()) {
        return this.sendSms(demo, messageType);
      }
      console.log(`[MESSAGING] No email or phone for CONFIRM_REMINDER, skipping`);
      return null;
    }

    if (SMS_TYPES.includes(messageType)) {
      return this.sendSms(demo, messageType);
    }
    return this.sendEmail(demo, messageType, idempotencyKey);
  }

  /**
   * Send email via Gmail SMTP with idempotency protection
   */
  static async sendEmail(
    demo: Demo, 
    messageType: MessageType,
    idempotencyKey?: string
  ): Promise<Message | null> {
    // Defense in depth: Check if already sent
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

    const gmailUser = process.env.GMAIL_USER;
    if (!gmailUser) throw new Error('GMAIL_USER not configured');

    // Display name for "From" field
    const fromName = 'David from Elystra';
    const from = `"${fromName}" <${gmailUser}>`;

    const transporter = getGmailTransporter();

    try {
      const info = await transporter.sendMail({
        from,
        to: demo.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        replyTo: gmailUser,
      });

      console.log(`[MESSAGING] Email ${messageType} sent to ${demo.email}, messageId: ${info.messageId}`);

      // Record message - DB constraint will reject if duplicate
      try {
        const message = await db.messages.insert({
          demo_id: demo.id,
          channel: 'EMAIL',
          message_type: messageType,
          recipient: demo.email,
          subject: template.subject,
          body: template.text,
          external_id: info.messageId || null,
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

  /**
   * Forward inbound SMS transcript to ops inbox (Gmail SMTP).
   * Uses ELYSTRA_TEAM_EMAIL (default elystrateam@gmail.com). Does not touch demo messages table.
   */
  static async sendInboundSmsTeamNotification(opts: {
    fromPhoneE164: string;
    body: string;
    intent?: string;
    senderName?: string;
    messageSid?: string;
  }): Promise<void> {
    const gmailUser = process.env.GMAIL_USER;
    if (!gmailUser) {
      console.warn('[TEAM-NOTIFY] GMAIL_USER not set, skip team email');
      return;
    }

    const to = process.env.ELYSTRA_TEAM_EMAIL || 'elystrateam@gmail.com';
    const displayPhone = formatNanpPhoneDisplay(opts.fromPhoneE164);
    const subject = `Inbound SMS — ${displayPhone}`;

    const meta = [
      opts.senderName ? `Sender (CRM): ${opts.senderName}` : null,
      opts.intent ? `Intent: ${opts.intent}` : null,
      opts.messageSid ? `MessageSid: ${opts.messageSid}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const text = `${displayPhone} said :\n\n${opts.body}${meta ? `\n\n—\n${meta}` : ''}`;
    const html = `<p><strong>${displayPhone}</strong> said :</p><pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(
      opts.body
    )}</pre>${meta ? `<p style="color:#666;font-size:12px">${escapeHtml(meta).replace(/\n/g, '<br/>')}</p>` : ''}`;

    const fromName = 'Elystra Inbound';
    const from = `"${fromName}" <${gmailUser}>`;

    const transporter = getGmailTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
      replyTo: gmailUser,
    });
    console.log(`[TEAM-NOTIFY] Team email sent to ${to}, id=${info.messageId}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
