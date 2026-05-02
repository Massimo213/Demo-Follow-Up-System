import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ORGANIZER_COOKIE, verifyOrganizerToken, getOrganizerSecret } from '@/lib/organizer-auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/organizer')) return NextResponse.next();
  if (pathname.startsWith('/organizer/login')) return NextResponse.next();

  const secret = getOrganizerSecret();
  if (!secret) {
    return NextResponse.redirect(new URL('/organizer/login?e=config', request.url));
  }

  const cookie = request.cookies.get(ORGANIZER_COOKIE)?.value;
  const ok = await verifyOrganizerToken(secret, cookie);
  if (!ok) {
    return NextResponse.redirect(new URL('/organizer/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/organizer', '/organizer/:path*'],
};
