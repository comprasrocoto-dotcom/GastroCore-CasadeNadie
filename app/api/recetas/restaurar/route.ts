import { NextRequest, NextResponse } from 'next/server';
import { restaurarVersion } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, version, usuario } = body;
    if (!id || version === undefined || version === null) {
      return NextResponse.json({ ok: false, error: 'Falta id o version' }, { status: 400 });
    }
    const res = await restaurarVersion(String(id), Number(version), usuario);
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
