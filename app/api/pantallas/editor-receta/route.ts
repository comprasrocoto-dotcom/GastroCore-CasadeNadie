import { NextResponse } from 'next/server';
import { getPantallaEditorReceta } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/**
 * v10.11 — UN VIAJE POR PANTALLA.
 *
 * Antes /recetas/nueva abría 3 peticiones del navegador (recetas?id,
 * recetas?all=true y bootstrap) y la del id abría 2 más por dentro: 4
 * ejecuciones simultáneas de Apps Script releyendo las mismas pestañas.
 *
 * Ahora es una sola llamada. Con ?id= trae además la receta con sus líneas.
 * Incluye los parámetros de Configuración: son los que hacen que el precio
 * sugerido salga del FC objetivo real y no de una constante.
 */
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id') || undefined;
    const data = await getPantallaEditorReceta(id);
    if (!data) {
      return NextResponse.json(
        { ok: false, error: 'El backend no devolvió los datos de la pantalla.' },
        { status: 502 }
      );
    }
    if (id && !data.receta) {
      return NextResponse.json(
        { ok: false, error: 'Esa receta no existe o fue desactivada.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
