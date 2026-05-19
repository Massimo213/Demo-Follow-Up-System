'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addMinutes, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { enUS } from 'date-fns/locale';
import type { Demo, PqadVerdict } from '@/types/demo';

type Tab = 'booked' | 'pqad';
type Period = 'upcoming' | 'past';

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
    default:
      return '#636366';
  }
}

function notesPreview(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const oneLine = t.replace(/\s+/g, ' ');
  return oneLine.length > 48 ? `${oneLine.slice(0, 48)}…` : oneLine;
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
  const [tab, setTab] = useState<Tab>('booked');
  const [period, setPeriod] = useState<Period>('upcoming');
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesModalDemoId, setNotesModalDemoId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [rowState, setRowState] = useState<
    Record<
      string,
      {
        organizer_booked_by: string;
        organizer_personal_notes: string;
        pqad_verdict: PqadVerdict;
        pqad_rejection_reason: string;
        sdr_payout_cents: string;
        lieutenant_override_cents: string;
        saving: boolean;
      }
    >
  >({});

  const demoGroups = useMemo(() => groupDemosByLocalDay(demos, period), [demos, period]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/organizer/demos?view=${tab}&period=${period}`,
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
          pqad_verdict: d.pqad_verdict ?? 'pending',
          pqad_rejection_reason: d.pqad_rejection_reason ?? '',
          sdr_payout_cents: d.sdr_payout_cents != null ? String(d.sdr_payout_cents) : '',
          lieutenant_override_cents:
            d.lieutenant_override_cents != null ? String(d.lieutenant_override_cents) : '',
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

    const sdr =
      st.sdr_payout_cents.trim() === '' ? null : parseInt(st.sdr_payout_cents, 10);
    const lt =
      st.lieutenant_override_cents.trim() === ''
        ? null
        : parseInt(st.lieutenant_override_cents, 10);

    if (sdr !== null && (Number.isNaN(sdr) || sdr < 0)) {
      setError('SDR payout must be a non-negative integer (cents)');
      setRowState((s) => ({ ...s, [demo.id]: { ...st, saving: false } }));
      return;
    }
    if (lt !== null && (Number.isNaN(lt) || lt < 0)) {
      setError('Override payout must be a non-negative integer (cents)');
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
      if (sdr !== null) body.sdr_payout_cents = sdr;
      if (lt !== null) body.lieutenant_override_cents = lt;
      if (st.pqad_verdict === 'pending') {
        if (st.sdr_payout_cents.trim() === '') body.sdr_payout_cents = null;
        if (st.lieutenant_override_cents.trim() === '') body.lieutenant_override_cents = null;
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
    value: string | PqadVerdict
  ) {
    setRowState((s) => {
      const cur = s[id];
      if (!cur) return s;
      return { ...s, [id]: { ...cur, [field]: value } };
    });
  }

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
              {(['booked', 'pqad'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  title={
                    t === 'booked'
                      ? 'Every Calendly demo — you set PQAD manually on each row'
                      : 'Same rows, filtered to PQAD yes only (for payouts)'
                  }
                  onClick={() => setTab(t)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: tab === t ? '#0a84ff' : '#2a2a2e',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t === 'booked' ? 'All demos' : 'PQAD = yes'}
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
      </header>

      <main style={{ padding: 24 }}>
        <p style={{ fontSize: 13, color: '#8e8e93', marginBottom: 16, maxWidth: 820 }}>
          Every booking shows on <strong style={{ color: '#c7c7cc' }}>All demos</strong>. You manually
          set <strong style={{ color: '#c7c7cc' }}>PQAD</strong> (pending → yes or no) per row—nothing
          is guessed. <strong style={{ color: '#c7c7cc' }}>PQAD = yes</strong> is the same records,
          filtered to qualified demos for payout review. Who booked, verdict, and money live on that
          row; lock kills argument after you save. <strong style={{ color: '#c7c7cc' }}>Upcoming</strong>{' '}
          / <strong style={{ color: '#c7c7cc' }}>Past demos</strong> use server time; below, rows are{' '}
          <strong style={{ color: '#c7c7cc' }}>grouped by calendar day</strong> in each invitee&apos;s
          timezone (Calendly-style).
        </p>
        {error ? (
          <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{error}</p>
        ) : null}
        {loading ? (
          <p style={{ color: '#8e8e93' }}>Loading…</p>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #2a2a2e' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                minWidth: 920,
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
                  <th style={{ ...cell, paddingTop: 14 }}>Booked by</th>
                  <th style={{ ...cell, paddingTop: 14 }}>PQAD</th>
                  <th style={{ ...cell, paddingTop: 14 }}>SDR ¢</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Override ¢</th>
                  <th style={{ ...cell, paddingTop: 14 }}>Reason (if no)</th>
                  <th style={{ ...cell, paddingTop: 14 }} />
                </tr>
              </thead>
              <tbody>
                {demoGroups.map((group) => (
                  <Fragment key={group.sortKey}>
                    <tr>
                      <td
                        colSpan={10}
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
                                title={`PQAD: ${verdictShown ?? 'pending'}`}
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
                                color: '#c7c7cc',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {d.status}
                            </span>
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
                              d.pqad_verdict
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
                                style={inputStyle}
                              />
                            )}
                          </td>
                          <td style={cell}>
                            {locked ? (
                              d.lieutenant_override_cents ?? '—'
                            ) : (
                              <input
                                value={st?.lieutenant_override_cents ?? ''}
                                onChange={(e) =>
                                  updateRow(d.id, 'lieutenant_override_cents', e.target.value)
                                }
                                placeholder="cents"
                                style={inputStyle}
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
    </div>
  );
}

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
