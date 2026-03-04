'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';

/* ───── Types ───── */

interface ProspectRow {
  id: string;
  name: string;
  email: string;
  agency_name: string;
  proposals_per_month: number;
  avg_deal_size: number;
  close_rate: number;
  time_to_cash_days: number;
  status: string;
  demo_date: string;
  created_at: string;
  roi: { monthly_gap: number; annual_gap: number; elystra_close_rate: number };
}

interface FormData {
  name: string;
  email: string;
  agency_name: string;
  proposals_per_month: string;
  avg_deal_size: string;
  close_rate: string;
  time_to_cash_days: string;
  objection_type: string;
  demo_date: string;
  phone: string;
  notes: string;
  agency_proposal_link: string;
}

const BLANK: FormData = {
  name: '',
  email: '',
  agency_name: '',
  proposals_per_month: '',
  avg_deal_size: '',
  close_rate: '',
  time_to_cash_days: '',
  objection_type: 'OTHER',
  demo_date: new Date().toISOString().split('T')[0],
  phone: '',
  notes: '',
  agency_proposal_link: '',
};

const OBJECTIONS = [
  { v: 'NEED_PARTNER_APPROVAL', l: 'Need partner approval' },
  { v: 'CHECKING_INTEGRATIONS', l: 'Checking integrations' },
  { v: 'REVIEWING_PIPELINE', l: 'Reviewing pipeline' },
  { v: 'NEED_TIME_TO_THINK', l: 'Need time to think' },
  { v: 'PRICE_CONCERN', l: 'Price concern' },
  { v: 'OTHER', l: 'Other' },
];

function $(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const STATUS_LABELS: Record<string, { label: string; bg: string; fg: string }> = {
  ACTIVE: { label: 'Active', bg: '#dbeafe', fg: '#1d4ed8' },
  CLOSED_WON: { label: 'Won', bg: '#dcfce7', fg: '#16a34a' },
  CLOSED_LOST: { label: 'Lost', bg: '#fee2e2', fg: '#dc2626' },
  PAUSED: { label: 'Paused', bg: '#fef3c7', fg: '#d97706' },
};

/* ───── Component ───── */

export default function PostDemoPage() {
  const [form, setForm] = useState<FormData>(BLANK);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [fetching, setFetching] = useState(true);

  const set = (k: keyof FormData, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const loadProspects = useCallback(async () => {
    try {
      const res = await fetch('/api/prospects');
      const data = await res.json();
      if (res.ok) setProspects(data.prospects || []);
    } catch { /* silent */ }
    setFetching(false);
  }, []);

  useEffect(() => { loadProspects(); }, [loadProspects]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setToast(null);
    try {
      const res = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          agency_name: form.agency_name.trim(),
          proposals_per_month: parseInt(form.proposals_per_month),
          avg_deal_size: parseInt(form.avg_deal_size),
          close_rate: parseFloat(form.close_rate),
          time_to_cash_days: parseInt(form.time_to_cash_days),
          objection_type: form.objection_type,
          demo_date: form.demo_date,
          phone: form.phone.trim() || null,
          notes: form.notes.trim() || null,
          agency_proposal_link: form.agency_proposal_link.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ ok: false, text: data.details?.[0]?.message || data.error || 'Failed' });
        return;
      }
      setToast({ ok: true, text: `${form.agency_name} added — first email in 30 min` });
      setForm(BLANK);
      loadProspects();
    } catch (err) {
      setToast({ ok: false, text: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await fetch(`/api/prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      loadProspects();
    } catch { /* silent */ }
  }

  const active = prospects.filter((p) => p.status === 'ACTIVE');
  const closed = prospects.filter((p) => p.status !== 'ACTIVE');

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f8', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>

        {/* ─── Header ─── */}
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: '#0066ff' }}>ELYSTRA</span>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '4px 0 4px', color: '#111' }}>Post-Demo Prospects</h1>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>Add a prospect after the demo. 4 emails fire automatically using their numbers.</p>
        </div>

        {/* ─── Two-column: form left, active right ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>

          {/* ─── Add Form ─── */}
          <div style={card}>
            <h2 style={cardTitle}>Add prospect</h2>

            {toast && (
              <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 6, marginBottom: 12, background: toast.ok ? '#ecfdf5' : '#fef2f2', color: toast.ok ? '#059669' : '#dc2626' }}>
                {toast.text}
              </div>
            )}

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input style={inp} placeholder="Name *" value={form.name} onChange={(e) => set('name', e.target.value)} required />
              <input style={inp} type="email" placeholder="Email *" value={form.email} onChange={(e) => set('email', e.target.value)} required />
              <input style={inp} placeholder="Agency *" value={form.agency_name} onChange={(e) => set('agency_name', e.target.value)} required />

              <div style={row}>
                <input style={inpH} type="number" min="1" placeholder="Proposals/mo *" value={form.proposals_per_month} onChange={(e) => set('proposals_per_month', e.target.value)} required />
                <input style={inpH} type="number" min="1" placeholder="Deal size $ *" value={form.avg_deal_size} onChange={(e) => set('avg_deal_size', e.target.value)} required />
              </div>
              <div style={row}>
                <input style={inpH} type="number" min="1" max="99" step="0.1" placeholder="Close % *" value={form.close_rate} onChange={(e) => set('close_rate', e.target.value)} required />
                <input style={inpH} type="number" min="1" placeholder="Days to cash *" value={form.time_to_cash_days} onChange={(e) => set('time_to_cash_days', e.target.value)} required />
              </div>

              <div style={row}>
                <select style={inpH} value={form.objection_type} onChange={(e) => set('objection_type', e.target.value)}>
                  {OBJECTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <input style={inpH} type="date" value={form.demo_date} onChange={(e) => set('demo_date', e.target.value)} required />
              </div>

              <input style={inp} type="tel" placeholder="Phone (optional)" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              <input style={inp} type="url" placeholder="Agency proposal link (optional)" value={form.agency_proposal_link} onChange={(e) => set('agency_proposal_link', e.target.value)} />
              <textarea style={{ ...inp, minHeight: 48, resize: 'vertical' as const }} placeholder="Notes (optional)" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />

              <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Adding...' : 'Add prospect'}
              </button>
            </form>
          </div>

          {/* ─── Active Prospects ─── */}
          <div style={card}>
            <h2 style={cardTitle}>Active ({active.length})</h2>
            {fetching ? (
              <p style={{ color: '#999', fontSize: 14 }}>Loading...</p>
            ) : active.length === 0 ? (
              <p style={{ color: '#999', fontSize: 14 }}>No active prospects yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {active.map((p) => (
                  <ProspectCard key={p.id} p={p} onStatus={updateStatus} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── History ─── */}
        {closed.length > 0 && (
          <div style={{ ...card, marginTop: 24 }}>
            <h2 style={cardTitle}>History ({closed.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {closed.map((p) => (
                <ProspectCard key={p.id} p={p} onStatus={updateStatus} compact />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ───── Prospect Card ───── */

function ProspectCard({ p, onStatus, compact }: { p: ProspectRow; onStatus: (id: string, s: string) => void; compact?: boolean }) {
  const st = STATUS_LABELS[p.status] || STATUS_LABELS.ACTIVE;

  return (
    <div style={{ padding: compact ? '10px 14px' : '14px 16px', background: '#fafafa', border: '1px solid #eee', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 600, fontSize: compact ? 13 : 15, color: '#111' }}>{p.agency_name}</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.fg }}>{st.label}</span>
        </div>
        <div style={{ fontSize: 13, color: '#666' }}>
          {p.name} &middot; {p.proposals_per_month} props/mo &middot; {$(p.avg_deal_size)} avg &middot; {p.close_rate}% close
        </div>
        {!compact && (
          <div style={{ fontSize: 12, color: '#0066ff', fontWeight: 600, marginTop: 4 }}>
            Leak: {$(p.roi.monthly_gap)}/mo &middot; {$(p.roi.annual_gap)}/yr
          </div>
        )}
      </div>

      {p.status === 'ACTIVE' && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onStatus(p.id, 'CLOSED_WON')} style={smallBtn('#16a34a')}>Won</button>
          <button onClick={() => onStatus(p.id, 'CLOSED_LOST')} style={smallBtn('#dc2626')}>Lost</button>
          <button onClick={() => onStatus(p.id, 'PAUSED')} style={smallBtn('#d97706')}>Pause</button>
        </div>
      )}

      {p.status === 'PAUSED' && (
        <button onClick={() => onStatus(p.id, 'ACTIVE')} style={smallBtn('#1d4ed8')}>Resume</button>
      )}
    </div>
  );
}

/* ───── Styles ───── */

const card: React.CSSProperties = { background: '#fff', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: 24 };
const cardTitle: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: '#111', margin: '0 0 16px' };
const inp: React.CSSProperties = { padding: '9px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' };
const inpH: React.CSSProperties = { ...inp, flex: 1 };
const row: React.CSSProperties = { display: 'flex', gap: 10 };
const btn: React.CSSProperties = { marginTop: 4, padding: 12, fontSize: 15, fontWeight: 600, color: '#fff', background: '#0066ff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' };

function smallBtn(color: string): React.CSSProperties {
  return { padding: '4px 10px', fontSize: 12, fontWeight: 600, color: '#fff', background: color, border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' };
}
