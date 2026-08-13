import { NextResponse } from 'next/server';
import { getPantallaFamilias } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/**
 * v10.11 — UN VIAJE POR PANTALLA (/recetas/familias).
 *
 * Antes esta pantalla abría cuatro peticiones en paralelo: familias,
 * subfamilias, recetas e insumos. Las dos últimas se pedían COMPLETAS solo
 * para contar cuántas cuelgan de cada familia y para el modal "Dónde se usa";
 * de los 266 insumos solo se usaban el artículo y la subfamilia.
 *
 * Ahora es una llamada, con las dos listas ya recortadas en el backend.
 */
export async function GET() {
  try {
    const data = await getPantallaFamilias();
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
