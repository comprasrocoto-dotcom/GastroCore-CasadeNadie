import { NextRequest, NextResponse } from 'next/server';
import { postAppsScript } from '@/lib/api/gastrocore';
import { createSessionValue, authConfigured, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const API_URL = process.env.GASTROCORE_API_URL;
const API_TOKEN = process.env.GASTROCORE_API_TOKEN;

type LoginBackendResponse = {
  ok: boolean;
  data?: { id: string; email: string; nombre: string; rol: string };
  error?: { code: string; message: string };
};

/**
 * Login v3: valida email + clave contra la hoja 'Usuarios' del backend de
 * Apps Script (acción 'login'). El token de la API y la clave del usuario
 * viajan SOLO servidor → Apps Script; nunca se exponen al navegador.
 * Si las credenciales son válidas, firma la cookie con nombre + rol reales.
 */
export async function POST(req: NextRequest) {
  try {
    if (!authConfigured() || !API_URL || !API_TOKEN) {
      return NextResponse.json(
        { ok: false, error: 'Autenticación no configurada en el servidor (AUTH_SECRET debe tener al menos 32 caracteres; revisa también GASTROCORE_API_URL y GASTROCORE_API_TOKEN).' },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim();
    const clave = String(body?.clave || '');

    if (!email || !clave) {
      return NextResponse.json({ ok: false, error: 'Ingresa tu email y tu clave' }, { status: 400 });
    }

    // Validación contra la hoja Usuarios (backend Apps Script).
    // v10.11.7: pasa por postAppsScript, que sigue el redirect de Apps Script a
    // mano. Antes, si el redirect fallaba, el login decía "no se pudo contactar
    // el servidor" aunque el backend estuviera perfectamente vivo.
    let j: LoginBackendResponse;
    try {
      j = (await postAppsScript<LoginBackendResponse['data']>({
        resource: 'usuarios',
        action: 'login',
        token: API_TOKEN,
        data: { email, clave },
      })) as unknown as LoginBackendResponse;
    } catch {
      return NextResponse.json({ ok: false, error: 'No se pudo contactar el servidor de autenticación' }, { status: 502 });
    }
    // Apps Script responde 200 incluso en error: el fallo viene en j.ok/j.error.
    if (!j.ok || !j.data) {
      return NextResponse.json({ ok: false, error: 'Email o clave incorrectos' }, { status: 401 });
    }

    const { nombre, rol } = j.data;
    const value = await createSessionValue(nombre || email, rol || 'Usuario', email);
    const res = NextResponse.json({ ok: true, usuario: nombre, rol });
    res.cookies.set(SESSION_COOKIE, value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
