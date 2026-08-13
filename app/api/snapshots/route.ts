import { NextResponse } from 'next/server';
import { getSnapshots, generarSnapshot } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getSnapshots();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    const res = await generarSnapshot('Panel de analisis');
    return NextResponse.json({ ok: true, data: res });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
