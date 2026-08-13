import { NextResponse } from 'next/server';
import { getInsumos, accionBackend } from '@/lib/api/gastrocore';
import { getUsuario } from '@/lib/session';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const insumos = await getInsumos();
    return NextResponse.json({ ok: true, data: insumos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

/** POST — crear insumo (solo Admin, ver proxy). v8.2 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const usuario = await getUsuario();
    const j = await accionBackend('insumos', 'create', { data: { ...body, usuario } });
    if (!j.ok) {
      return NextResponse.json({ ok: false, error: (j.error && (j.error as { message?: string }).message) || 'Error del backend' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, insumo: j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
