import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getUsuario } from '@/lib/session';
import { accionBackend } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

const MAX_BASE64 = 4 * 1024 * 1024; // ~3 MB de imagen real (tope de Vercel: 4.5 MB)

/** POST /api/fichas/foto  body: { receta_id, base64, mime } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { receta_id, base64, mime } = body || {};
    if (!receta_id || !base64) return NextResponse.json({ ok: false, error: 'Faltan receta_id o la imagen' }, { status: 400 });
    if (String(base64).length > MAX_BASE64) {
      return NextResponse.json({ ok: false, error: 'La imagen es demasiado grande. Usa una foto de menos de 3 MB.' }, { status: 413 });
    }
    if (mime && !String(mime).startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'El archivo debe ser una imagen' }, { status: 400 });
    }
    const usuario = await getUsuario();
    const j = await accionBackend<{ foto_url: string; foto_id: string }>('fichas', 'subirfoto', {
      data: { receta_id, base64, mime: mime || 'image/jpeg', usuario },
    });
    if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message || 'Error al subir la foto' }, { status: 502 });
    revalidateTag('recetario', { expire: 0 }); // v9.6.1: la foto/ficha se ve al instante
    return NextResponse.json({ ok: true, ...j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
