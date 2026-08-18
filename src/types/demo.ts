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

export type MessageChannel = 'EMAIL' | 'SMS';

export type MessageType =
  | 'CONFIRM_INITIAL'
  | 'CONFIRM_INITIAL_LOOM'
  | 'CONFIRM_REMINDER'
  | 'DAY_OF_REMINDER'
  | 'JOIN_LINK'
  | 'JOIN_URGENT'
  | 'SOONER_OFFER'
  | 'RECEIPT'
  | 'SMS_CONFIRM'
  | 'SMS_REMINDER'
  | 'SMS_JOIN_LINK'
  | 'SMS_URGENT'
  | 'EVENING_BEFORE'
  | 'VALUE_BOMB'
  | 'SMS_DAY_BEFORE'
  | 'POST_NO_SHOW';

/** Organizer / payout rail — set only via Massimo-only API */
export type PqadVerdict = 'pending' | 'yes' | 'no' | 'no_show';

/** Pipeline stage for tracking deal progression after the demo */
export type PipelineStage =
  | 'demo_done'
  | 'assessment_sent'
  | 'proposal_sent'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

/** How the demo row entered the system */
export type IngestPath = 'webhook' | 'sync' | 'test' | 'unknown';

/** Focus metric the prospect wants to improve — captured via commitment ladder */
export type FocusMetric = 'close_rate' | 'deal_size' | 'follow_up' | null;

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
  no_show_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Hours from ingest to meeting — stored so classification is auditable. Immutable after insert. */
  horizon_hours?: number | null;
  ingest_path?: IngestPath | null;
  ingest_lag_seconds?: number | null;
  phone_e164?: string | null;
  phone_valid?: boolean;
  lead_source?: string | null;
  /** Focus metric captured from commitment ladder — close rate, deal size, or follow-up */
  focus_metric?: FocusMetric;
  /** Organizer rail — present after migration 011 */
  organizer_booked_by?: string;
  pqad_verdict?: PqadVerdict;
  pqad_rejection_reason?: string | null;
  pqad_locked?: boolean;
  sdr_payout_cents?: number | null;
  lieutenant_override_cents?: number | null;
  pqad_decided_at?: string | null;
  /** Private notes — Massimo organizer UI only */
  organizer_personal_notes?: string;
  /** Organizer-captured pipeline numbers — editable even when pqad_locked */
  proposals_per_month?: number | null;
  avg_deal_size?: number | null;
  close_rate?: number | null;
  /** Assessment link sent to the prospect — editable even when pqad_locked */
  assessment_link?: string | null;
  /** Private workspace link for the prospect — editable even when pqad_locked */
  private_workspace_link?: string | null;
  /** Pipeline stage tracking — editable even when pqad_locked */
  pipeline_stage?: PipelineStage;
  /** Flag for deals needing rescue / win-back — editable even when pqad_locked */
  is_rescue?: boolean;
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
  processing: boolean;
  processing_started_at: string | null;
  retry_count: number;
  last_error: string | null;
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
    created_at?: string;
    tracking?: {
      utm_source?: string;
      utm_campaign?: string;
      utm_medium?: string;
    };
    invitee: {
      uuid: string;
      email: string;
      name: string;
      timezone: string;
      created_at?: string;
      text_reminder_number?: string;
    };
    scheduled_event: {
      uuid: string;
      start_time: string;
      end_time: string;
      created_at?: string;
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
