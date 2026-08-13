'use client';

/**
 * COLA DE GUARDADO UNIVERSAL (v7.9)
 * ─────────────────────────────────
 * Todos los botones de guardar/editar/subir foto pasan por aquí. Garantiza:
 *
 *  1. SERIALIZACIÓN: las escrituras salen UNA A LA VEZ (encadenadas), nunca
 *     se pisan entre sí aunque el usuario dispare varias seguidas.
 *  2. ANTI DOBLE-CLIC: si llega una petición IDÉNTICA (misma URL, método y
 *     cuerpo) mientras la original sigue pendiente, se reutiliza la misma
 *     promesa — el doble clic no duplica nada.
 *  3. REINTENTOS INTELIGENTES: el backend tiene un candado global de
 *     escritura (varios usuarios editando a la vez). Si responde "ocupado"
 *     (429/503/504, o un 5xx cuyo mensaje huele a lock/bloqueo/timeout),
 *     se reintenta con espera creciente: 0.8s → 1.6s → 3.2s.
 *     IMPORTANTE: solo se reintenta cuando el backend RECHAZÓ sin escribir
 *     (señales de candado). Un error de red genérico NO se reintenta, para
 *     no duplicar creaciones.
 */

class ErrorReintentable extends Error {}

let cadena: Promise<unknown> = Promise.resolve();
const pendientes = new Map<string, Promise<Response>>();

const PAUSAS_MS = [800, 1600, 3200];

function esSenalDeOcupado(status: number, mensaje: string): boolean {
  if (status === 423 || status === 429 || status === 503 || status === 504) return true;
  return status >= 500 && /lock|bloqueo|bloquear|ocupad|otra edici|espera|timeout/i.test(mensaje);
}

async function intentarUnaVez(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status >= 400) {
    let mensaje = '';
    try {
      const j = await res.clone().json();
      mensaje = String((j && (j.error?.message || j.error)) || '');
    } catch { /* cuerpo no-JSON: seguimos con el status */ }
    if (esSenalDeOcupado(res.status, mensaje)) {
      throw new ErrorReintentable(mensaje || 'Servidor ocupado (' + res.status + ')');
    }
  }
  return res; // los demás estados los decide el botón que llamó
}

async function conReintentos(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let intento = 0; ; intento++) {
    try {
      return await intentarUnaVez(input, init);
    } catch (e) {
      const puedeReintentar = e instanceof ErrorReintentable && intento < PAUSAS_MS.length;
      if (!puedeReintentar) throw e;
      await new Promise((r) => setTimeout(r, PAUSAS_MS[intento]));
    }
  }
}

/**
 * Reemplazo directo de fetch() para MUTACIONES (POST/PUT/PATCH/DELETE).
 * Misma firma, mismo retorno: cambiar `fetch(` por `fetchEnCola(` basta.
 */
export function fetchEnCola(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const clave = String(input) + '|' + (init?.method || 'GET') + '|' + (typeof init?.body === 'string' ? init.body : '');
  const existente = pendientes.get(clave);
  if (existente) return existente.then((r) => r.clone()); // doble clic: misma respuesta

  const tarea = cadena.then(
    () => conReintentos(input, init),
    () => conReintentos(input, init), // un fallo previo no bloquea la cola
  );
  cadena = tarea.catch(() => {});
  pendientes.set(clave, tarea);
  tarea.finally(() => pendientes.delete(clave)).catch(() => {});
  return tarea;
}
