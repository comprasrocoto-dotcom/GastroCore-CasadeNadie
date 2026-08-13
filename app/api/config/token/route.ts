import { NextResponse } from 'next/server';
import { accionBackend } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/**
 * POST: rota el API_TOKEN del backend y devuelve el nuevo UNA sola vez.
 * ⚠ Tras esto la app queda sin conexión al backend hasta actualizar
 * GASTROCORE_API_TOKEN en Vercel y hacer Redeploy.
 */
export async function POST() {
  try {
    const j = await accionBackend<{ token: string }>('parametros', 'rotartoken', {});
    if (!j.ok || !j.data) {
      return NextResponse.json({ ok: false, error: (j.error && (j.error as { message?: string }).message) || 'Error' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, token: j.data.token });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
