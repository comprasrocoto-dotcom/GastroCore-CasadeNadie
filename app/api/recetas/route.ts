import { NextRequest, NextResponse } from 'next/server';
import { crearReceta, getRecetas, getReceta, actualizarReceta, setActivoReceta } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      const receta = await getReceta(id);
      if (!receta) return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 });
      return NextResponse.json({ ok: true, data: receta });
    }
    const all = req.nextUrl.searchParams.get('all') === 'true';
    const recetas = await getRecetas(all);
    return NextResponse.json({ ok: true, data: recetas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await crearReceta(body);
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 });
    const res = await actualizarReceta(id, data);
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, activo } = body;
    if (!id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 });
    const res = await setActivoReceta(id, activo === true || activo === 'true');
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
