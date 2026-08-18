/**
 * Database access layer
 * Type-safe wrappers around Supabase operations
 * 
 * Note: We use explicit type assertions because we don't have
 * CLI-generated Supabase types. In production, run:
 * `supabase gen types typescript --project-id <id> > src/types/supabase.ts`
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Demo,
  ScheduledJob,
  Message,
  Reply,
  DemoStatus,
  MessageType,
  PqadVerdict,
  PipelineStage,
  FocusMetric,
  IngestPath,
} from '@/types/demo';
import { toE164 } from '@/lib/phone';

let _db: SupabaseClient | null = null;

function getDB(): SupabaseClient {
  if (_db) return _db;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  _db = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _db;
}

// Type for demo insert
interface DemoInsert {
  calendly_event_id: string;
  calendly_invitee_id: string;
  email: string;
  phone: string | null;
  name: string;
  scheduled_at: string;
  timezone: string;
  demo_type: string;
  join_url: string;
  status: string;
  organizer_booked_by?: string;
  horizon_hours?: number | null;
  ingest_path?: IngestPath;
  ingest_lag_seconds?: number | null;
  phone_e164?: string | null;
  phone_valid?: boolean;
  lead_source?: string | null;
  no_show_at?: string | null;
}

export interface DemoOrganizerPatch {
  organizer_booked_by?: string;
  organizer_personal_notes?: string;
  proposals_per_month?: number | null;
  avg_deal_size?: number | null;
  close_rate?: number | null;
  pqad_verdict?: PqadVerdict;
  pqad_rejection_reason?: string | null;
  pqad_locked?: boolean;
  sdr_payout_cents?: number | null;
  lieutenant_override_cents?: number | null;
  pqad_decided_at?: string | null;
  /** Assessment link — editable even when pqad_locked */
  assessment_link?: string | null;
  /** Private workspace link — editable even when pqad_locked */
  private_workspace_link?: string | null;
  /** Pipeline stage — editable even when pqad_locked */
  pipeline_stage?: PipelineStage;
  /** Rescue flag — editable even when pqad_locked */
  is_rescue?: boolean;
  /** Attendance — not blocked by pqad_locked */
  status?: DemoStatus;
  joined_at?: string | null;
  no_show_at?: string | null;
}

// Type for job insert
interface JobInsert {
  demo_id: string;
  qstash_message_id: string | null;
  message_type: string;
  scheduled_for: string;
  executed: boolean;
  cancelled: boolean;
}

// Type for message insert
interface MessageInsert {
  demo_id: string;
  channel: string;
  message_type: string;
  recipient: string;
  subject: string | null;
  body: string;
  external_id: string | null;
}

// Type for reply insert
interface ReplyInsert {
  demo_id: string | null;
  channel: string;
  from_address: string;
  body: string;
  intent: string | null;
  processed: boolean;
}

// Helper to get typed table reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string) => getDB().from(name) as any;

export const db = {
  // ==================== DEMOS ====================
  demos: {
    async insert(data: DemoInsert): Promise<Demo> {
      const { data: demo, error } = await table('demos')
        .insert(data)
        .select()
        .single();
      
      if (error) {
        const missingCol =
          /horizon_hours|ingest_path|phone_e164|ingest_lag_seconds|phone_valid|lead_source|no_show_at/i.test(
            error.message || ''
          ) || error.code === 'PGRST204';
        if (missingCol) {
          const {
            horizon_hours: _h,
            ingest_path: _i,
            phone_e164: _p,
            ingest_lag_seconds: _l,
            phone_valid: _v,
            lead_source: _s,
            no_show_at: _n,
            ...rest
          } = data;
          const retry = await table('demos').insert(rest).select().single();
          if (retry.error) throw retry.error;
          console.warn(
            '[DB] demos insert fell back — run sql/migrations/018_demo_truth.sql and 019_phase0_measurement.sql'
          );
          return retry.data as Demo;
        }
        throw error;
      }
      return demo as Demo;
    },

    async findById(id: string): Promise<Demo | null> {
      const { data, error } = await table('demos')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as Demo;
    },

    async findByCalendlyEventId(eventId: string): Promise<Demo | null> {
      const { data, error } = await table('demos')
        .select('*')
        .eq('calendly_event_id', eventId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as Demo;
    },

    async findByEmail(email: string): Promise<Demo | null> {
      const { data, error } = await table('demos')
        .select('*')
        .eq('email', email.toLowerCase())
        .in('status', ['PENDING', 'CONFIRMED'])
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as Demo | null;
    },

    async findByPhone(phone: string): Promise<Demo | null> {
      const normalizedPhone = phone.replace(/\D/g, '');
      const e164 = toE164(phone);

      if (e164) {
        const { data, error } = await table('demos')
          .select('*')
          .or(`phone_e164.eq.${e164},phone.ilike.%${normalizedPhone}%`)
          .in('status', ['PENDING', 'CONFIRMED'])
          .order('scheduled_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!error) return data as Demo | null;
      }

      const { data, error } = await table('demos')
        .select('*')
        .ilike('phone', `%${normalizedPhone}%`)
        .in('status', ['PENDING', 'CONFIRMED'])
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as Demo | null;
    },

    async updateStatus(
      id: string,
      status: DemoStatus,
      extra?: { confirmed_at?: string; joined_at?: string }
    ): Promise<Demo> {
      const { data, error } = await table('demos')
        .update({ status, ...extra })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Demo;
    },

    async updateFocusMetric(id: string, focusMetric: FocusMetric): Promise<Demo> {
      const { data, error } = await table('demos')
        .update({ focus_metric: focusMetric })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Demo;
    },

    async findForNoShowCheck(): Promise<Demo[]> {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data, error } = await table('demos')
        .select('*')
        .lt('scheduled_at', fiveMinutesAgo)
        .in('status', ['PENDING', 'CONFIRMED'])
        .order('scheduled_at', { ascending: true })
        .limit(100);
      
      if (error) throw error;
      return (data as Demo[]) || [];
    },

    /**
     * Candidates for auto-NO_SHOW: PENDING/CONFIRMED, no joined_at, meeting started before cutoff.
     * Caller still applies shouldAutoNoShow (strict < 12 minutes).
     */
    async findStaleForAutoNoShow(cutoffIso: string): Promise<Demo[]> {
      const { data, error } = await table('demos')
        .select('*')
        .in('status', ['PENDING', 'CONFIRMED'])
        .is('joined_at', null)
        .lt('scheduled_at', cutoffIso)
        .order('scheduled_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data as Demo[]) || [];
    },

    /**
     * Auto-NO_SHOW write. No-ops if organizer already set joined_at or status left PENDING/CONFIRMED.
     */
    async markAutoNoShow(id: string, noShowAt: string): Promise<Demo | null> {
      const attempt = async (patch: Record<string, string>) => {
        const { data, error } = await table('demos')
          .update(patch)
          .eq('id', id)
          .in('status', ['PENDING', 'CONFIRMED'])
          .is('joined_at', null)
          .select()
          .maybeSingle();
        return { data: data as Demo | null, error };
      };

      let { data, error } = await attempt({ status: 'NO_SHOW', no_show_at: noShowAt });
      if (error && /no_show_at/i.test(error.message || '')) {
        console.warn('[DB] no_show_at missing — run sql/migrations/019_phase0_measurement.sql');
        ({ data, error } = await attempt({ status: 'NO_SHOW' }));
      }
      if (error) throw error;
      return data || null;
    },

    async setPhoneInvalid(id: string): Promise<void> {
      const { error } = await table('demos').update({ phone_valid: false }).eq('id', id);
      if (error) throw error;
    },

    /** Organizer UI: filter by PQAD view + upcoming/past (scheduled_at vs server now, UTC). */
    async listForOrganizer(
      view: 'booked' | 'pqad' | 'rescue',
      period: 'upcoming' | 'past'
    ): Promise<Demo[]> {
      const nowIso = new Date().toISOString();
      let q = table('demos').select('*').limit(1000);

      if (view === 'booked') {
        q = q.neq('status', 'CANCELLED');
      } else if (view === 'pqad') {
        q = q.eq('pqad_verdict', 'yes');
      } else {
        q = q.eq('is_rescue', true).neq('status', 'CANCELLED');
      }

      if (period === 'upcoming') {
        q = q.gte('scheduled_at', nowIso).order('scheduled_at', { ascending: true });
      } else {
        q = q.lt('scheduled_at', nowIso).order('scheduled_at', { ascending: false });
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data as Demo[]) || [];
    },

    async listForAnalytics(): Promise<Demo[]> {
      const { data, error } = await table('demos')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data as Demo[]) || [];
    },

    async updateOrganizerFields(id: string, patch: DemoOrganizerPatch): Promise<Demo> {
      const { data, error } = await table('demos')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Demo;
    },
  },

  // ==================== SCHEDULED JOBS ====================
  jobs: {
    async upsert(data: JobInsert): Promise<ScheduledJob> {
      const { data: job, error } = await table('scheduled_jobs')
        .upsert(data, { onConflict: 'demo_id,message_type' })
        .select()
        .single();
      
      if (error) throw error;
      return job as ScheduledJob;
    },

    async findPending(demoId: string): Promise<ScheduledJob[]> {
      const { data, error } = await table('scheduled_jobs')
        .select('*')
        .eq('demo_id', demoId)
        .eq('executed', false)
        .eq('cancelled', false);
      
      if (error) throw error;
      return (data as ScheduledJob[]) || [];
    },

    async findByDemoAndType(demoId: string, messageType: MessageType): Promise<ScheduledJob | null> {
      const { data, error } = await table('scheduled_jobs')
        .select('*')
        .eq('demo_id', demoId)
        .eq('message_type', messageType)
        .maybeSingle();
      
      if (error) throw error;
      return data as ScheduledJob | null;
    },

    async cancel(demoId: string, messageTypes?: MessageType[]): Promise<void> {
      let query = table('scheduled_jobs')
        .update({ cancelled: true })
        .eq('demo_id', demoId)
        .eq('executed', false);
      
      if (messageTypes) {
        query = query.in('message_type', messageTypes);
      }
      
      const { error } = await query;
      if (error) throw error;
    },

    async markExecuted(demoId: string, messageType: MessageType): Promise<void> {
      const { error } = await table('scheduled_jobs')
        .update({ executed: true, executed_at: new Date().toISOString() })
        .eq('demo_id', demoId)
        .eq('message_type', messageType);
      
      if (error) throw error;
    },
  },

  // ==================== MESSAGES ====================
  messages: {
    async insert(data: MessageInsert): Promise<Message> {
      const { data: msg, error } = await table('messages')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return msg as Message;
    },

    async findByDemo(demoId: string): Promise<Message[]> {
      const { data, error } = await table('messages')
        .select('*')
        .eq('demo_id', demoId)
        .order('sent_at', { ascending: true });
      
      if (error) throw error;
      return (data as Message[]) || [];
    },

    async exists(demoId: string, messageType: MessageType): Promise<boolean> {
      const { data, error } = await table('messages')
        .select('id')
        .eq('demo_id', demoId)
        .eq('message_type', messageType)
        .limit(1);
      
      if (error) throw error;
      return (data?.length || 0) > 0;
    },

    async listForAnalytics(): Promise<Message[]> {
      const { data, error } = await table('messages')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20000);
      if (error) throw error;
      return (data as Message[]) || [];
    },
  },

  // ==================== REPLIES ====================
  replies: {
    async insert(data: ReplyInsert): Promise<Reply> {
      const { data: reply, error } = await table('replies')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return reply as Reply;
    },

    async findUnprocessed(): Promise<Reply[]> {
      const { data, error } = await table('replies')
        .select('*')
        .eq('processed', false)
        .order('received_at', { ascending: true });
      
      if (error) throw error;
      return (data as Reply[]) || [];
    },
  },
};
