import { NextResponse } from 'next/server';
import { getFamilias, crearFamilia, actualizarFamilia } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getFamilias();
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
    if (!nombre) {
      return NextResponse.json({ ok: false, error: 'El nombre es obligatorio' }, { status: 400 });
    }
    const centrocosto = typeof body?.centrocosto === 'string' ? body.centrocosto.trim().toUpperCase() : '';
    const r = await crearFamilia({ nombre, tipo: 'receta', centrocosto });
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
    const data: { nombre?: string; activo?: boolean; centrocosto?: string } = {};
    if (typeof body.nombre === 'string') data.nombre = body.nombre.trim();
    if (typeof body.activo === 'boolean') data.activo = body.activo;
    // v9.2: centro de costo (vacio = quitar; hereda el de la familia)
    if (typeof body.centrocosto === 'string') (data as { centrocosto?: string }).centrocosto = body.centrocosto.trim().toUpperCase();
    const r = await actualizarFamilia(id, data);
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
