/**
 * Prospect DB access layer
 * Mirrors the demo db.ts pattern — parallel tables, zero coupling.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  Prospect,
  ProspectScheduledJob,
  ProspectMessage,
  ProspectMessageType,
  ProspectStatus,
} from '@/types/prospect';

let _db: SupabaseClient | null = null;

function getDB(): SupabaseClient {
  if (_db) return _db;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  _db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string) => getDB().from(name) as any;

interface ProspectInsert {
  name: string;
  email: string;
  phone: string | null;
  agency_name: string;
  proposals_per_month: number;
  avg_deal_size: number;
  close_rate: number;
  time_to_cash_days: number;
  objection_type: string;
  notes: string | null;
  demo_date: string;
  status: string;
  pricing_page_url: string;
  agency_proposal_link: string | null;
}

interface ProspectJobInsert {
  prospect_id: string;
  message_type: string;
  scheduled_for: string;
  executed: boolean;
  cancelled: boolean;
}

interface ProspectMessageInsert {
  prospect_id: string;
  channel: string;
  message_type: string;
  recipient: string;
  subject: string | null;
  body: string;
  external_id: string | null;
}

export const prospectDb = {
  prospects: {
    async insert(data: ProspectInsert): Promise<Prospect> {
      const { data: prospect, error } = await table('prospects')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return prospect as Prospect;
    },

    async findById(id: string): Promise<Prospect | null> {
      const { data, error } = await table('prospects')
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as Prospect;
    },

    async findByEmail(email: string): Promise<Prospect | null> {
      const { data, error } = await table('prospects')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as Prospect | null;
    },

    async updateStatus(id: string, status: ProspectStatus): Promise<Prospect> {
      const { data, error } = await table('prospects')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Prospect;
    },

    async listActive(): Promise<Prospect[]> {
      const { data, error } = await table('prospects')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Prospect[]) || [];
    },

    async listAll(): Promise<Prospect[]> {
      const { data, error } = await table('prospects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Prospect[]) || [];
    },

    async findActiveBySearch(query: string): Promise<Prospect | null> {
      const raw = query.trim().replace(/"/g, '""');
      const pattern = `"%${raw}%"`;
      const { data, error } = await table('prospects')
        .select('*')
        .eq('status', 'ACTIVE')
        .or(`name.ilike.${pattern},email.ilike.${pattern},agency_name.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const list = Array.isArray(data) ? data : data ? [data] : [];
      return (list[0] as Prospect) || null;
    },
  },

  jobs: {
    async upsert(data: ProspectJobInsert): Promise<ProspectScheduledJob> {
      const { data: job, error } = await table('prospect_scheduled_jobs')
        .upsert(data, { onConflict: 'prospect_id,message_type' })
        .select()
        .single();
      if (error) throw error;
      return job as ProspectScheduledJob;
    },

    async cancel(prospectId: string, messageTypes?: ProspectMessageType[]): Promise<void> {
      let query = table('prospect_scheduled_jobs')
        .update({ cancelled: true })
        .eq('prospect_id', prospectId)
        .eq('executed', false);
      if (messageTypes) {
        query = query.in('message_type', messageTypes);
      }
      const { error } = await query;
      if (error) throw error;
    },

    async markExecuted(prospectId: string, messageType: ProspectMessageType): Promise<void> {
      const { error } = await table('prospect_scheduled_jobs')
        .update({ executed: true, executed_at: new Date().toISOString() })
        .eq('prospect_id', prospectId)
        .eq('message_type', messageType);
      if (error) throw error;
    },
  },

  messages: {
    async insert(data: ProspectMessageInsert): Promise<ProspectMessage> {
      const { data: msg, error } = await table('prospect_messages')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return msg as ProspectMessage;
    },

    async exists(prospectId: string, messageType: ProspectMessageType): Promise<boolean> {
      const { data, error } = await table('prospect_messages')
        .select('id')
        .eq('prospect_id', prospectId)
        .eq('message_type', messageType)
        .limit(1);
      if (error) throw error;
      return (data?.length || 0) > 0;
    },

    async findByProspect(prospectId: string): Promise<ProspectMessage[]> {
      const { data, error } = await table('prospect_messages')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('sent_at', { ascending: true });
      if (error) throw error;
      return (data as ProspectMessage[]) || [];
    },
  },

  raw: getDB,
};
