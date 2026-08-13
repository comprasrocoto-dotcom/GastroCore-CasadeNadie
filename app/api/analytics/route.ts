import { NextResponse } from 'next/server';
import { getAnalytics } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getAnalytics();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
