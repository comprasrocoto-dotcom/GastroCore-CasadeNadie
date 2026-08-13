import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
const API_URL = process.env.GASTROCORE_API_URL;
const API_TOKEN = process.env.GASTROCORE_API_TOKEN;

/** v10.1: cambio de clave del usuario con sesión. El email sale de la
 *  COOKIE firmada (jamás del body): nadie cambia la clave de otro. */
export async function POST(req: NextRequest) {
  try {
    if (!API_URL || !API_TOKEN) {
      return NextResponse.json({ ok: false, error: 'Servidor no configurado' }, { status: 500 });
    }
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    if (!(session as { e?: string }).e) return NextResponse.json({ ok: false, error: 'Cierra sesión y vuelve a entrar para poder cambiar tu clave.' }, { status: 400 });
    const body = await req.json();
    const claveNueva = String(body.clave_nueva || '').trim();
    if (claveNueva.length < 10) {
      return NextResponse.json({ ok: false, error: 'La clave nueva debe tener al menos 10 caracteres.' }, { status: 400 });
    }
    const res = await fetch(API_URL as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'usuarios', action: 'cambiarclave', token: API_TOKEN, data: { email: (session as { e?: string }).e || '', clave_actual: String(body.clave_actual || ''), clave_nueva: claveNueva } }),
    });
    const j = await res.json();
    if (!j.ok) return NextResponse.json({ ok: false, error: (j.error && j.error.message) || j.error || 'No se pudo' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
