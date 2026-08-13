import { NextResponse } from 'next/server';
import { getBootstrap } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bootstrap — carga inicial del editor de recetas: familias,
 * subfamilias, unidades y catálogo en UNA sola llamada al backend (v7).
 * Pasa por el caché de gastrocore.ts (TTL 120 s + stale-while-revalidate),
 * así que tras la primera visita responde en milisegundos.
 */
export async function GET() {
  try {
    const data = await getBootstrap();
    if (!data) return NextResponse.json({ ok: false, error: 'Backend no disponible' }, { status: 502 });
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
