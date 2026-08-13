import { NextRequest, NextResponse } from 'next/server';
import { getHistorialInsumo } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id') || '';
    if (!id) return NextResponse.json({ ok: true, data: [] });
    const historial = await getHistorialInsumo(id);
    return NextResponse.json({ ok: true, data: historial });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
