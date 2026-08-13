import { NextRequest, NextResponse } from 'next/server';
import { getUsuario } from '@/lib/session';
import { accionBackend } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/**
 * v9.0 — EL PUENTE: empuja el costo calculado de la subreceta al insumo
 * maestro (con historial de precios y recálculo en cascada de las recetas).
 * Siempre por confirmación explícita del usuario.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.id) return NextResponse.json({ ok: false, error: 'Falta el id de la subreceta' }, { status: 400 });
    const usuario = await getUsuario();
    const j = await accionBackend<{ sin_cambio: boolean; coste: number; recetas_recalculadas?: string }>(
      'subrecetas', 'actualizarinsumo', { data: { id: body.id, usuario } });
    if (!j.ok) {
      return NextResponse.json({ ok: false, error: (j.error && (j.error as { message?: string }).message) || 'Error del backend' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
