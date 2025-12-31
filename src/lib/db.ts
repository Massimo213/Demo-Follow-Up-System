/**
 * Database access layer
 * Type-safe wrappers around Supabase operations
 * 
 * Note: We use explicit type assertions because we don't have
 * CLI-generated Supabase types. In production, run:
 * `supabase gen types typescript --project-id <id> > src/types/supabase.ts`
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Demo, ScheduledJob, Message, Reply, DemoStatus, MessageType } from '@/types/demo';

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
      
      if (error) throw error;
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
