import { NextRequest, NextResponse } from 'next/server';
import { simularImpacto } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const insumoId = (body?.insumo_id || '').toString().trim();
    const nuevoPrecio = Number(body?.nuevo_precio);
    if (!insumoId) {
      return NextResponse.json({ ok: false, error: 'Falta insumo_id' }, { status: 400 });
    }
    if (Number.isNaN(nuevoPrecio) || nuevoPrecio < 0) {
      return NextResponse.json({ ok: false, error: 'Nuevo precio invalido' }, { status: 400 });
    }
    const data = await simularImpacto(insumoId, nuevoPrecio);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
