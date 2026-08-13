import { NextResponse } from 'next/server';
import { getPantallaRecetas } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/**
 * v10.11 — UN VIAJE POR PANTALLA (listado /recetas y Panel /recetas/resumen).
 *
 * Antes cada una abría recetas?all=true + familias. Ninguno de esos dos
 * recursos está en la lista de cacheables del backend, así que CADA vuelta al
 * listado leía la hoja desde cero — por eso la espera era tan constante.
 * 'pantallarecetas' sí está cacheado (60 s) y trae además los parámetros de
 * costeo, que son los que hacen que el precio sugerido salga del FC objetivo
 * real y no de una constante.
 */
export async function GET() {
  try {
    const data = await getPantallaRecetas();
    if (!data) {
      return NextResponse.json(
        { ok: false, error: 'El backend no devolvió los datos de la pantalla.' },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
