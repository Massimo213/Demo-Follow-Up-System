/**
 * Massimo-only demo organizer gate.
 * Cookie session for browser UI; Bearer token for scripts/curl (same secret).
 */

import type { NextRequest } from 'next/server';

export const ORGANIZER_COOKIE = 'elystra_organizer_session';
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7d

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Create session token: base64url(JSON).hmac */
export async function signOrganizerSession(secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
  const payload = JSON.stringify({ exp });
  const payloadB64 = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = await hmacSha256Base64Url(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifyOrganizerToken(secret: string, token: string | undefined): Promise<boolean> {
  if (!token || !secret) return false;
  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0) return false;
  const payloadB64 = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = await hmacSha256Base64Url(secret, payloadB64);
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return false;
  let json: string;
  try {
    let base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const m = base64.length % 4;
    if (m) base64 += '='.repeat(4 - m);
    json = atob(base64);
  } catch {
    return false;
  }
  let body: { exp?: number };
  try {
    body = JSON.parse(json) as { exp?: number };
  } catch {
    return false;
  }
  return typeof body.exp === 'number' && body.exp > Math.floor(Date.now() / 1000);
}

export function getOrganizerSecret(): string | undefined {
  return process.env.DEMO_ORGANIZER_SECRET?.trim() || undefined;
}

/** Bearer preferred; else signed session cookie */
export function getOrganizerCredentialFromRequest(request: NextRequest): string | undefined {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim() || undefined;
  }
  return request.cookies.get(ORGANIZER_COOKIE)?.value;
}

/**
 * Returns true when credential matches raw secret (API) or valid session cookie.
 */
export async function isOrganizerRequest(request: NextRequest): Promise<boolean> {
  const secret = getOrganizerSecret();
  if (!secret) return false;
  const cred = getOrganizerCredentialFromRequest(request);
  if (!cred) return false;
  if (cred === secret) return true;
  return verifyOrganizerToken(secret, cred);
}