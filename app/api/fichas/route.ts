import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getUsuario } from '@/lib/session';
import { getFicha, getRecetaPorId, accionBackend } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/** GET /api/fichas?receta_id=REC-000011 -> { ficha, receta } (v7.3: cacheado). */
export async function GET(req: NextRequest) {
  try {
    const recetaId = req.nextUrl.searchParams.get('receta_id');
    if (!recetaId) return NextResponse.json({ ok: false, error: 'Falta receta_id' }, { status: 400 });
    const [ficha, receta] = await Promise.all([getFicha(recetaId), getRecetaPorId(recetaId)]);
    revalidateTag('recetario', { expire: 0 }); // v9.6.1: la foto/ficha se ve al instante
    return NextResponse.json({ ok: true, ficha, receta });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/** POST /api/fichas  body: { receta_id, ...campos } — upsert (limpia caché al mutar). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.receta_id) return NextResponse.json({ ok: false, error: 'Falta receta_id' }, { status: 400 });
    const usuario = await getUsuario();
    const j = await accionBackend('fichas', 'guardar', { data: { ...body, usuario } });
    if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message || 'Error del backend' }, { status: 502 });
    revalidateTag('recetario', { expire: 0 }); // v9.6.1: la foto/ficha se ve al instante
    return NextResponse.json({ ok: true, ficha: j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
