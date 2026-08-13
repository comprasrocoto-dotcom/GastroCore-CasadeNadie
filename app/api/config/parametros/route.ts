import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getParametros, accionBackend } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/** GET: parámetros de negocio (FC, impuesto, umbral, FC por familia). */
export async function GET() {
  try {
    const p = await getParametros();
    if (!p) return NextResponse.json({ ok: false, error: 'Backend no disponible' }, { status: 502 });
    revalidateTag('recetario', { expire: 0 }); // v9.13.1: el estilo y el nombre se ven al instante
    return NextResponse.json({ ok: true, parametros: p });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/** POST: guarda parámetros; el backend recalcula TODO el menú si cambió algo de precios. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const j = await accionBackend<{ parametros: unknown; recalculo: string | null }>('parametros', 'guardarparametros', { data: body });
    if (!j.ok) return NextResponse.json({ ok: false, error: (j.error && (j.error as { message?: string }).message) || 'Error' }, { status: 502 });
    return NextResponse.json({ ok: true, ...j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
