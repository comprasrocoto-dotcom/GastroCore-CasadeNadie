import { NextResponse } from 'next/server';
import { getCatalogo } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await getCatalogo();
    return NextResponse.json({ ok: true, data: items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
