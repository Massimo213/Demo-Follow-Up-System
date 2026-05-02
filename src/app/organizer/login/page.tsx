'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const err = searchParams.get('e');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    err === 'config' ? 'Server missing DEMO_ORGANIZER_SECRET' : null
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/organizer/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ secret: secret.trim() }),
      });
      if (!res.ok) {
        let detail = '';
        try {
          const j = (await res.json()) as { error?: string };
          detail = j.error ? ` — ${j.error}` : '';
        } catch {
          /* ignore */
        }
        if (res.status === 503) {
          setMessage(`Server missing DEMO_ORGANIZER_SECRET in env${detail}`);
        } else if (res.status === 401) {
          setMessage('Invalid secret (check .env.local matches exactly; restart dev server)');
        } else {
          setMessage(`Login failed (${res.status})${detail}`);
        }
        setBusy(false);
        return;
      }
      // Full navigation: guarantees browser sends new httpOnly cookie before middleware runs
      window.location.assign('/organizer');
    } catch {
      setMessage('Network error');
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0b',
        color: '#e8e8ea',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 360,
          padding: 32,
          borderRadius: 12,
          border: '1px solid #2a2a2e',
          background: '#121214',
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Demo organizer</h1>
        <p style={{ fontSize: 13, color: '#8e8e93', marginBottom: 24 }}>
          Access restricted. Enter organizer secret.
        </p>
        <label style={{ display: 'block', fontSize: 12, color: '#8e8e93', marginBottom: 6 }}>
          Secret
        </label>
        <input
          type="password"
          autoComplete="off"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #3a3a40',
            background: '#0a0a0b',
            color: '#fff',
            marginBottom: 16,
            fontSize: 14,
          }}
        />
        {message ? (
          <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{message}</p>
        ) : null}
        <button
          type="submit"
          disabled={busy || !secret}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 8,
            border: 'none',
            background: busy || !secret ? '#3a3a40' : '#0a84ff',
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: busy || !secret ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </main>
  );
}

export default function OrganizerLoginPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            fontFamily: 'system-ui, -apple-system, sans-serif',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0b',
            color: '#8e8e93',
            fontSize: 14,
          }}
        >
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
