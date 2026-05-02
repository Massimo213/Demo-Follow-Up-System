import { NextRequest, NextResponse } from 'next/server';
import {
  ORGANIZER_COOKIE,
  signOrganizerSession,
  getOrganizerSecret,
} from '@/lib/organizer-auth';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** Establish httpOnly session after verifying DEMO_ORGANIZER_SECRET */
export async function POST(request: NextRequest) {
  const secret = getOrganizerSecret();
  if (!secret) {
    return NextResponse.json({ error: 'DEMO_ORGANIZER_SECRET not set' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const submittedRaw =
    typeof body === 'object' &&
    body !== null &&
    'secret' in body &&
    typeof (body as { secret: unknown }).secret === 'string'
      ? (body as { secret: string }).secret
      : '';
  const submitted = submittedRaw.trim();

  if (submitted !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await signOrganizerSession(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ORGANIZER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ORGANIZER_COOKIE, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });
  return res;
}
