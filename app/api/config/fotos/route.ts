import { NextRequest, NextResponse } from 'next/server';
import { getConfigFotos, accionBackend } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/** GET /api/config/fotos (v7.3: cacheado 10 min — la carpeta casi nunca cambia). */
export async function GET() {
  try {
    const carpeta = await getConfigFotos();
    if (!carpeta) return NextResponse.json({ ok: false, error: 'Backend no disponible' }, { status: 502 });
    return NextResponse.json({ ok: true, carpeta });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/** POST /api/config/fotos  body: { nombre } — renombra la carpeta (solo Admin). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const nombre = String(body?.nombre || '').trim();
    if (!nombre) return NextResponse.json({ ok: false, error: 'Escribe un nombre para la carpeta' }, { status: 400 });
    const j = await accionBackend<{ folder_id: string; nombre: string; url: string }>('configfotos', 'renombrar', { data: { nombre } });
    if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message || 'No se pudo renombrar' }, { status: 502 });
    return NextResponse.json({ ok: true, carpeta: j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
