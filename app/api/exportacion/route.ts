import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const API_URL = process.env.GASTROCORE_API_URL;
const API_TOKEN = process.env.GASTROCORE_API_TOKEN;

/** v11.0: la relación completa (recetas+subrecetas+líneas+fichas) en un viaje. */
export async function GET() {
  try {
    if (!API_URL || !API_TOKEN) {
      return NextResponse.json({ ok: false, error: 'Servidor no configurado' }, { status: 500 });
    }
    const res = await fetch(API_URL as string, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'read', resource: 'exportacion', token: API_TOKEN, params: {} }),
      cache: 'no-store',
    });
    const j = await res.json();
    if (!j.ok) return NextResponse.json({ ok: false, error: j.error }, { status: 400 });
    return NextResponse.json({ ok: true, data: j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
