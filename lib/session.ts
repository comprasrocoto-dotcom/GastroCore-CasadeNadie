/**
 * Lectura de la sesión desde el lado servidor (route handlers / Server
 * Components). Vive separado de `lib/auth.ts` porque importa `next/headers`,
 * que NO debe importarse desde el proxy.
 */
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionValue, type Session } from '@/lib/auth';

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  return verifySessionValue(value);
}

/**
 * Devuelve el nombre del usuario autenticado (firmado en la cookie), o el
 * fallback. Usar esto en las mutaciones en lugar de confiar en el body del
 * cliente para la trazabilidad.
 */
export async function getUsuario(fallback = 'Sistema'): Promise<string> {
  const s = await getSession();
  return s?.u || fallback;
}

/** Rol del usuario autenticado ('Admin', etc.), firmado en la cookie. */
export async function getRol(fallback = ''): Promise<string> {
  const s = await getSession();
  return s?.r || fallback;
}

/** True si la sesión actual pertenece a un Admin. */
export async function esAdmin(): Promise<boolean> {
  const rol = await getRol();
  return rol.trim().toLowerCase() === 'admin';
}
