import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16 renombro "middleware.ts" a "proxy.ts". Chequeo OPTIMISTA:
// solo mira si la cookie existe, no valida el JWT — mas barato y evita
// pegarle al backend en cada navegacion. La autorizacion REAL ocurre en
// cada llamada de server-fetch.ts (serverFetch redirige a /login si el
// backend responde 401 — el backend es la unica fuente de verdad).
const ACCESS_COOKIE = 'access_token';

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.get(ACCESS_COOKIE)?.value !== undefined;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/agenda') && !hasSession) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === '/login' && hasSession) {
    return NextResponse.redirect(new URL('/agenda', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/agenda/:path*', '/login'],
};
