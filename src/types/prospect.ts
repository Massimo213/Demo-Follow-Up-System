/**
 * Post-Demo Follow-Up Types
 * Parallel pipeline to pre-demo system — zero coupling, zero risk.
 */

export type ProspectStatus = 'ACTIVE' | 'CLOSED_WON' | 'CLOSED_LOST' | 'PAUSED';

export type ObjectionType =
  | 'NEED_PARTNER_APPROVAL'
  | 'CHECKING_INTEGRATIONS'
  | 'REVIEWING_PIPELINE'
  | 'NEED_TIME_TO_THINK'
  | 'PRICE_CONCERN'
  | 'OTHER';

export type ProspectMessageType =
  | 'PD_RECAP_ROI'
  | 'PD_STAKEHOLDER_BRIEF'
  | 'PD_DIRECT_ASK'
  | 'PD_CLOSING_FILE'
  | 'PD_SMS_ASSESSMENT_WORKSPACE'
  | 'PD_SMS_MISSED_CALL'
  | 'PD_SMS_DECISION'
  | 'PD_INTERNAL_CALL_REMINDER';

export interface Prospect {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  agency_name: string;
  proposals_per_month: number | null;
  avg_deal_size: number | null;
  close_rate: number | null;
  time_to_cash_days: number | null;
  objection_type: ObjectionType;
  notes: string | null;
  demo_date: string;
  status: ProspectStatus;
  pricing_page_url: string;
  agency_proposal_link: string | null;
  /** Day 1 email; optional env fallbacks: ELYSTRA_DEFAULT_ASSESSMENT_LINK, ELYSTRA_DEFAULT_WORKSPACE_LINK */
  assessment_link?: string | null;
  workspace_link?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectScheduledJob {
  id: string;
  prospect_id: string;
  message_type: ProspectMessageType;
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

export interface ProspectMessage {
  id: string;
  prospect_id: string;
  channel: 'EMAIL' | 'SMS';
  message_type: ProspectMessageType;
  recipient: string;
  subject: string | null;
  body: string;
  external_id: string | null;
  sent_at: string;
}

export interface ROICalculation {
  current_monthly_revenue: number;
  current_deals_closed: number;
  elystra_close_rate: number;
  elystra_monthly_revenue: number;
  elystra_deals_closed: number;
  extra_deals_per_month: number;
  monthly_revenue_gap: number;
  annual_revenue_gap: number;
  daily_leak: number;
  weekly_leak: number;
  time_to_cash_saved_days: number;
  elystra_time_to_cash: number;
}

export interface ProspectCreateInput {
  name: string;
  email: string;
  phone: string | null;
  agency_name: string;
  proposals_per_month?: number | null;
  avg_deal_size?: number | null;
  close_rate?: number | null;
  time_to_cash_days?: number | null;
  objection_type: ObjectionType;
  notes: string | null;
  demo_date: string;
  pricing_page_url?: string;
  agency_proposal_link?: string | null;
  assessment_link?: string | null;
  workspace_link?: string | null;
}
