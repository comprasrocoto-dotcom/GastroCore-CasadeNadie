import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function clearAndRedirect(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  const res = NextResponse.redirect(url);
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

// GET para poder usar un simple enlace de "Salir" en la barra.
export async function GET(req: NextRequest) {
  return clearAndRedirect(req);
}

export async function POST(req: NextRequest) {
  return clearAndRedirect(req);
}
