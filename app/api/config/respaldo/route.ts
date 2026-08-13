import { NextResponse } from 'next/server';
import { accionBackend } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET: descarga una copia Excel del Sheet completo (respaldo con un clic). */
export async function GET() {
  try {
    const j = await accionBackend<{ nombre: string; base64: string }>('parametros', 'respaldo', {});
    if (!j.ok || !j.data) {
      return NextResponse.json({ ok: false, error: (j.error && (j.error as { message?: string }).message) || 'Error' }, { status: 502 });
    }
    const bin = Buffer.from(j.data.base64, 'base64');
    return new NextResponse(bin, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${j.data.nombre}"`,
        'Content-Length': String(bin.length),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
