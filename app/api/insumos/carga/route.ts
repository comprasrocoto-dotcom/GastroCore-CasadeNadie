import { NextRequest, NextResponse } from 'next/server';
import { getUsuario } from '@/lib/session';
import { accionBackend } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/** POST { filas: [{referencia, coste}] } — carga masiva de costos (solo Admin, ver proxy). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const filas = Array.isArray(body?.filas) ? body.filas : [];
    if (!filas.length) return NextResponse.json({ ok: false, error: 'No llegaron filas' }, { status: 400 });
    if (filas.length > 200) return NextResponse.json({ ok: false, error: 'Máximo 200 filas por tanda' }, { status: 400 });
    const usuario = await getUsuario('Carga por plano');
    const j = await accionBackend<Record<string, unknown>>('insumos', 'cargaplana', { data: { filas, usuario, motivo: 'Carga por plano' } });
    if (!j.ok) return NextResponse.json({ ok: false, error: (j.error && (j.error as { message?: string }).message) || 'Error del backend' }, { status: 502 });
    return NextResponse.json({ ok: true, data: j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
