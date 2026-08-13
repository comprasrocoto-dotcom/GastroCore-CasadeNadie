import { NextResponse } from 'next/server';
import { getPantallaEditorSubreceta } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/**
 * v10.11 — UN VIAJE POR PANTALLA.
 *
 * Antes /subrecetas/nueva abría 6 peticiones en paralelo (bootstrap,
 * subfamilias, subrecetas?all, insumos, catalogo y la subreceta). Cada una
 * era una ejecución de Apps Script que releía las mismas pestañas, y esa
 * ráfaga era la que perdía lecturas y dejaba los desplegables vacíos.
 *
 * Ahora es una sola llamada. Con ?id= trae además la subreceta con sus
 * líneas; sin id, el modo creación.
 */
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('id') || undefined;
    const data = await getPantallaEditorSubreceta(id);
    if (!data) {
      return NextResponse.json(
        { ok: false, error: 'El backend no devolvió los datos de la pantalla.' },
        { status: 502 }
      );
    }
    // Si se pidió una subreceta puntual y no existe, se dice claramente.
    if (id && !data.subreceta) {
      return NextResponse.json(
        { ok: false, error: 'Esa subreceta no existe o fue desactivada.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
