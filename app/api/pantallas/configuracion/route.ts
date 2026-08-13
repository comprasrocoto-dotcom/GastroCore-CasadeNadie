import { NextResponse } from 'next/server';
import { getPantallaConfiguracion } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/**
 * v10.11 — UN VIAJE POR PANTALLA (/configuracion).
 *
 * Antes esta pantalla disparaba SEIS peticiones al montar: cuatro secciones
 * distintas pedían /api/config/parametros cada una por su cuenta (identidad,
 * parámetros de costeo, estilo del recetario y "Acerca del sistema"), más
 * /api/familias y /api/insumos. Ahora es una sola llamada que se reparte entre
 * las secciones.
 *
 * Nota: /api/config/fotos NO entra aquí a propósito — lista una carpeta de
 * Drive, no la hoja, y solo la usa una sección.
 */
export async function GET() {
  try {
    const data = await getPantallaConfiguracion();
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
