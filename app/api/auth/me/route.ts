import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Identidad de la sesión actual (nombre y rol) para las páginas cliente. */
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, usuario: s.u, rol: s.r });
}
