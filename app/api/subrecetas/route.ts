import { NextRequest, NextResponse } from 'next/server';
import { crearSubreceta, getSubrecetas, getSubreceta, actualizarSubreceta, setActivoSubreceta } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      const sr = await getSubreceta(id);
      if (!sr) return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 });
      return NextResponse.json({ ok: true, data: sr });
    }
    const all = req.nextUrl.searchParams.get('all') === 'true';
    const subs = await getSubrecetas(all);
    return NextResponse.json({ ok: true, data: subs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await crearSubreceta(body);
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
    const res = await actualizarSubreceta(id, data);
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
    const res = await setActivoSubreceta(id, !!activo);
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
