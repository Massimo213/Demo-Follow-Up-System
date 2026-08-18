'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { addMinutes, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { enUS } from 'date-fns/locale';
import type { Demo, PqadVerdict, PipelineStage } from '@/types/demo';
import { AnalyticsPanel } from './analytics-panel';
import { isUnresolvedPast } from '@/lib/show-rate';
import { canOrganizerCorrectAttendance, isLiveMeetingWindow } from '@/lib/phase0-rules';

type Tab = 'booked' | 'pqad' | 'pipeline' | 'rescue' | 'analytics';
type Period = 'upcoming' | 'past';

const RESCUE_COLOR = '#ff453a';

const PIPELINE_STAGES: { value: PipelineStage; label: string; color: string }[] = [
  { value: 'demo_done',       label: 'Demo done',        color: '#636366' },
  { value: 'assessment_sent', label: 'Assessment sent',  color: '#0a84ff' },
  { value: 'proposal_sent',   label: 'Proposal sent',    color: '#ff9f0a' },
  { value: 'negotiation',     label: 'Negotiation',      color: '#bf5af2' },
  { value: 'closed_won',      label: 'Closed won',       color: '#30d158' },
  { value: 'closed_lost',     label: 'Closed lost',      color: '#48484a' },
];

/** Display-only end time (Calendly-style range); real end not stored on demo row */
const DEMO_DISPLAY_DURATION_MIN = 10;

type DemoGroup = { sortKey: string; label: string; demos: Demo[] };

function groupDemosByLocalDay(demos: Demo[], period: Period): DemoGroup[] {
  const byKey = new Map<string, Demo[]>();
  for (const d of demos) {
    const tz = d.timezone?.trim() || 'UTC';
    const dayKey = formatInTimeZone(parseISO(d.scheduled_at), tz, 'yyyy-MM-dd');
    const list = byKey.get(dayKey) ?? [];
    list.push(d);
    byKey.set(dayKey, list);
  }
  const keys = Array.from(byKey.keys()).sort((a, b) =>
    period === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a)
  );
  return keys.map((sortKey) => {
    const groupList = byKey.get(sortKey)!;
    const tz0 = groupList[0].timezone?.trim() || 'UTC';
    const label = formatInTimeZone(parseISO(groupList[0].scheduled_at), tz0, 'EEEE, d MMMM yyyy', {
      locale: enUS,
    });
    groupList.sort((x, y) =>
      period === 'upcoming'
        ? parseISO(x.scheduled_at).getTime() - parseISO(y.scheduled_at).getTime()
        : parseISO(y.scheduled_at).getTime() - parseISO(x.scheduled_at).getTime()
    );
    return { sortKey, label, demos: groupList };
  });
}

function pqadDotColor(verdict: PqadVerdict | undefined): string {
  switch (verdict) {
    case 'yes':
      return '#30d158';
    case 'no':
      return '#ff6b6b';
    case 'no_show':
      return '#ff9f0a';
    default:
      return '#636366';
  }
}

function pqadLabel(verdict: PqadVerdict | undefined): string {
  if (verdict === 'no_show') return 'No-show';
  return verdict ?? 'pending';
}

function notesPreview(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const oneLine = t.replace(/\s+/g, ' ');
  return oneLine.length > 48 ? `${oneLine.slice(0, 48)}…` : oneLine;
}

function dataPreview(
  proposals: number | null | undefined,
  dealSize: number | null | undefined,
  closeRate: number | null | undefined
): string {
  if (proposals == null && dealSize == null && closeRate == null) return '';
  const parts: string[] = [];
  if (proposals != null) parts.push(`${proposals}/mo`);
  if (dealSize != null) parts.push(`$${dealSize.toLocaleString('en-US')}`);
  if (closeRate != null) parts.push(`${closeRate}%`);
  const line = parts.join(' · ');
  return line.length > 48 ? `${line.slice(0, 48)}…` : line;
}

function formatDemoTimeRange(d: Demo): string {
  const tz = d.timezone?.trim() || 'UTC';
  const start = parseISO(d.scheduled_at);
  const end = addMinutes(start, DEMO_DISPLAY_DURATION_MIN);
  return `${formatInTimeZone(start, tz, 'HH:mm')} – ${formatInTimeZone(end, tz, 'HH:mm')}`;
}

const THEAD_ROW_HEIGHT = 44;
const cell: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid #2a2a2e',
  fontSize: 13,
  verticalAlign: 'top',
};

export default function OrganizerDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>(() =>
    pathname?.startsWith('/organizer/analytics') ? 'analytics' : 'booked'
  );
  const [period, setPeriod] = useState<Period>('upcoming');
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesModalDemoId, setNotesModalDemoId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [dataModalDemoId, setDataModalDemoId] = useState<string | null>(null);
  const [dataDraft, setDataDraft] = useState({
    proposals_per_month: '',
    avg_deal_size: '',
    close_rate: '',
  });
  const [dataSaving, setDataSaving] = useState(false);
  const [linksModalDemoId, setLinksModalDemoId] = useState<string | null>(null);
  const [linksDraft, setLinksDraft] = useState({ assessment_link: '', private_workspace_link: '' });
  const [linksSaving, setLinksSaving] = useState(false);
  const [rowState, setRowState] = useState<
    Record<
      string,
      {
        organizer_booked_by: string;
        organizer_personal_notes: string;
        proposals_per_month: string;
        avg_deal_size: string;
        close_rate: string;
        pqad_verdict: PqadVerdict;
        pqad_rejection_reason: string;
        sdr_payout_cents: string;
        assessment_link: string;
        private_workspace_link: string;
        pipeline_stage: PipelineStage;
        is_rescue: boolean;
        saving: boolean;
      }
    >
  >({});
  const [staleCount, setStaleCount] = useState(0);

  const demoGroups = useMemo(() => groupDemosByLocalDay(demos, period), [demos, period]);

  const load = useCallback(async () => {
    if (tab === 'analytics') {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fetchView =
        tab === 'pipeline' ? 'booked' : tab === 'rescue' ? 'rescue' : tab;
      const fetchPeriod = tab === 'pipeline' || tab === 'rescue' ? 'past' : period;
      const res = await fetch(
        `/api/organizer/demos?view=${fetchView}&period=${fetchPeriod}`,
        { credentials: 'include' }
      );
      if (res.status === 401) {
        router.replace('/organizer/login');
        return;
      }
      if (!res.ok) {
        setError('Failed to load demos');
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { demos: Demo[] };
      setDemos(data.demos);
      const next: typeof rowState = {};
      for (const d of data.demos) {
        next[d.id] = {
          organizer_booked_by: d.organizer_booked_by ?? '',
          organizer_personal_notes: d.organizer_personal_notes ?? '',
          proposals_per_month:
            d.proposals_per_month != null ? String(d.proposals_per_month) : '',
          avg_deal_size: d.avg_deal_size != null ? String(d.avg_deal_size) : '',
          close_rate: d.close_rate != null ? String(d.close_rate) : '',
          pqad_verdict: d.pqad_verdict ?? 'pending',
          pqad_rejection_reason: d.pqad_rejection_reason ?? '',
          sdr_payout_cents: d.sdr_payout_cents != null ? String(d.sdr_payout_cents) : '',
          assessment_link: d.assessment_link ?? '',
          private_workspace_link: d.private_workspace_link ?? '',
          pipeline_stage: d.pipeline_stage ?? 'demo_done',
          is_rescue: d.is_rescue ?? false,
          saving: false,
        };
      }
      setRowState(next);
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }, [tab, period, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pathname?.startsWith('/organizer/analytics')) setTab('analytics');
  }, [pathname]);

  const refreshStale = useCallback(async () => {
    try {
      const res = await fetch('/api/organizer/stale', { credentials: 'include' });
      if (!res.ok) return;
      const payload = (await res.json()) as { count?: number };
      setStaleCount(payload.count ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshStale();
    const t = setInterval(() => void refreshStale(), 30_000);
    return () => clearInterval(t);
  }, [refreshStale]);

  async function logout() {
    await fetch('/api/organizer/session', { method: 'DELETE', credentials: 'include' });
    router.replace('/organizer/login');
    router.refresh();
  }

  async function saveRow(demo: Demo) {
    const st = rowState[demo.id];
    if (!st || demo.pqad_locked) return;
    setRowState((s) => ({ ...s, [demo.id]: { ...st, saving: true } }));
    setError(null);

    const pay =
      st.sdr_payout_cents.trim() === '' ? null : parseInt(st.sdr_payout_cents, 10);

    if (pay !== null && (Number.isNaN(pay) || pay < 0)) {
      setError('Pay must be a non-negative integer (cents)');
      setRowState((s) => ({ ...s, [demo.id]: { ...st, saving: false } }));
      return;
    }

    const body: Record<string, unknown> = {
      organizer_booked_by: st.organizer_booked_by,
      pqad_verdict: st.pqad_verdict,
      pqad_rejection_reason:
        st.pqad_verdict === 'no' ? st.pqad_rejection_reason : null,
    };
    if (st.pqad_verdict === 'yes' || st.pqad_verdict === 'pending') {
      if (pay !== null) body.sdr_payout_cents = pay;
      if (st.pqad_verdict === 'pending' && st.sdr_payout_cents.trim() === '') {
        body.sdr_payout_cents = null;
      }
    }

    try {
      const res = await fetch(`/api/organizer/demos/${demo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError((payload as { error?: string }).error ?? 'Row locked');
      } else if (!res.ok) {
        setError((payload as { error?: string }).error ?? 'Save failed');
      } else {
        await load();
        return;
      }
    } catch {
      setError('Save failed');
    }
    setRowState((s) => ({
      ...s,
      [demo.id]: { ...st, saving: false },
    }));
  }

  function updateRow(
    id: string,
    field: keyof Omit<(typeof rowState)[string], 'saving'>,
    value: string | PqadVerdict | PipelineStage
  ) {
    setRowState((s) => {
      const cur = s[id];
      if (!cur) return s;
      return { ...s, [id]: { ...cur, [field]: value } };
    });
  }

  async function savePipelineStage(demoId: string, stage: PipelineStage) {
    setRowState((s) => {
      const cur = s[demoId];
      if (!cur) return s;
      return { ...s, [demoId]: { ...cur, pipeline_stage: stage } };
    });
    try {
      const res = await fetch(`/api/organizer/demos/${demoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pipeline_stage: stage }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError((payload as { error?: string }).error ?? 'Failed to save stage');
      }
    } catch {
      setError('Failed to save stage');
    }
  }

  async function saveRescue(demoId: string, isRescue: boolean) {
    setRowState((s) => {
      const cur = s[demoId];
      if (!cur) return s;
      return { ...s, [demoId]: { ...cur, is_rescue: isRescue } };
    });
    setDemos((list) =>
      list.map((d) => (d.id === demoId ? { ...d, is_rescue: isRescue } : d))
    );
    try {
      const res = await fetch(`/api/organizer/demos/${demoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_rescue: isRescue }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError((payload as { error?: string }).error ?? 'Failed to save rescue flag');
        return;
      }
      if (tab === 'rescue' && !isRescue) {
        setDemos((list) => list.filter((d) => d.id !== demoId));
      }
    } catch {
      setError('Failed to save rescue flag');
    }
  }

  async function saveAttendance(demoId: string, attendance: 'showed' | 'no_show'): Promise<boolean> {
    setError(null);
    try {
      const res = await fetch(`/api/organizer/demos/${demoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ attendance }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((payload as { error?: string }).error ?? 'Failed to save attendance');
        return false;
      }
      const updated = (payload as { demo?: Demo }).demo;
      if (updated) {
        setDemos((list) => list.map((d) => (d.id === demoId ? { ...d, ...updated } : d)));
      } else if (tab !== 'analytics') {
        await load();
      }
      await refreshStale();
      return true;
    } catch {
      setError('Failed to save attendance');
      return false;
    }
  }

  const linksModalDemo = linksModalDemoId
    ? demos.find((d) => d.id === linksModalDemoId)
    : null;

  function openLinksModal(demo: Demo) {
    const st = rowState[demo.id];
    setLinksModalDemoId(demo.id);
    setLinksDraft({
      assessment_link: st?.assessment_link ?? demo.assessment_link ?? '',
      private_workspace_link: st?.private_workspace_link ?? demo.private_workspace_link ?? '',
    });
    setError(null);
  }

  function closeLinksModal() {
    setLinksModalDemoId(null);
    setLinksDraft({ assessment_link: '', private_workspace_link: '' });
    setLinksSaving(false);
  }

  async function saveLinks() {
    if (!linksModalDemoId) return;
    setLinksSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        assessment_link: linksDraft.assessment_link.trim() || null,
        private_workspace_link: linksDraft.private_workspace_link.trim() || null,
      };
      const res = await fetch(`/api/organizer/demos/${linksModalDemoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((payload as { error?: string }).error ?? 'Failed to save links');
        setLinksSaving(false);
        return;
      }
      const aLink = linksDraft.assessment_link.trim();
      const wLink = linksDraft.private_workspace_link.trim();
      setRowState((s) => {
        const cur = s[linksModalDemoId];
        if (!cur) return s;
        return {
          ...s,
          [linksModalDemoId]: {
            ...cur,
            assessment_link: aLink,
            private_workspace_link: wLink,
          },
        };
      });
      setDemos((list) =>
        list.map((d) =>
          d.id === linksModalDemoId
            ? { ...d, assessment_link: aLink || null, private_workspace_link: wLink || null }
            : d
        )
      );
      closeLinksModal();
    } catch {
      setError('Failed to save links');
      setLinksSaving(false);
    }
  }

  function linksPreview(st: (typeof rowState)[string] | undefined): string {
    if (!st) return '';
    const parts: string[] = [];
    if (st.assessment_link.trim()) parts.push('Assessment');
    if (st.private_workspace_link.trim()) parts.push('Workspace');
    return parts.join(' · ');
  }

  const pipelineGroups = useMemo(() => {
    if (tab !== 'pipeline') return [];
    const rescueDemos: Demo[] = [];
    const map = new Map<PipelineStage, Demo[]>();
    for (const s of PIPELINE_STAGES) map.set(s.value, []);
    for (const d of demos) {
      const isRescue = rowState[d.id]?.is_rescue ?? d.is_rescue ?? false;
      if (isRescue) {
        rescueDemos.push(d);
        continue;
      }
      const stage = rowState[d.id]?.pipeline_stage ?? d.pipeline_stage ?? 'demo_done';
      const list = map.get(stage) ?? [];
      list.push(d);
      map.set(stage, list);
    }
    const withTotals = (stageDemos: Demo[]) => {
      const totalValue = stageDemos.reduce((sum, d) => {
        const rawSize = rowState[d.id]?.avg_deal_size;
        const size = rawSize ? parseInt(rawSize, 10) : (d.avg_deal_size ?? 0);
        return sum + (Number.isNaN(size) ? 0 : size);
      }, 0);
      return { demos: stageDemos, totalValue };
    };
    const rescue = withTotals(rescueDemos);
    const stages = PIPELINE_STAGES.map((s) => {
      const stageDemos = map.get(s.value) ?? [];
      return { ...s, ...withTotals(stageDemos) };
    });
    return [
      { value: 'rescue' as const, label: 'Rescue', color: RESCUE_COLOR, ...rescue },
      ...stages,
    ];
  }, [tab, demos, rowState]);

  const notesModalDemo = notesModalDemoId
    ? demos.find((d) => d.id === notesModalDemoId)
    : null;

  function openNotesModal(demo: Demo) {
    const st = rowState[demo.id];
    setNotesModalDemoId(demo.id);
    setNotesDraft(st?.organizer_personal_notes ?? demo.organizer_personal_notes ?? '');
    setError(null);
  }

  function closeNotesModal() {
    setNotesModalDemoId(null);
    setNotesDraft('');
    setNotesSaving(false);
  }

  async function saveNotes() {
    if (!notesModalDemoId) return;
    setNotesSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizer/demos/${notesModalDemoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ organizer_personal_notes: notesDraft }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((payload as { error?: string }).error ?? 'Failed to save notes');
        setNotesSaving(false);
        return;
      }
      setRowState((s) => {
        const cur = s[notesModalDemoId];
        if (!cur) return s;
        return {
          ...s,
          [notesModalDemoId]: { ...cur, organizer_personal_notes: notesDraft },
        };
      });
      setDemos((list) =>
        list.map((d) =>
          d.id === notesModalDemoId ? { ...d, organizer_personal_notes: notesDraft } : d
        )
      );
      closeNotesModal();
    } catch {
      setError('Failed to save notes');
      setNotesSaving(false);
    }
  }

  const dataModalDemo = dataModalDemoId ? demos.find((d) => d.id === dataModalDemoId) : null;

  function openDataModal(demo: Demo) {
    const st = rowState[demo.id];
    setDataModalDemoId(demo.id);
    setDataDraft({
      proposals_per_month:
        st?.proposals_per_month ??
        (demo.proposals_per_month != null ? String(demo.proposals_per_month) : ''),
      avg_deal_size:
        st?.avg_deal_size ?? (demo.avg_deal_size != null ? String(demo.avg_deal_size) : ''),
      close_rate: st?.close_rate ?? (demo.close_rate != null ? String(demo.close_rate) : ''),
    });
    setError(null);
  }

  function closeDataModal() {
    setDataModalDemoId(null);
    setDataDraft({ proposals_per_month: '', avg_deal_size: '', close_rate: '' });
    setDataSaving(false);
  }

  async function saveData() {
    if (!dataModalDemoId) return;

    const proposals = parseInt(dataDraft.proposals_per_month.trim(), 10);
    const dealSize = parseInt(dataDraft.avg_deal_size.trim(), 10);
    const closeRate = parseFloat(dataDraft.close_rate.trim());

    if (
      Number.isNaN(proposals) ||
      proposals < 1 ||
      Number.isNaN(dealSize) ||
      dealSize < 1 ||
      Number.isNaN(closeRate) ||
      closeRate < 0 ||
      closeRate > 100
    ) {
      setError('All three fields are required: proposals/mo ≥ 1, deal size ≥ $1, close rate 0–100%');
      return;
    }

    setDataSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizer/demos/${dataModalDemoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prospect_data: {
            proposals_per_month: proposals,
            avg_deal_size: dealSize,
            close_rate: closeRate,
          },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((payload as { error?: string }).error ?? 'Failed to save data');
        setDataSaving(false);
        return;
      }

      const proposalsStr = String(proposals);
      const dealSizeStr = String(dealSize);
      const closeRateStr = String(closeRate);

      setRowState((s) => {
        const cur = s[dataModalDemoId];
        if (!cur) return s;
        return {
          ...s,
          [dataModalDemoId]: {
            ...cur,
            proposals_per_month: proposalsStr,
            avg_deal_size: dealSizeStr,
            close_rate: closeRateStr,
          },
        };
      });
      setDemos((list) =>
        list.map((d) =>
          d.id === dataModalDemoId
            ? {
                ...d,
                proposals_per_month: proposals,
                avg_deal_size: dealSize,
                close_rate: closeRate,
              }
            : d
        )
      );
      closeDataModal();
    } catch {
      setError('Failed to save data');
      setDataSaving(false);
    }
  }

  function rowDataPreview(st: (typeof rowState)[string] | undefined): string {
    if (!st) return '';
    const proposals = st.proposals_per_month.trim();
    const dealSize = st.avg_deal_size.trim();
    const closeRate = st.close_rate.trim();
    if (!proposals && !dealSize && !closeRate) return '';
    return dataPreview(
      proposals ? parseInt(proposals, 10) : null,
      dealSize ? parseInt(dealSize, 10) : null,
      closeRate ? parseFloat(closeRate) : null
    );
  }

  function hasRowData(st: (typeof rowState)[string] | undefined): boolean {
    if (!st) return false;
    return Boolean(
      st.proposals_per_month.trim() || st.avg_deal_size.trim() || st.close_rate.trim()
    );
  }

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#0a0a0b',
        color: '#e8e8ea',
        minHeight: '100vh',
      }}
    >
      <header
        style={{
          background: '#121214',
          borderBottom: '1px solid #2a2a2e',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Demo organizer</span>
            <nav style={{ display: 'flex', gap: 8 }}>
              {(
                [
                  { value: 'booked',   label: 'All demos',   title: 'Every Calendly demo — you set PQAD manually on each row' },
                  { value: 'analytics', label: 'Analytics',  title: 'Show rate, confirmation, horizon, unresolved past demos' },
                  { value: 'pqad',     label: 'PQAD = yes',  title: 'Same rows, filtered to PQAD yes only (for payouts)' },
                  { value: 'rescue',   label: 'Rescue',      title: 'Past demos flagged for rescue / win-back' },
                  { value: 'pipeline', label: 'Pipeline',     title: 'Past demos grouped by pipeline stage — track your deals' },
                ] as const
              ).map((t) => (
                <button
                  key={t.value}
                  type="button"
                  title={t.title}
                  onClick={() => {
                    if (t.value === 'analytics') {
                      router.push('/organizer/analytics');
                      setTab('analytics');
                    } else {
                      if (pathname?.startsWith('/organizer/analytics')) {
                        router.push('/organizer');
                      }
                      setTab(t.value);
                    }
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background:
                      tab === t.value
                        ? t.value === 'pipeline'
                          ? '#bf5af2'
                          : t.value === 'rescue'
                            ? RESCUE_COLOR
                            : t.value === 'analytics'
                              ? '#30d158'
                              : '#0a84ff'
                        : '#2a2a2e',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  {t.label}
                  {t.value === 'analytics' && staleCount > 0 ? (
                    <span
                      style={{
                        marginLeft: 8,
                        background: '#ff453a',
                        color: '#fff',
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                      }}
                    >
                      {staleCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #3a3a40',
              background: 'transparent',
              color: '#8e8e93',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
        {tab !== 'pipeline' && tab !== 'rescue' && tab !== 'analytics' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px 14px',
              borderTop: '1px solid #1c1c1f',
            }}
          >
            <span style={{ fontSize: 11, color: '#636366', marginRight: 4, textTransform: 'uppercase' }}>
              By date
            </span>
            {(['upcoming', 'past'] as const).map((p) => (
              <button
                key={p}
                type="button"
                title={
                  p === 'upcoming'
                    ? 'scheduled_at ≥ now — next meetings first (Calendly-style)'
                    : 'scheduled_at before now — newest past first'
                }
                onClick={() => setPeriod(p)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: period === p ? '#3a3a40' : '#1c1c1f',
                  color: period === p ? '#fff' : '#8e8e93',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {p === 'upcoming' ? 'Upcoming' : 'Past demos'}
              </button>
            ))}
          </div>
        )}
        {tab === 'pipeline' && (
          <div style={{ padding: '10px 24px 14px', borderTop: '1px solid #1c1c1f' }}>
            <span style={{ fontSize: 12, color: '#636366' }}>
              Past demos — update stage to track deal progression. Flag deals as{' '}
              <strong style={{ color: RESCUE_COLOR }}>Rescue</strong> to pull them into the rescue column.
            </span>
          </div>
        )}
        {tab === 'analytics' && (
          <div style={{ padding: '10px 24px 14px', borderTop: '1px solid #1c1c1f' }}>
            <span style={{ fontSize: 12, color: '#636366' }}>
              Meeting-time cohort. Show rate = attended / kept. Auto-NO_SHOW at T+12m. Canary at T+15m.
            </span>
          </div>
        )}
        {staleCount > 0 && (
          <div
            style={{
              padding: '10px 24px',
              background: '#3a1210',
              borderTop: '1px solid #ff453a',
              color: '#ff6b6b',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {staleCount} demo{staleCount === 1 ? '' : 's'} still PENDING/CONFIRMED more than 15 minutes
            after start. Auto-NO_SHOW missed them — open Analytics and mark Joined or No-Show. This
            banner stays until the count is 0.
          </div>
        )}
      </header>

      <main style={{ padding: 24 }}>
        {tab !== 'pipeline' && tab !== 'rescue' && tab !== 'analytics' && (
          <p style={{ fontSize: 13, color: '#8e8e93', marginBottom: 16, maxWidth: 820 }}>
            Every booking shows on <strong style={{ color: '#c7c7cc' }}>All demos</strong>. You manually
            set <strong style={{ color: '#c7c7cc' }}>PQAD</strong> (pending → yes or no) per row—nothing
            is guessed. <strong style={{ color: '#c7c7cc' }}>Joined / No-Show</strong> appear from 5 minutes
            before the slot through 30 minutes after. Organizer click wins over auto-NO_SHOW.{' '}
            <strong style={{ color: '#c7c7cc' }}>PQAD = yes</strong> is the same records, filtered to
            qualified demos for payout review. Who booked, verdict, and money live on that row; lock
            kills argument after you save. Toggle <strong style={{ color: RESCUE_COLOR }}>Rescue</strong>{' '}
            on any past demo to add it to the rescue list and pipeline column.{' '}
            <strong style={{ color: '#c7c7cc' }}>Upcoming</strong>{' '}
            / <strong style={{ color: '#c7c7cc' }}>Past demos</strong> use server time; below, rows are{' '}
            <strong style={{ color: '#c7c7cc' }}>grouped by calendar day</strong> in each invitee&apos;s
            timezone (Calendly-style).
          </p>
        )}
        {tab === 'pipeline' && (
          <p style={{ fontSize: 13, color: '#8e8e93', marginBottom: 16, maxWidth: 820 }}>
            Track where every deal stands after the demo. The <strong style={{ color: RESCUE_COLOR }}>Rescue</strong>{' '}
            column collects flagged deals that need win-back. Stage and links are always editable regardless
            of PQAD lock. Move a prospect forward by updating their{' '}
            <strong style={{ color: '#c7c7cc' }}>Stage</strong>, paste in their{' '}
            <strong style={{ color: '#c7c7cc' }}>Assessment</strong> and{' '}
            <strong style={{ color: '#c7c7cc' }}>Workspace</strong> links, and watch your pipeline
            compound over time.
          </p>
        )}
        {tab === 'rescue' && (
          <p style={{ fontSize: 13, color: '#8e8e93', marginBottom: 16, maxWidth: 820 }}>
            Every demo you flag as <strong style={{ color: RESCUE_COLOR }}>Rescue</strong> lands here
            and in the first column on the <strong style={{ color: '#c7c7cc' }}>Pipeline</strong> tab.
            Uncheck rescue when the deal is recovered or no longer needs attention.
          </p>
        )}
        {error ? (
          <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</p>
        ) : null}
        {tab === 'analytics' ? (
          <AnalyticsPanel onMarkAttendance={saveAttendance} />
        ) : loading ? (
          <p style={{ color: '#8e8e93' }}>Loading…</p>
        ) : tab === 'pipeline' ? (
          /* ── Pipeline kanban ── */
          demos.length === 0 ? (
            <p style={{ color: '#8e8e93', marginTop: 16 }}>No past demos in this view.</p>
          ) : (
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
              {pipelineGroups.map((stage) => (
                <div
                  key={stage.value}
                  style={{
                    flex: '0 0 260px',
                    background: '#121214',
                    border: '1px solid #2a2a2e',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  {/* Stage column header */}
                  <div
                    style={{
                      padding: '12px 14px 10px',
                      borderBottom: '1px solid #2a2a2e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: stage.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 700, fontSize: 13, color: '#e8e8ea' }}>
                        {stage.label}
                      </span>
                      <span
                        style={{
                          background: '#2a2a2e',
                          borderRadius: 6,
                          padding: '2px 7px',
                          fontSize: 11,
                          color: '#8e8e93',
                          fontWeight: 600,
                        }}
                      >
                        {stage.demos.length}
                      </span>
                    </div>
                    {stage.totalValue > 0 && (
                      <span style={{ fontSize: 11, color: '#636366' }}>
                        ${stage.totalValue.toLocaleString('en-US')}
                      </span>
                    )}
                  </div>
                  {/* Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {stage.demos.length === 0 ? (
                      <div style={{ padding: '16px 14px', color: '#48484a', fontSize: 12, textAlign: 'center' }}>
                        No deals here
                      </div>
                    ) : (
                      stage.demos.map((d, idx) => {
                        const st = rowState[d.id];
                        const dealSize = st?.avg_deal_size
                          ? parseInt(st.avg_deal_size, 10)
                          : (d.avg_deal_size ?? null);
                        const hasAssessment = (st?.assessment_link ?? '').trim().length > 0;
                        const hasWorkspace = (st?.private_workspace_link ?? '').trim().length > 0;
                        const verdictColor = pqadDotColor(
                          (d.pqad_locked ? d.pqad_verdict : st?.pqad_verdict) ?? 'pending'
                        );
                        const verdictLabel = pqadLabel(
                          (d.pqad_locked ? d.pqad_verdict : st?.pqad_verdict) ?? 'pending'
                        );
                        return (
                          <div
                            key={d.id}
                            style={{
                              padding: '12px 14px',
                              borderTop: idx === 0 ? 'none' : '1px solid #1c1c1f',
                            }}
                          >
                            {/* Name + PQAD dot */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                              <span
                                title={`PQAD: ${verdictLabel}`}
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: verdictColor,
                                  flexShrink: 0,
                                  marginTop: 4,
                                }}
                              />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#e8e8ea', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {d.name}
                                </div>
                                <div style={{ fontSize: 11, color: '#636366', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {d.email}
                                </div>
                              </div>
                            </div>
                            {/* Meta row: date + deal size */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: '#48484a' }}>
                                {formatInTimeZone(parseISO(d.scheduled_at), d.timezone?.trim() || 'UTC', 'd MMM yyyy')}
                              </span>
                              {dealSize != null && !Number.isNaN(dealSize) && dealSize > 0 && (
                                <span style={{ fontSize: 11, color: '#ff9f0a', fontWeight: 600 }}>
                                  ${dealSize.toLocaleString('en-US')}
                                </span>
                              )}
                            </div>
                            {/* Link pills */}
                            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                              {hasAssessment && (
                                <a
                                  href={st!.assessment_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: 11,
                                    color: '#0a84ff',
                                    background: 'rgba(10,132,255,0.12)',
                                    borderRadius: 5,
                                    padding: '3px 8px',
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                  }}
                                >
                                  Assessment ↗
                                </a>
                              )}
                              {hasWorkspace && (
                                <a
                                  href={st!.private_workspace_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: 11,
                                    color: '#bf5af2',
                                    background: 'rgba(191,90,242,0.12)',
                                    borderRadius: 5,
                                    padding: '3px 8px',
                                    textDecoration: 'none',
                                    fontWeight: 600,
                                  }}
                                >
                                  Workspace ↗
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => openLinksModal(d)}
                                style={{
                                  fontSize: 11,
                                  color: '#636366',
                                  background: '#1c1c1f',
                                  border: '1px solid #2a2a2e',
                                  borderRadius: 5,
                                  padding: '3px 8px',
                                  cursor: 'pointer',
                                }}
                              >
                                {hasAssessment || hasWorkspace ? 'Edit links' : 'Add links'}
                              </button>
                            </div>
                            {/* Rescue toggle */}
                            <label
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 8,
                                fontSize: 12,
                                color: (st?.is_rescue ?? false) ? RESCUE_COLOR : '#636366',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={st?.is_rescue ?? false}
                                onChange={(e) => void saveRescue(d.id, e.target.checked)}
                                style={{ accentColor: RESCUE_COLOR, cursor: 'pointer' }}
                              />
                              Rescue
                            </label>
                            {/* Stage select */}
                            <select
                              value={st?.pipeline_stage ?? 'demo_done'}
                              onChange={(e) =>
                                void savePipelineStage(d.id, e.target.value as PipelineStage)
                              }
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: `1px solid ${PIPELINE_STAGES.find(s => s.value === (st?.pipeline_stage ?? 'demo_done'))?.color ?? '#3a3a40'}`,
                                background: '#0a0a0b',
                                color: PIPELINE_STAGES.find(s => s.value === (st?.pipeline_stage ?? 'demo_done'))?.color ?? '#e8e8ea',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {PIPELINE_STAGES.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #2a2a2e' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                minWidth: 1340,
                background: '#0a0a0b',
              }}
            >
              <thead
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  background: '#141416',
                  boxShadow: '0 1px 0 #2a2a2e',
                }}
              >
                <tr style={{ textAlign: 'left', color: '#8e8e93', fontSize: 12 }}>
                  <th style={{ ...cell, paddingTop: 14 }}>When</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Invitee</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Status</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Attendance</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Booked by</th>
                  <th style={{ ...cell, paddingTop: 14 }}>PQAD</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Pay</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Reason (if no)</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Data</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Links</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Rescue</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Stage</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Notes</th>
                  <th style={{ ...cell, paddingTop: 14 }} />
                </tr>
              </thead>
              <tbody>
                {demoGroups.map((group) => (
                  <Fragment key={group.sortKey}>
                    <tr>
                      <td
                        colSpan={14}
                        style={{
                          padding: 0,
                          border: 'none',
                          background: '#0a0a0b',
                        }}
                      >
                        <div
                          style={{
                            position: 'sticky',
                            top: THEAD_ROW_HEIGHT,
                            zIndex: 15,
                            padding: '14px 14px 10px',
                            marginTop: 8,
                            borderTop: '1px solid #2f2f33',
                            background: '#0f0f12',
                            color: '#a1a1a6',
                            fontSize: 14,
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {group.label}
                        </div>
                      </td>
                    </tr>
                    {group.demos.map((d) => {
                      const st = rowState[d.id];
                      const locked = d.pqad_locked === true;
                      const verdictShown = locked ? d.pqad_verdict : st?.pqad_verdict;
                      return (
                        <tr key={d.id} style={{ background: '#0a0a0b' }}>
                          <td style={cell}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <span
                                title={`PQAD: ${pqadLabel(verdictShown)}`}
                                style={{
                                  width: 9,
                                  height: 9,
                                  borderRadius: '50%',
                                  background: pqadDotColor(verdictShown),
                                  flexShrink: 0,
                                  marginTop: 5,
                                  boxShadow: '0 0 0 2px rgba(255,255,255,0.06)',
                                }}
                              />
                              <div>
                                <div style={{ fontWeight: 600, color: '#e8e8ea', fontSize: 13 }}>
                                  {formatDemoTimeRange(d)}
                                </div>
                                <div style={{ fontSize: 11, color: '#636366', marginTop: 4 }}>
                                  {d.timezone?.replace(/_/g, ' ') || 'UTC'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={cell}>
                            <div style={{ fontWeight: 700, color: '#e8e8ea', fontSize: 14 }}>
                              {d.name}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: '#8e8e93',
                                marginTop: 4,
                                wordBreak: 'break-all',
                              }}
                            >
                              {d.email}
                            </div>
                          </td>
                          <td style={cell}>
                            <span
                              style={{
                                fontSize: 12,
                                color: isUnresolvedPast(d, Date.now()) ? '#ff9f0a' : '#c7c7cc',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td style={cell}>
                            <AttendanceCell
                              demo={d}
                              onMark={(attendance) => void saveAttendance(d.id, attendance)}
                            />
                          </td>
                          <td style={cell}>
                            {locked ? (
                              st?.organizer_booked_by || '—'
                            ) : (
                              <input
                                value={st?.organizer_booked_by ?? ''}
                                onChange={(e) =>
                                  updateRow(d.id, 'organizer_booked_by', e.target.value)
                                }
                                style={inputStyle}
                              />
                            )}
                          </td>
                          <td style={cell}>
                            {locked ? (
                              pqadLabel(d.pqad_verdict)
                            ) : (
                              <select
                                value={st?.pqad_verdict ?? 'pending'}
                                onChange={(e) =>
                                  updateRow(d.id, 'pqad_verdict', e.target.value as PqadVerdict)
                                }
                                style={{ ...inputStyle, cursor: 'pointer' }}
                              >
                                <option value="pending">pending</option>
                                <option value="yes">yes</option>
                                <option value="no">no</option>
                                <option value="no_show">No-show</option>
                              </select>
                            )}
                          </td>
                          <td style={cell}>
                            {locked ? (
                              d.sdr_payout_cents ?? '—'
                            ) : (
                              <input
                                value={st?.sdr_payout_cents ?? ''}
                                onChange={(e) => updateRow(d.id, 'sdr_payout_cents', e.target.value)}
                                placeholder="cents"
                                disabled={
                                  st?.pqad_verdict === 'no' || st?.pqad_verdict === 'no_show'
                                }
                                style={{
                                  ...inputStyle,
                                  opacity:
                                    st?.pqad_verdict === 'no' || st?.pqad_verdict === 'no_show'
                                      ? 0.5
                                      : 1,
                                }}
                              />
                            )}
                          </td>
                          <td style={{ ...cell, maxWidth: 220 }}>
                            {locked ? (
                              d.pqad_rejection_reason || '—'
                            ) : (
                              <input
                                value={st?.pqad_rejection_reason ?? ''}
                                onChange={(e) =>
                                  updateRow(d.id, 'pqad_rejection_reason', e.target.value)
                                }
                                disabled={st?.pqad_verdict !== 'no'}
                                style={{
                                  ...inputStyle,
                                  opacity: st?.pqad_verdict === 'no' ? 1 : 0.5,
                                }}
                              />
                            )}
                          </td>
                          <td style={{ ...cell, minWidth: 120, maxWidth: 200 }}>
                            <button
                              type="button"
                              onClick={() => openDataModal(d)}
                              title="Proposals/mo, avg deal size, close rate"
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: '1px solid #3a3a40',
                                background: '#141416',
                                color: hasRowData(st) ? '#e8e8ea' : '#636366',
                                fontSize: 12,
                                cursor: 'pointer',
                                lineHeight: 1.4,
                              }}
                            >
                              {hasRowData(st) ? rowDataPreview(st) : 'Add data…'}
                            </button>
                          </td>
                          {/* Links cell — assessment + workspace, always editable */}
                          <td style={{ ...cell, minWidth: 110, maxWidth: 180 }}>
                            <button
                              type="button"
                              onClick={() => openLinksModal(d)}
                              title="Assessment link and private workspace link"
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: '1px solid #3a3a40',
                                background: '#141416',
                                color: linksPreview(st) ? '#e8e8ea' : '#636366',
                                fontSize: 12,
                                cursor: 'pointer',
                                lineHeight: 1.4,
                              }}
                            >
                              {linksPreview(st) || 'Add links…'}
                            </button>
                          </td>
                          {/* Rescue cell — always editable, auto-saves */}
                          <td style={{ ...cell, minWidth: 72, textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              title="Flag for rescue / win-back"
                              checked={st?.is_rescue ?? false}
                              onChange={(e) => void saveRescue(d.id, e.target.checked)}
                              style={{ accentColor: RESCUE_COLOR, cursor: 'pointer', width: 16, height: 16 }}
                            />
                          </td>
                          {/* Stage cell — always editable, auto-saves */}
                          <td style={{ ...cell, minWidth: 140 }}>
                            <select
                              value={st?.pipeline_stage ?? 'demo_done'}
                              onChange={(e) =>
                                void savePipelineStage(d.id, e.target.value as PipelineStage)
                              }
                              style={{
                                width: '100%',
                                maxWidth: 160,
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: `1px solid ${PIPELINE_STAGES.find((s) => s.value === (st?.pipeline_stage ?? 'demo_done'))?.color ?? '#3a3a40'}`,
                                background: '#0a0a0b',
                                color: PIPELINE_STAGES.find((s) => s.value === (st?.pipeline_stage ?? 'demo_done'))?.color ?? '#e8e8ea',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {PIPELINE_STAGES.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ ...cell, minWidth: 120, maxWidth: 200 }}>
                            <button
                              type="button"
                              onClick={() => openNotesModal(d)}
                              title="Open personal notes"
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: '1px solid #3a3a40',
                                background: '#141416',
                                color: (st?.organizer_personal_notes ?? '').trim()
                                  ? '#e8e8ea'
                                  : '#636366',
                                fontSize: 12,
                                cursor: 'pointer',
                                lineHeight: 1.4,
                              }}
                            >
                              {(st?.organizer_personal_notes ?? '').trim()
                                ? notesPreview(st.organizer_personal_notes)
                                : 'Add notes…'}
                            </button>
                          </td>
                          <td style={cell}>
                            {locked ? (
                              <span style={{ fontSize: 12, color: '#636366' }}>locked</span>
                            ) : (
                              <button
                                type="button"
                                disabled={st?.saving}
                                onClick={() => void saveRow(d)}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: 6,
                                  border: 'none',
                                  background: '#30d158',
                                  color: '#0a0a0b',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: st?.saving ? 'wait' : 'pointer',
                                }}
                              >
                                {st?.saving ? '…' : 'Save'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {demos.length === 0 ? (
              <p style={{ color: '#8e8e93', marginTop: 16, padding: 16 }}>No rows in this view.</p>
            ) : null}
          </div>
        )}
      </main>

      {notesModalDemo ? (
        <div
          role="presentation"
          onClick={() => closeNotesModal()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notes-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 640,
              maxHeight: 'min(85vh, 720px)',
              display: 'flex',
              flexDirection: 'column',
              background: '#141416',
              border: '1px solid #3a3a40',
              borderRadius: 14,
              boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
            }}
          >
            <div
              style={{
                padding: '18px 20px 12px',
                borderBottom: '1px solid #2a2a2e',
              }}
            >
              <h2
                id="notes-modal-title"
                style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e8e8ea' }}
              >
                Personal notes
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#8e8e93' }}>
                {notesModalDemo.name}
                <span style={{ color: '#636366' }}> · </span>
                {notesModalDemo.email}
              </p>
            </div>
            <div style={{ flex: 1, padding: 16, minHeight: 0 }}>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Anything you want to remember about this prospect…"
                autoFocus
                style={{
                  width: '100%',
                  height: 'min(52vh, 420px)',
                  minHeight: 280,
                  boxSizing: 'border-box',
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid #3a3a40',
                  background: '#0a0a0b',
                  color: '#e8e8ea',
                  fontSize: 14,
                  lineHeight: 1.55,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                padding: '12px 16px 16px',
                borderTop: '1px solid #2a2a2e',
              }}
            >
              <button
                type="button"
                onClick={() => closeNotesModal()}
                disabled={notesSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #3a3a40',
                  background: 'transparent',
                  color: '#8e8e93',
                  fontSize: 13,
                  cursor: notesSaving ? 'wait' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveNotes()}
                disabled={notesSaving}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0a84ff',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: notesSaving ? 'wait' : 'pointer',
                }}
              >
                {notesSaving ? 'Saving…' : 'Save notes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {linksModalDemo ? (
        <div
          role="presentation"
          onClick={() => closeLinksModal()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="links-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              display: 'flex',
              flexDirection: 'column',
              background: '#141416',
              border: '1px solid #3a3a40',
              borderRadius: 14,
              boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
            }}
          >
            <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #2a2a2e' }}>
              <h2
                id="links-modal-title"
                style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e8e8ea' }}
              >
                Assessment &amp; Workspace links
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#8e8e93' }}>
                {linksModalDemo.name}
                <span style={{ color: '#636366' }}> · </span>
                {linksModalDemo.email}
              </p>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#8e8e93' }}>Assessment link</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="url"
                    value={linksDraft.assessment_link}
                    onChange={(e) =>
                      setLinksDraft((d) => ({ ...d, assessment_link: e.target.value }))
                    }
                    placeholder="https://…"
                    autoFocus
                    style={{ ...modalInputStyle, flex: 1 }}
                  />
                  {linksDraft.assessment_link.trim() && (
                    <a
                      href={linksDraft.assessment_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 12px',
                        borderRadius: 8,
                        border: '1px solid #3a3a40',
                        background: '#0a0a0b',
                        color: '#0a84ff',
                        fontSize: 13,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#8e8e93' }}>Private workspace link</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="url"
                    value={linksDraft.private_workspace_link}
                    onChange={(e) =>
                      setLinksDraft((d) => ({ ...d, private_workspace_link: e.target.value }))
                    }
                    placeholder="https://…"
                    style={{ ...modalInputStyle, flex: 1 }}
                  />
                  {linksDraft.private_workspace_link.trim() && (
                    <a
                      href={linksDraft.private_workspace_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 12px',
                        borderRadius: 8,
                        border: '1px solid #3a3a40',
                        background: '#0a0a0b',
                        color: '#bf5af2',
                        fontSize: 13,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Open ↗
                    </a>
                  )}
                </div>
              </label>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                padding: '12px 16px 16px',
                borderTop: '1px solid #2a2a2e',
              }}
            >
              <button
                type="button"
                onClick={() => closeLinksModal()}
                disabled={linksSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #3a3a40',
                  background: 'transparent',
                  color: '#8e8e93',
                  fontSize: 13,
                  cursor: linksSaving ? 'wait' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveLinks()}
                disabled={linksSaving}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0a84ff',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: linksSaving ? 'wait' : 'pointer',
                }}
              >
                {linksSaving ? 'Saving…' : 'Save links'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dataModalDemo ? (
        <div
          role="presentation"
          onClick={() => closeDataModal()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              display: 'flex',
              flexDirection: 'column',
              background: '#141416',
              border: '1px solid #3a3a40',
              borderRadius: 14,
              boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
            }}
          >
            <div
              style={{
                padding: '18px 20px 12px',
                borderBottom: '1px solid #2a2a2e',
              }}
            >
              <h2
                id="data-modal-title"
                style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e8e8ea' }}
              >
                Prospect data
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#8e8e93' }}>
                {dataModalDemo.name}
                <span style={{ color: '#636366' }}> · </span>
                {dataModalDemo.email}
              </p>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#8e8e93' }}>Proposals sent / mo</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={dataDraft.proposals_per_month}
                  onChange={(e) =>
                    setDataDraft((d) => ({ ...d, proposals_per_month: e.target.value }))
                  }
                  placeholder="e.g. 12"
                  autoFocus
                  style={modalInputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#8e8e93' }}>Avg deal size ($)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={dataDraft.avg_deal_size}
                  onChange={(e) => setDataDraft((d) => ({ ...d, avg_deal_size: e.target.value }))}
                  placeholder="e.g. 8000"
                  style={modalInputStyle}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#8e8e93' }}>Close rate (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={dataDraft.close_rate}
                  onChange={(e) => setDataDraft((d) => ({ ...d, close_rate: e.target.value }))}
                  placeholder="e.g. 22"
                  style={modalInputStyle}
                />
              </label>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                padding: '12px 16px 16px',
                borderTop: '1px solid #2a2a2e',
              }}
            >
              <button
                type="button"
                onClick={() => closeDataModal()}
                disabled={dataSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #3a3a40',
                  background: 'transparent',
                  color: '#8e8e93',
                  fontSize: 13,
                  cursor: dataSaving ? 'wait' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveData()}
                disabled={dataSaving}
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0a84ff',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: dataSaving ? 'wait' : 'pointer',
                }}
              >
                {dataSaving ? 'Saving…' : 'Save data'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #3a3a40',
  background: '#0a0a0b',
  color: '#e8e8ea',
  fontSize: 14,
  fontFamily: 'inherit',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 140,
  boxSizing: 'border-box',
  padding: '6px 8px',
  borderRadius: 6,
  border: '1px solid #3a3a40',
  background: '#0a0a0b',
  color: '#fff',
  fontSize: 12,
};

function AttendanceCell({
  demo,
  onMark,
}: {
  demo: Demo;
  onMark: (attendance: 'showed' | 'no_show') => void;
}) {
  if (demo.status === 'CANCELLED' || demo.status === 'RESCHEDULED') {
    return <span style={{ fontSize: 12, color: '#636366' }}>—</span>;
  }

  const canCorrect = canOrganizerCorrectAttendance(demo, Date.now());
  const live = isLiveMeetingWindow(demo.scheduled_at, Date.now());
  if (canCorrect) {
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {live && (
          <span style={{ fontSize: 10, color: '#ffd60a', fontWeight: 600 }} title="Live meeting window">
            LIVE
          </span>
        )}
        <button
          type="button"
          onClick={() => onMark('showed')}
          style={{
            padding: '5px 8px',
            borderRadius: 6,
            border: 'none',
            background: '#30d158',
            color: '#0a0a0b',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Joined
        </button>
        <button
          type="button"
          onClick={() => onMark('no_show')}
          style={{
            padding: '5px 8px',
            borderRadius: 6,
            border: 'none',
            background: '#ff9f0a',
            color: '#0a0a0b',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          No-Show
        </button>
      </div>
    );
  }

  if (demo.status === 'COMPLETED' || demo.joined_at) {
    return <span style={{ fontSize: 12, color: '#30d158', fontWeight: 600 }}>Joined</span>;
  }
  if (demo.status === 'NO_SHOW') {
    return <span style={{ fontSize: 12, color: '#ff9f0a', fontWeight: 600 }}>No-show</span>;
  }
  const started = new Date(demo.scheduled_at).getTime() <= Date.now();
  if (!started) {
    return <span style={{ fontSize: 12, color: '#636366' }}>Upcoming</span>;
  }
  return <span style={{ fontSize: 12, color: '#ff9f0a', fontWeight: 600 }}>{demo.status}</span>;
}
