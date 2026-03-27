/**
 * Prospect Messaging Service
 * Handles email + SMS for post-demo follow-up sequence.
 * Same infrastructure (Gmail SMTP + Twilio), different templates.
 */

import nodemailer from 'nodemailer';
import Twilio from 'twilio';
import { prospectDb } from '@/lib/prospect-db';
import type { Prospect, ProspectMessageType, ProspectMessage } from '@/types/prospect';
import { PostDemoEmailTemplates } from '@/templates/post-demo-email';
import { PostDemoSmsTemplates } from '@/templates/post-demo-sms';

let _transporter: nodemailer.Transporter | null = null;
let _twilio: Twilio.Twilio | null = null;

function getGmailTransporter(): nodemailer.Transporter {
  if (_transporter) return _transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_USER or GMAIL_APP_PASSWORD not configured');
  _transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return _transporter;
}

function getTwilio(): Twilio.Twilio {
  if (_twilio) return _twilio;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('TWILIO credentials not configured');
  _twilio = Twilio(sid, token);
  return _twilio;
}

const SMS_TYPES: ProspectMessageType[] = [
  'PD_SMS_ASSESSMENT_WORKSPACE',
  'PD_SMS_MISSED_CALL',
  'PD_SMS_DECISION',
];

const INTERNAL_EMAIL_TYPES: ProspectMessageType[] = [
  'PD_INTERNAL_CALL_REMINDER',
];

const INTERNAL_TEAM_EMAIL = process.env.ELYSTRA_TEAM_EMAIL || 'elystrateam@gmail.com';

export class ProspectMessagingService {
  static async sendMessage(
    prospect: Prospect,
    messageType: ProspectMessageType
  ): Promise<ProspectMessage | null> {
    if (SMS_TYPES.includes(messageType)) {
      return this.sendSms(prospect, messageType);
    }
    return this.sendEmail(prospect, messageType);
  }

  static async sendEmail(
    prospect: Prospect,
    messageType: ProspectMessageType
  ): Promise<ProspectMessage | null> {
    const alreadySent = await prospectDb.messages.exists(prospect.id, messageType);
    if (alreadySent) {
      console.log(`[PROSPECT-MSG] ${messageType} already sent to ${prospect.email}, skipping`);
      return null;
    }

    const template = PostDemoEmailTemplates.getTemplate(messageType, prospect);
    if (!template) {
      console.error(`[PROSPECT-MSG] No template for ${messageType}`);
      return null;
    }

    const gmailUser = process.env.GMAIL_USER;
    if (!gmailUser) throw new Error('GMAIL_USER not configured');
    const fromName = 'David from Elystra';
    const from = `"${fromName}" <${gmailUser}>`;
    const recipient = INTERNAL_EMAIL_TYPES.includes(messageType)
      ? INTERNAL_TEAM_EMAIL
      : prospect.email;

    const transporter = getGmailTransporter();

    try {
      const info = await transporter.sendMail({
        from,
        to: recipient,
        subject: template.subject,
        html: template.html,
        text: template.text,
        replyTo: gmailUser,
      });

      console.log(`[PROSPECT-MSG] Email ${messageType} sent to ${recipient}, id: ${info.messageId}`);

      try {
        return await prospectDb.messages.insert({
          prospect_id: prospect.id,
          channel: 'EMAIL',
          message_type: messageType,
          recipient,
          subject: template.subject,
          body: template.text,
          external_id: info.messageId || null,
        });
      } catch (dbError: unknown) {
        if ((dbError as { code?: string })?.code === '23505') {
          console.log(`[PROSPECT-MSG] ${messageType} already recorded for ${prospect.id}`);
          return null;
        }
        throw dbError;
      }
    } catch (error) {
      console.error(`[PROSPECT-MSG] Failed to send email ${messageType}:`, error);
      throw error;
    }
  }

  static async sendSms(
    prospect: Prospect,
    messageType: ProspectMessageType
  ): Promise<ProspectMessage | null> {
    if (!prospect.phone) {
      console.log(`[PROSPECT-MSG] No phone for ${prospect.email}, skipping SMS`);
      return null;
    }

    const alreadySent = await prospectDb.messages.exists(prospect.id, messageType);
    if (alreadySent) {
      console.log(`[PROSPECT-MSG] SMS ${messageType} already sent to ${prospect.phone}, skipping`);
      return null;
    }

    const template = PostDemoSmsTemplates.getTemplate(messageType, prospect);
    if (!template) {
      console.error(`[PROSPECT-MSG] No SMS template for ${messageType}`);
      return null;
    }

    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!twilioNumber) throw new Error('TWILIO_PHONE_NUMBER not configured');

    const twilio = getTwilio();

    try {
      const response = await twilio.messages.create({
        body: template.body,
        from: twilioNumber,
        to: prospect.phone,
      });

      try {
        const msg = await prospectDb.messages.insert({
          prospect_id: prospect.id,
          channel: 'SMS',
          message_type: messageType,
          recipient: prospect.phone,
          subject: null,
          body: template.body,
          external_id: response.sid,
        });
        console.log(`[PROSPECT-MSG] SMS ${messageType} sent to ${prospect.phone}`);
        return msg;
      } catch (dbError: unknown) {
        if ((dbError as { code?: string })?.code === '23505') {
          console.log(`[PROSPECT-MSG] SMS ${messageType} already recorded for ${prospect.id}`);
          return null;
        }
        throw dbError;
      }
    } catch (error) {
      console.error(`[PROSPECT-MSG] Failed to send SMS ${messageType}:`, error);
      throw error;
    }
  }

  static async wasMessageSent(
    prospectId: string,
    messageType: ProspectMessageType
  ): Promise<boolean> {
    return prospectDb.messages.exists(prospectId, messageType);
  }
}
