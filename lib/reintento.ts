/**
 * v10.10.7 — REINTENTO DE LECTURAS (módulo compartido).
 *
 * POR QUÉ EXISTE
 * Apps Script atiende el /exec mediante una redirección interna. Cuando una
 * pantalla se abre, se disparan varias lecturas casi al mismo tiempo, y bajo
 * esa concurrencia Google pierde alguna y responde 404 o 5xx SIN llegar a
 * ejecutar el script — por eso el log de Ejecuciones se ve impecable: solo
 * registra las peticiones que sí llegaron. Una sola lectura perdida dejaba
 * un desplegable vacío, un formulario en blanco o el recetario caído.
 *
 * POR QUÉ ESTÁ AQUÍ Y NO DENTRO DE UN ARCHIVO
 * En v10.10.6 el reintento vivía dentro de lib/api/gastrocore.ts, así que
 * protegía a la app privada pero NO al recetario público, que tiene su propio
 * fetch en lib/recetario.ts. Ese hueco fue exactamente lo que tumbó el
 * recetario. Ahora hay UNA sola implementación y ambos la usan: si mañana
 * aparece un tercer camino de lectura, importa este módulo y queda protegido.
 *
 * LÍMITE INNEGOCIABLE
 * Esto es SOLO para LECTURAS, que son idempotentes: pedir dos veces el mismo
 * dato no cambia nada. Las ESCRITURAS no se reintentan JAMÁS — repetir un
 * guardado podría duplicar filas o recostear dos veces.
 */

export type ErrorHttp = Error & { estado?: number; definitivo?: boolean };

/** 2 reintentos = 3 intentos en total. */
export const REINTENTOS_LECTURA = 2;
/** Pausa antes de cada reintento (backoff). */
export const ESPERA_REINTENTO_MS = [250, 750];
/**
 * Códigos que valen la pena reintentar. Deliberadamente NO incluye 401
 * (sesión expirada) ni 403 (rol sin permiso): esos no son transitorios y
 * deben fallar de inmediato para que el usuario vea el motivo real.
 */
export const ESTADOS_REINTENTABLES = new Set([404, 408, 425, 429, 500, 502, 503, 504]);

/** Error de transporte con su código HTTP, para poder decidir si se reintenta. */
export function errorHttp(mensaje: string, estado: number): ErrorHttp {
  const e = new Error(mensaje) as ErrorHttp;
  e.estado = estado;
  return e;
}

/**
 * Error de negocio: el backend respondió bien pero dijo que no.
 * Reintentarlo sería inútil, así que se marca como definitivo.
 */
export function errorDefinitivo(mensaje: string): ErrorHttp {
  const e = new Error(mensaje) as ErrorHttp;
  e.definitivo = true;
  return e;
}

/** ¿Vale la pena volver a intentar este error? */
export function esTransitorio(e: unknown): boolean {
  if (!e || typeof e !== 'object') return true;
  if ((e as ErrorHttp).definitivo) return false;
  const estado = (e as ErrorHttp).estado;
  // Sin código HTTP = fallo de red o respuesta ilegible (Apps Script a veces
  // devuelve una página de error en vez de JSON): también es transitorio.
  return estado === undefined || ESTADOS_REINTENTABLES.has(estado);
}

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Ejecuta una lectura y la reintenta si falla por algo transitorio.
 * Si se agotan los intentos, lanza el ÚLTIMO error real (no uno genérico),
 * para que el mensaje que ve el usuario diga qué pasó de verdad.
 */
export async function conReintento<T>(operacion: () => Promise<T>): Promise<T> {
  let ultimoError: unknown = null;
  for (let intento = 0; intento <= REINTENTOS_LECTURA; intento++) {
    if (intento > 0) await esperar(ESPERA_REINTENTO_MS[intento - 1] ?? 750);
    try {
      return await operacion();
    } catch (e) {
      ultimoError = e;
      if (!esTransitorio(e)) throw e;
    }
  }
  throw ultimoError ?? new Error('No se pudo leer del backend.');
}
