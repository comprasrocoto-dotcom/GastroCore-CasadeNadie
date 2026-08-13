import { NextRequest, NextResponse } from 'next/server';
import { getDependencias } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const itemId = req.nextUrl.searchParams.get('item_id') || '';
    if (!itemId) return NextResponse.json({ ok: true, data: [] });
    const deps = await getDependencias(itemId);
    return NextResponse.json({ ok: true, data: deps });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
