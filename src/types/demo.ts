/**
 * Core type definitions for Demo Followup System
 */

export type DemoType = 'SAME_DAY' | 'NEXT_DAY' | 'FUTURE';

export type DemoStatus = 
  | 'PENDING'
  | 'CONFIRMED'
  | 'RESCHEDULED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'COMPLETED';

export type MessageChannel = 'EMAIL';

export type MessageType =
  | 'CONFIRM_INITIAL'
  | 'CONFIRM_REMINDER'
  | 'JOIN_LINK'
  | 'JOIN_URGENT'
  | 'SOONER_OFFER'
  | 'RECEIPT';

export interface Demo {
  id: string;
  calendly_event_id: string;
  calendly_invitee_id: string;
  email: string;
  phone: string | null;
  name: string;
  scheduled_at: string;
  timezone: string;
  demo_type: DemoType;
  join_url: string;
  status: DemoStatus;
  confirmed_at: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledJob {
  id: string;
  demo_id: string;
  qstash_message_id: string | null;
  message_type: MessageType;
  scheduled_for: string;
  executed: boolean;
  executed_at: string | null;
  cancelled: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  demo_id: string;
  channel: MessageChannel;
  message_type: MessageType;
  recipient: string;
  subject: string | null;
  body: string;
  external_id: string | null;
  sent_at: string;
}

export interface Reply {
  id: string;
  demo_id: string | null;
  channel: MessageChannel;
  from_address: string;
  body: string;
  intent: string | null;
  processed: boolean;
  received_at: string;
}

// Calendly webhook payload
export interface CalendlyEvent {
  event: 'invitee.created' | 'invitee.canceled';
  payload: {
    event: string;
    invitee: {
      uuid: string;
      email: string;
      name: string;
      timezone: string;
      text_reminder_number?: string;
    };
    scheduled_event: {
      uuid: string;
      start_time: string;
      end_time: string;
      location?: {
        join_url?: string;
      };
    };
    questions_and_answers?: Array<{
      question: string;
      answer: string;
    }>;
  };
}

// Job payload for QStash
export interface JobPayload {
  demo_id: string;
  message_type: MessageType;
  job_id: string;
}
