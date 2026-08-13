import { NextResponse } from 'next/server';
import { accionBackend } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';
// El barrido completo puede tardar: mismo margen que el respaldo.
export const maxDuration = 60;

/**
 * POST /api/config/recalcular — v10.10.3
 * Botón "Poner costos al día" de /configuracion (solo Admin, la página ya
 * está detrás de ese rol). Ejecuta el recalcularTodo del backend: barre las
 * calculadoras (SubRecetas: cabecera y líneas) y luego todas las recetas,
 * escribiendo SOLO lo que cambió. Es el remedio para cuando alguien editó
 * Costes DIRECTO en la hoja de Google (sin pasar por la app): esos cambios
 * no disparan cascada y dejan los costeos viejos hasta este barrido.
 * Nota: si la respuesta se demora más del límite de Vercel, el backend
 * TERMINA igual (Apps Script no se detiene al cortarse el cliente); en ese
 * caso la app muestra el aviso de tiempo y basta con recargar para ver los
 * costos ya al día.
 */
export async function POST() {
  try {
    const j = await accionBackend<{ recetas_recalculadas: number; subrecetas_barridas: number; segundos: number }>(
      'parametros', 'recalcularTodo', {}
    );
    if (!j.ok || !j.data) {
      return NextResponse.json(
        { ok: false, error: (j.error && (j.error as { message?: string }).message) || 'Error' },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, ...j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
