'use client';

import { useCallback, useEffect, useState } from 'react';
import { applyAttendanceCorrectionToReport } from '@/lib/show-rate';
import type {
  AnalyticsWindow,
  CorrectionDemo,
  FunnelStep,
  RateRow,
  ShowRateReport,
  UnresolvedDemo,
} from '@/lib/show-rate';
import type { Demo } from '@/types/demo';

const WINDOWS: { value: AnalyticsWindow; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

function pct(n: number | null): string {
  if (n == null) return '—';
  return `${Math.round(n * 1000) / 10}%`;
}

const cell: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #2a2a2e',
  fontSize: 13,
  textAlign: 'right',
};

const cellLeft: React.CSSProperties = { ...cell, textAlign: 'left', color: '#e8e8ea' };

export function AnalyticsPanel({
  onMarkAttendance,
}: {
  onMarkAttendance: (
    id: string,
    attendance: 'showed' | 'no_show'
  ) => Promise<{ ok: boolean; demo?: Demo }>;
}) {
  const [window, setWindow] = useState<AnalyticsWindow>('90d');
  const [report, setReport] = useState<ShowRateReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }): Promise<ShowRateReport | null> => {
    if (!opts?.silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizer/analytics?window=${window}&_=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (!res.ok) {
        setError('Failed to load analytics');
        return null;
      }
      const next = (await res.json()) as ShowRateReport;
      setReport(next);
      return next;
    } catch {
      setError('Network error');
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [window]);

  useEffect(() => {
    void load();
  }, [load]);

  async function mark(id: string, attendance: 'showed' | 'no_show', name: string) {
    setFlash(null);
    setMarking(id);
    const beforeAttended = report?.headline.attended ?? null;
    const beforeRow = report?.correction_demos.find((d) => d.id === id);
    const result = await onMarkAttendance(id, attendance);
    if (!result.ok) {
      setFlash('Save failed — see error above.');
      setMarking(null);
      return;
    }

    if (result.demo && report) {
      setReport(applyAttendanceCorrectionToReport(report, id, result.demo));
    }

    let next = await load({ silent: true });
    if (
      result.demo &&
      beforeRow &&
      beforeAttended != null &&
      next?.headline.attended === beforeAttended &&
      rowOutcome(beforeRow) !== rowOutcome(result.demo)
    ) {
      await new Promise((r) => setTimeout(r, 400));
      next = await load({ silent: true });
    }

    const afterAttended = next?.headline.attended;
    const label = attendance === 'showed' ? 'Joined' : 'No-Show';
    const delta =
      beforeAttended != null && afterAttended != null && beforeAttended !== afterAttended
        ? ` Attended ${beforeAttended} → ${afterAttended}.`
        : '';
    setFlash(`${name}: ${label} saved.${delta} Numbers below refreshed.`);
    setMarking(null);
    setTimeout(() => setFlash(null), 6000);
  }

  const h = report?.headline;
  const emptyWindow = h != null && h.booked === 0;

  return (
    <div>
      <p style={{ fontSize: 13, color: '#8e8e93', marginBottom: 16, maxWidth: 860 }}>
        Cohort is by <strong style={{ color: '#c7c7cc' }}>meeting time</strong> in the selected window.
        Show rate = attended ÷ kept. Attended = <code>joined_at</code> or status COMPLETED. Use{' '}
        <strong style={{ color: '#c7c7cc' }}>Last 90 days</strong> if 30d looks empty — your recent
        bookings are May/June.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            type="button"
            onClick={() => setWindow(w.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: window === w.value ? '#3a3a40' : '#1c1c1f',
              color: window === w.value ? '#fff' : '#8e8e93',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {w.label}
          </button>
        ))}
        {refreshing ? (
          <span style={{ fontSize: 12, color: '#8e8e93' }}>Refreshing…</span>
        ) : null}
      </div>

      {flash ? (
        <p
          style={{
            fontSize: 13,
            color: flash.startsWith('Save failed') ? '#ff6b6b' : '#30d158',
            marginBottom: 12,
            padding: '10px 12px',
            background: flash.startsWith('Save failed') ? '#2a1210' : '#0f1a12',
            borderRadius: 8,
          }}
        >
          {flash}
        </p>
      ) : null}

      {error ? <p style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</p> : null}
      {loading && !report ? <p style={{ color: '#8e8e93' }}>Loading…</p> : null}

      {emptyWindow ? (
        <p
          style={{
            fontSize: 13,
            color: '#ff9f0a',
            marginBottom: 16,
            padding: '12px 14px',
            background: '#1a1508',
            borderRadius: 8,
            border: '1px solid #3a3010',
          }}
        >
          <strong>0 demos</strong> with a meeting in the last{' '}
          {window === '7d' ? 7 : window === '14d' ? 14 : window === '90d' ? 90 : 30} days. Switch to{' '}
          <button
            type="button"
            onClick={() => setWindow('90d')}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#30d158',
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
              fontSize: 13,
            }}
          >
            Last 90 days
          </button>{' '}
          — that is where your kept demos live right now.
        </p>
      ) : null}

      {h && !emptyWindow ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Stat label="Booked" value={String(h.booked)} />
            <Stat label="Kept" value={String(h.kept)} />
            <Stat label="Attended" value={String(h.attended)} />
            <Stat
              label="Show rate"
              value={pct(h.show_rate)}
              accent={h.show_rate != null && h.show_rate >= 0.7 ? '#30d158' : '#ff9f0a'}
            />
            <Stat label="No-show rate" value={pct(h.no_show_rate)} />
            <Stat label="Confirmation rate" value={pct(h.confirmation_rate)} />
          </div>

          {report.stale_alert_count > 0 ? (
            <AttendanceTable
              title={`Canary — ${report.stale_alert_count} still PENDING/CONFIRMED >15m`}
              subtitle="Auto-NO_SHOW should have resolved these."
              rows={report.unresolved}
              marking={marking}
              onMark={mark}
              accent="#ff453a"
            />
          ) : (
            <p style={{ fontSize: 13, color: '#30d158', marginBottom: 24 }}>
              Canary clear — no PENDING/CONFIRMED demos past the 15-minute alert.
            </p>
          )}

          {report.correction_demos.length > 0 ? (
            <AttendanceTable
              title="Correct attendance (past kept demos in this window)"
              subtitle="Flip auto-NO_SHOW or fix a wrong click. Joined → COMPLETED + joined_at (clears no_show_at). No-Show → NO_SHOW + no_show_at (clears joined_at)."
              rows={report.correction_demos}
              marking={marking}
              onMark={mark}
              showOutcome
            />
          ) : null}

          <RateTable title="Show rate by horizon bucket" rows={report.by_horizon} />
          <FunnelTable steps={report.funnel} />

          <p style={{ fontSize: 11, color: '#636366', marginTop: 16 }}>
            Generated {new Date(report.generated_at).toLocaleString()} · {report.window} · auto-NO_SHOW
            at T+12m · canary at T+15m
          </p>
        </>
      ) : null}
    </div>
  );
}

function AttendanceTable({
  title,
  subtitle,
  rows,
  marking,
  onMark,
  accent,
  showOutcome,
}: {
  title: string;
  subtitle: string;
  rows: Array<CorrectionDemo | UnresolvedDemo>;
  marking: string | null;
  onMark: (id: string, attendance: 'showed' | 'no_show', name: string) => void;
  accent?: string;
  showOutcome?: boolean;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 14, color: accent ?? '#c7c7cc', margin: '0 0 8px' }}>{title}</h2>
      <p style={{ fontSize: 12, color: '#8e8e93', margin: '0 0 12px' }}>{subtitle}</p>
      <div style={{ overflowX: 'auto', border: '1px solid #2a2a2e', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ color: '#8e8e93', fontSize: 11, textAlign: 'left' }}>
              <th style={cellLeft}>When</th>
              <th style={cellLeft}>Invitee</th>
              {showOutcome ? <th style={cellLeft}>Outcome</th> : <th style={cellLeft}>Status</th>}
              <th style={{ ...cell, textAlign: 'left' }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td style={cellLeft}>{new Date(d.scheduled_at).toLocaleString()}</td>
                <td style={cellLeft}>
                  <div style={{ fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: '#8e8e93' }}>{d.email}</div>
                </td>
                <td style={cellLeft}>
                  {showOutcome ? outcomeLabel(d) : d.status}
                </td>
                <td style={{ ...cell, textAlign: 'left' }}>
                  <button
                    type="button"
                    disabled={marking === d.id}
                    onClick={() => onMark(d.id, 'showed', d.name)}
                    style={btn(
                      '#30d158',
                      d.status === 'COMPLETED' || ('joined_at' in d && !!d.joined_at)
                    )}
                  >
                    Joined
                  </button>{' '}
                  <button
                    type="button"
                    disabled={marking === d.id}
                    onClick={() => onMark(d.id, 'no_show', d.name)}
                    style={btn('#ff9f0a', d.status === 'NO_SHOW')}
                  >
                    No-Show
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function rowOutcome(d: { status: string; joined_at?: string | null }): string {
  if (d.status === 'COMPLETED' || d.joined_at) return 'Joined';
  if (d.status === 'NO_SHOW') return 'No-show';
  return d.status;
}

function outcomeLabel(d: CorrectionDemo | UnresolvedDemo): string {
  return rowOutcome(d);
}

function FunnelTable({ steps }: { steps: FunnelStep[] }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 14, color: '#c7c7cc', margin: '0 0 10px' }}>Funnel</h2>
      <p style={{ fontSize: 12, color: '#8e8e93', margin: '0 0 10px' }}>
        Conversion is vs the previous step. Red = at least one message with{' '}
        <code>sent_at &gt; scheduled_at</code> (zero-second tolerance — 2s late is late).
      </p>
      <div style={{ overflowX: 'auto', border: '1px solid #2a2a2e', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr style={{ color: '#8e8e93', fontSize: 11, textAlign: 'right' }}>
              <th style={cellLeft}>Step</th>
              <th style={cell}>Count</th>
              <th style={cell}>From prev</th>
              <th style={cell}>Late sends</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.key} style={{ background: s.red ? '#3a1512' : undefined }}>
                <td style={{ ...cellLeft, color: s.red ? '#ff6b6b' : '#e8e8ea' }}>{s.label}</td>
                <td style={{ ...cell, color: s.red ? '#ff6b6b' : '#c7c7cc' }}>{s.count}</td>
                <td style={cell}>{pct(s.conversion_from_prev)}</td>
                <td style={{ ...cell, color: s.late_count > 0 ? '#ff6b6b' : '#c7c7cc' }}>
                  {s.late_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: '#121214',
        border: '1px solid #2a2a2e',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <div style={{ fontSize: 11, color: '#8e8e93', marginBottom: 6, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? '#e8e8ea' }}>{value}</div>
    </div>
  );
}

function RateTable({ title, rows }: { title: string; rows: RateRow[] }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 14, color: '#c7c7cc', margin: '0 0 10px' }}>{title}</h2>
      <div style={{ overflowX: 'auto', border: '1px solid #2a2a2e', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr style={{ color: '#8e8e93', fontSize: 11, textAlign: 'right' }}>
              <th style={cellLeft}>Bucket</th>
              <th style={cell}>Booked</th>
              <th style={cell}>Kept</th>
              <th style={cell}>Attended</th>
              <th style={cell}>No-show</th>
              <th style={cell}>Show rate</th>
              <th style={cell}>No-show rate</th>
              <th style={cell}>Confirm</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td style={cellLeft}>{r.key}</td>
                <td style={cell}>{r.booked}</td>
                <td style={cell}>{r.kept}</td>
                <td style={cell}>{r.attended}</td>
                <td style={cell}>{r.no_show}</td>
                <td style={{ ...cell, fontWeight: 600 }}>{pct(r.show_rate)}</td>
                <td style={cell}>{pct(r.no_show_rate)}</td>
                <td style={cell}>{pct(r.confirmation_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function btn(color: string, active?: boolean): React.CSSProperties {
  return {
    padding: '5px 10px',
    borderRadius: 6,
    border: active ? '2px solid #fff' : 'none',
    background: color,
    color: '#0a0a0b',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    opacity: active ? 1 : 0.92,
  };
}
