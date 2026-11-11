import { NextResponse } from 'next/server';
import { SESSION_COOKIE, validSession } from './lib/team-session.mjs';

// Every page and action needs the team sign-in (one team passcode, AGENT_PASSCODE).
// Signed out: the sign-in screen, then back to the page you asked for.
// With no passcode set at all (a local copy), the app stays open as before.
export function proxy(request) {
  if (!process.env.AGENT_PASSCODE) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (pathname === '/signin') return NextResponse.next();
  if (validSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const to = new URL('/signin', request.url);
  if (pathname !== '/') to.searchParams.set('next', pathname + search);
  return NextResponse.redirect(to, 303);
}

// Not for files the sign-in screen itself needs: styles, scripts, icons and the app manifest.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icon-192.png|icon-512.png|manifest.webmanifest|robots.txt).*)'],
};
