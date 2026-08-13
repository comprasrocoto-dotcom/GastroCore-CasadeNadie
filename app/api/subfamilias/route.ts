import { NextResponse } from 'next/server';
import { getSubfamilias, crearSubfamilia, actualizarSubfamilia } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getSubfamilias();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg, data: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const nombre = String(body?.nombre || '').trim();
    const familia_id = String(body?.familia_id || '').trim();
    if (!nombre || !familia_id) {
      return NextResponse.json({ ok: false, error: 'Nombre y familia son obligatorios' }, { status: 400 });
    }
    const tipo = body?.tipo === 'insumo' ? 'insumo' : 'receta'; // v9.3
    const centrocosto = typeof body?.centrocosto === 'string' ? body.centrocosto.trim().toUpperCase() : '';
    const r = await crearSubfamilia({ familia_id, nombre, tipo, centrocosto });
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ ok: false, error: 'El id es obligatorio' }, { status: 400 });
    const data: { nombre?: string; familia_id?: string; activo?: boolean; centrocosto?: string } = {};
    if (typeof body.nombre === 'string') data.nombre = body.nombre.trim();
    if (typeof body.familia_id === 'string') data.familia_id = body.familia_id.trim();
    if (typeof body.activo === 'boolean') data.activo = body.activo;
    // v9.2: centro de costo (vacio = quitar; hereda el de la familia)
    if (typeof body.centrocosto === 'string') (data as { centrocosto?: string }).centrocosto = body.centrocosto.trim().toUpperCase();
    const r = await actualizarSubfamilia(id, data);
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
