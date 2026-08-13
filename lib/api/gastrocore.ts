/**
 * GastroCore — Cliente de la API de Google Apps Script.
 *
 * IMPORTANTE (seguridad): este modulo SOLO debe ejecutarse en el servidor
 * (Server Components, Route Handlers). El token nunca se envia al navegador.
 */

import { conReintento, errorHttp } from '@/lib/reintento';
import { unstable_cache } from 'next/cache';
// server-only

const API_URL = process.env.GASTROCORE_API_URL;
const API_TOKEN = process.env.GASTROCORE_API_TOKEN;

export type ApiResponse<T> = {
  ok: boolean;
  data: T;
  meta?: { count?: number };
  error?: { code: string; message: string };
};

export type Insumo = {
  id: string;
  referencia: string;
  articulo: string;
  unidad: string;
  subfamilia: string;
  subfamilia_id: string;
  coste: number;
};

export type IngredienteReceta = {
  id?: string;
  receta_id?: string;
  tipo_item: 'insumo' | 'subreceta';
  item_id: string;
  cantidad: number;
  unidad_id: string;
  merma_pct: number;
  costo_unitario?: number;
  costo_linea?: number;
  orden?: number;
  nombre_item?: string;
};

export type Receta = {
  id: string;
  nombre: string;
  familia_id: string; // v9.4: las recetas clasifican por familia directa
  rendimiento: number;
  unidad_rendimiento_id: string;
  merma_pct: number;
  desvio_pct: number;
  costo_total: number;
  costo_porcion: number;
  food_cost: number;
  precio_sugerido: number;
  precio_real: number;
  margen_objetivo: number;
  iva?: number;
  activo: boolean | string;
  creado_en?: string;
  actualizado_en?: string;
  creado_por?: string;
  actualizado_por?: string;
  ingredientes?: IngredienteReceta[];
  historial?: HistorialReceta[];
};

export type HistorialReceta = {
  id: string;
  receta_id: string;
  accion: string;
  usuario: string;
  fecha: string;
  nombre: string;
  costo_total: number;
  costo_porcion: number;
  food_cost: number;
  precio_real: number;
  cambios: string;
  version?: number;
  origen?: string;
  campo?: string;
  valor_anterior?: string | number;
  valor_nuevo?: string | number;
  observaciones?: string;
  snapshot?: string;
};

export type Familia = { id: string; nombre: string; tipo?: string; activo: boolean | string };
export type Subfamilia = { id: string; familia_id: string; nombre: string; tipo?: string; activo: boolean | string };
export type Unidad = { id: string; codigo: string; nombre: string; tipo: string; activo: boolean | string };

// Item unificado del catalogo de ingredientes (insumo o subreceta).
export type CatalogoItem = {
  id: string;
  tipo_item: 'insumo' | 'subreceta';
  referencia: string;
  articulo: string;
  unidad: string;
  subfamilia: string;
  subfamilia_id: string;
  coste: number;
  merma_std?: number;
  rendimiento?: number;
  unidad_rendimiento_id?: string;
};

export type Dependencia = { id: string; nombre: string; es_subreceta: boolean; activo: boolean | string };

export type HistorialInsumo = {
  id: string;
  insumo_id: string;
  coste: number;
  fecha: string;
  usuario_id: string;
  coste_anterior: number;
  diferencia: number;
  motivo: string;
};

function assertConfig(): void {
  if (!API_URL || !API_TOKEN) {
    throw new Error('Faltan GASTROCORE_API_URL o GASTROCORE_API_TOKEN en las variables de entorno.');
  }
}

/** Contrato único de recursos: el backend y todas las claves de caché usan minúsculas. */
function normalizarRecurso(resource: string): string {
  const normalizado = String(resource || '').trim().toLowerCase();
  if (!normalizado) throw new Error('Recurso de API vacío');
  return normalizado;
}

// ── Caché de lecturas (v7) ──────────────────────────────────────────────────
// TTL DIFERENCIADO por recurso + STALE-WHILE-REVALIDATE: dentro del TTL se
// responde de memoria; vencido el TTL (pero dentro de la ventana de gracia)
// se responde AL INSTANTE con el dato viejo y se refresca en segundo plano.
// Solo la primera visita en frío espera a Apps Script. Vive por instancia de
// Vercel; el CacheService del backend (v7) cubre los arranques en frío.
type CacheEntry = { at: number; data: unknown };
const readCache = new Map<string, CacheEntry>();
const enVuelo = new Map<string, Promise<unknown>>(); // dedupe de peticiones simultáneas

// Segundos de frescura por recurso. Catálogos casi estáticos: largos;
// datos operativos: cortos. Cualquier mutación borra TODO el caché igual.
// v11.4 (mesa de rendimiento): TTLs generosos SIN riesgo de datos viejos —
// toda mutación purga el caché completo (revalidación central), así que la
// frescura la garantizan las escrituras, no el reloj. TTL largo = las
// lambdas calientes sirven al instante entre ediciones.
const TTL_POR_RECURSO: Record<string, number> = {
  familias: 600, subfamilias: 600, unidades: 600,
  insumos: 300, catalogo: 300, bootstrap: 300,
  analytics: 300, snapshots: 300,
  recetas: 300, subrecetas: 300,
  fichas: 120, historialrecetas: 120, ingredientes: 120, configfotos: 900, parametros: 600,
};
const TTL_DEFAULT = 120;
const VENTANA_GRACIA_MS = 10 * 60 * 1000; // hasta 10 min sirviendo viejo mientras refresca

/**
 * v10.10.5 — MAPA DE INVALIDACIÓN SELECTIVA.
 *
 * Antes, CUALQUIER escritura borraba el caché de lecturas COMPLETO de la
 * instancia — para todos los usuarios de esa lambda, no solo para quien
 * escribió. Con dos personas trabajando (una cargando precios en el Panel,
 * otra editando recetas) el caché nunca sobrevivía y toda la app iba en
 * frío: cada pantalla pagaba 1-3 s por llamada a Apps Script.
 *
 * Ahora cada recurso declara a QUIÉN afecta cuando se muta. La lista es un
 * SUPERCONJUNTO deliberado: incluye todo lo que la cascada del backend puede
 * tocar, aunque a veces no lo toque. Es preferible purgar de más que servir
 * un costo viejo.
 *
 * REGLA DE SEGURIDAD: un recurso que NO esté en este mapa purga TODO, igual
 * que antes. Así, si mañana aparece una entidad nueva y nadie actualiza este
 * mapa, el comportamiento vuelve solo al conservador — nunca a datos viejos.
 */
const AFECTA_CACHE: Record<string, string[]> = {
  // Editar un plato no toca insumos, catálogo, subrecetas ni familias.
  // (bootstrap SÍ, porque su payload incluye la lista de recetas.)
  recetas: ['recetas', 'ingredientes', 'historialrecetas', 'analytics', 'bootstrap', 'dependencias',
    // v10.11: los recursos de pantalla que llevan datos de recetas dentro.
    'pantallarecetas', 'pantallaeditorreceta', 'pantallafamilias'],
  // El puente empuja el costo de la subreceta a su insumo maestro: eso
  // escribe en Insumos y en PreciosHistoricos, y cascadea a las recetas.
  subrecetas: ['subrecetas', 'ingredientes', 'recetas', 'insumos', 'catalogo', 'precioshistoricos',
    'historialrecetas', 'analytics', 'bootstrap', 'dependencias',
    // v10.11: el puente escribe en Insumos, así que también toca los catálogos.
    'pantallaeditorsubreceta', 'pantallaeditorreceta', 'pantallarecetas',
    'pantallaconfiguracion', 'pantallafamilias'],
  // Cambiar el coste de un insumo cascadea a subrecetas y recetas.
  insumos: ['insumos', 'catalogo', 'precioshistoricos', 'subrecetas', 'recetas', 'ingredientes',
    'historialrecetas', 'analytics', 'bootstrap', 'dependencias',
    // v10.11: un cambio de coste cascadea a todo lo que lleve catálogo o costos.
    'pantallaeditorreceta', 'pantallaeditorsubreceta', 'pantallarecetas',
    'pantallaconfiguracion', 'pantallafamilias'],
  familias: ['familias', 'bootstrap', 'recetas', 'subrecetas', 'analytics',
    'pantallarecetas', 'pantallaeditorreceta', 'pantallafamilias', 'pantallaconfiguracion'],
  subfamilias: ['subfamilias', 'bootstrap', 'insumos', 'catalogo',
    'pantallaeditorsubreceta', 'pantallafamilias', 'pantallaconfiguracion'],
  fichas: ['fichas'],
  configfotos: ['configfotos', 'fichas'],
  analytics: ['analytics', 'snapshots'],
  // 'parametros' NO se lista adrede: guardar parámetros recalcula el menú
  // completo, así que cae en la regla de seguridad y purga todo.
};

/**
 * Borra del caché solo las entradas de los recursos indicados. Si recibe
 * null, borra todo (comportamiento previo a v10.10.5).
 */
function purgarCache_(recursos: string[] | null): void {
  if (recursos === null) {
    readCache.clear();
  } else {
    const afectados = new Set(recursos);
    // La clave es `recurso::params`; el recurso es lo que va antes de '::'.
    for (const clave of Array.from(readCache.keys())) {
      if (afectados.has(clave.split('::')[0])) readCache.delete(clave);
    }
  }
  // v10.6 + PUNTO 1 (v12): toda mutación purga el Data Cache CROSS-INSTANCE.
  //  · 'recetario': el recetario público (lib/recetario.ts, su propio fetch).
  //  · 'gc:read'  : purga TODAS las lecturas cacheadas (purga total).
  //  · 'gc:read:<recurso>': purga selectiva, misma lista que AFECTA_CACHE, pero
  //    ahora efectiva en TODAS las lambdas (el Map local solo purgaba la suya).
  import('next/cache')
    .then((m) => {
      m.revalidateTag('recetario', { expire: 0 });
      if (recursos === null) {
        m.revalidateTag('gc:read', { expire: 0 });
      } else {
        for (const r of recursos) m.revalidateTag('gc:read:' + r, { expire: 0 });
      }
    })
    .catch(() => { /* fuera de contexto server no aplica */ });
}

/** Borra todo el caché de lecturas. Se conserva para usos externos. */
export function limpiarCacheLecturas(): void {
  purgarCache_(null);
}

/**
 * v10.10.5 — Invalidación tras una mutación.
 * Si la escritura FALLÓ, purga todo por precaución (pudo quedar a medias).
 * Si tuvo éxito, purga solo lo que ese recurso puede haber afectado.
 */
function invalidarPorMutacion_(recurso: string, exito: boolean): void {
  recurso = normalizarRecurso(recurso);
  purgarCache_(exito ? (AFECTA_CACHE[recurso] ?? null) : null);
}

/**
 * v10.10.7 — El reintento vive ahora en lib/reintento.ts, compartido con el
 * recetario público (lib/recetario.ts), que tiene su propio fetch y quedaba
 * desprotegido. Aquí solo se arma el intento; la política de reintento es una
 * sola para toda la app. SOLO LECTURAS: apiPost y accionBackend no reintentan.
 */

/** Un intento de lectura. Adjunta el código HTTP para decidir si se reintenta. */
async function intentarLectura_<T>(
  resource: string,
  params: Record<string, string>
): Promise<ApiResponse<T>> {
  const res = await fetch(API_URL as string, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'read', resource, token: API_TOKEN, params }),
    cache: 'no-store',
  });
  if (!res.ok) throw errorHttp('Error de red al consultar la API: ' + res.status, res.status);
  return (await res.json()) as ApiResponse<T>;
}

// ════════════════════════════════════════════════════════════════════════════
//  PUNTO 1 (v12) — DATA CACHE CROSS-INSTANCE (Vercel), sobre el Map por instancia
// ════════════════════════════════════════════════════════════════════════════
// EL PROBLEMA QUE RESUELVE
// El Map de arriba (readCache) es EXCELENTE... pero vive DENTRO de cada lambda
// de Vercel. Vercel levanta y apaga instancias todo el tiempo, así que la
// mayoría de las "primeras cargas" caen en una lambda con el Map vacío y pagan
// el piso de Apps Script (redirect 302 + arranque del runtime + abrir el Sheet
// = 1 a 4 s), aunque OTRA lambda ya tuviera el dato calentito. Ese es,
// medido, el motivo de que las vistas se sientan lentas pese a que los datos
// son diminutos.
//
// LA SOLUCIÓN
// unstable_cache guarda el RESULTADO de la lectura en el Data Cache de Vercel,
// que es COMPARTIDO entre todas las instancias y sobrevive a los arranques en
// frío. Así, una lambda nueva sirve el dato del Data Cache en ~decenas de ms y
// NO toca Apps Script. La frescura se mantiene igual que hoy: cada mutación
// purga por tag (revalidateTag) exactamente los mismos recursos que ya declara
// AFECTA_CACHE — pero ahora la purga cruza TODAS las instancias, cosa que el
// Map por instancia nunca pudo hacer (otra lambda seguía sirviendo viejo hasta
// el TTL). Es decir: más rápido Y más consistente.
//
// REGLA DE ORO CONSERVADA: un ok:false NUNCA se cachea. Se marca con throw para
// que unstable_cache no lo guarde, y se recupera intacto fuera del caché.
class RespuestaNoCacheable_ extends Error {
  json: ApiResponse<unknown>;
  constructor(json: ApiResponse<unknown>) {
    super('respuesta-no-cacheable');
    this.json = json;
  }
}

function leerConDataCache_<T>(
  resource: string,
  params: Record<string, string>,
  ttlSeg: number
): Promise<ApiResponse<T>> {
  // La clave del Data Cache la fijan los keyParts (recurso + params). El TTL
  // actúa solo como RED DE SEGURIDAD: la frescura real la da la purga por tag
  // en cada escritura. El reintento vive DENTRO para que solo ocurra en un
  // fallo de caché (nunca cuando el dato ya está guardado).
  const cacheado = unstable_cache(
    async (): Promise<ApiResponse<T>> => {
      const json = await conReintento(() => intentarLectura_<T>(resource, params));
      if (!json || json.ok !== true) {
        throw new RespuestaNoCacheable_(json as ApiResponse<unknown>);
      }
      return json;
    },
    ['gc-read', resource, JSON.stringify(params)],
    { revalidate: ttlSeg, tags: ['gc:read', 'gc:read:' + resource] }
  );
  return cacheado().catch((e) => {
    // ok:false → se devuelve tal cual, SIN haber quedado cacheado.
    if (e instanceof RespuestaNoCacheable_) return e.json as ApiResponse<T>;
    throw e; // error de red real tras agotar reintentos
  });
}

async function descargar<T>(
  cacheKey: string,
  resource: string,
  params: Record<string, string>
): Promise<ApiResponse<T>> {
  // Dedupe: si ya hay una petición idéntica en vuelo, únete a ella.
  const pendiente = enVuelo.get(cacheKey);
  if (pendiente) return pendiente as Promise<ApiResponse<T>>;

  const ttlSeg = (TTL_POR_RECURSO[resource] ?? TTL_DEFAULT);
  const promesa = leerConDataCache_<T>(resource, params, ttlSeg)
    .then((json) => {
      // El Map por instancia (L1) sigue sirviendo de acelerador local: si la
      // lectura fue buena, se guarda para respuestas instantáneas dentro de
      // ESTA lambda. El ok:false ya viene sin cachear desde el Data Cache.
      if (json && json.ok) {
        readCache.set(cacheKey, { at: Date.now(), data: json });
      }
      return json;
    })
    .finally(() => enVuelo.delete(cacheKey));

  enVuelo.set(cacheKey, promesa);
  return promesa;
}

/**
 * Lectura de datos. IMPORTANTE (seguridad): el token viaja SIEMPRE en el body
 * de un POST, nunca en la query string de la URL. Esto evita que el secreto
 * quede registrado en logs de red, de Vercel o de intermediarios.
 *
 * Requiere que el backend de Apps Script maneje `mode: 'read'` en doPost
 * (ver README, sección "Backend: lectura por POST").
 */
async function apiGet<T>(
  resource: string,
  params: Record<string, string> = {},
  ttlSeconds?: number
): Promise<ApiResponse<T>> {
  assertConfig();
  resource = normalizarRecurso(resource);

  const ttlMs = (ttlSeconds ?? TTL_POR_RECURSO[resource] ?? TTL_DEFAULT) * 1000;
  const cacheKey = resource + '::' + JSON.stringify(params);
  let hit = readCache.get(cacheKey);
  // Defensa extra: si algo invalido llego al cache, se descarta.
  if (hit && !(hit.data as ApiResponse<unknown>)?.ok) {
    readCache.delete(cacheKey);
    hit = undefined;
  }
  const edad = hit ? Date.now() - hit.at : Infinity;

  // Fresco: directo de memoria (0 ms).
  if (hit && edad < ttlMs) return hit.data as ApiResponse<T>;

  // Vencido pero dentro de la gracia: responder YA con lo viejo y refrescar
  // en segundo plano (mejor esfuerzo: si la instancia se congela antes de
  // terminar, la próxima petición lo refresca — y el caché compartido del
  // backend v7 hace que ese refresco cueste <1s).
  if (hit && edad < VENTANA_GRACIA_MS) {
    void descargar<T>(cacheKey, resource, params).catch(() => {});
    return hit.data as ApiResponse<T>;
  }

  // Frío o demasiado viejo: hay que esperar. Si la red falla y existe un dato
  // viejo, mejor servir eso que reventar la página.
  try {
    return await descargar<T>(cacheKey, resource, params);
  } catch (err) {
    if (hit) return hit.data as ApiResponse<T>;
    throw err;
  }
}


/**
 * v10.11.7 — ESCRITURA CON SEGUIMIENTO MANUAL DEL REDIRECT.
 *
 * EL PROBLEMA QUE RESUELVE
 * Apps Script no contesta el POST directamente: responde 302 hacia una URL de
 * script.googleusercontent.com donde deja el resultado. Ese 302 significa que
 * EL SCRIPT YA CORRIÓ — es decir, la escritura en la hoja YA OCURRIÓ. Si el
 * segundo viaje (ir a recoger la respuesta) falla con 404, el fetch automático
 * lo reporta como si toda la operación hubiera fallado.
 *
 * Consecuencia real medida en producción: el usuario veía "Error de red al
 * escribir en la API: 404" con el dato YA guardado, volvía a guardar, y se
 * creaba un duplicado (así nació SUB. CHIMICHURRI NANPRIK dos veces).
 *
 * LA SOLUCIÓN
 * Seguimos el redirect a mano. Así distinguimos dos situaciones que antes se
 * veían iguales:
 *   · No hubo 3xx  → el script NO corrió → error de red normal, se puede reintentar.
 *   · Hubo 3xx pero no pudimos leer la respuesta → el script SÍ corrió → se
 *     lanza EscrituraSinConfirmar, que le dice al usuario que NO reintente.
 *
 * NUNCA se repite el POST dentro de esta función: repetirlo sería duplicar.
 */
export class EscrituraSinConfirmar extends Error {
  readonly guardado = true;
  constructor(detalle: string) {
    super(
      'Se guardó, pero no pudimos leer la confirmación del servidor (' + detalle + '). ' +
      'Recarga la página para verlo. NO vuelvas a guardar: se duplicaría.'
    );
    this.name = 'EscrituraSinConfirmar';
  }
}

export async function postAppsScript<T>(cuerpo: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(API_URL as string, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    cache: 'no-store',
    redirect: 'manual',
  });

  // 3xx = el script ya se ejecutó y nos manda a recoger el resultado.
  if (res.status >= 300 && res.status < 400) {
    const destino = res.headers.get('location');
    if (!destino) throw new EscrituraSinConfirmar('redirect sin destino');
    const res2 = await fetch(destino, { cache: 'no-store' });
    if (!res2.ok) throw new EscrituraSinConfirmar('HTTP ' + res2.status);
    return (await res2.json()) as ApiResponse<T>;
  }

  // Runtime que oculta el redirect (Edge): tampoco podemos leer el resultado,
  // pero el script YA corrió. No se reintenta.
  if (res.status === 0 || (res as Response & { type?: string }).type === 'opaqueredirect') {
    throw new EscrituraSinConfirmar('redirect opaco');
  }

  if (!res.ok) throw new Error('Error de red al escribir en la API: ' + res.status);
  return (await res.json()) as ApiResponse<T>;
}

async function apiPost<T>(
  resource: string,
  action: 'create' | 'update' | 'delete' | 'setActivo' | 'restaurar' | 'simular' | 'snapshot',
  payload: { id?: string; data?: unknown }
): Promise<ApiResponse<T>> {
  assertConfig();
  resource = normalizarRecurso(resource);
  try {
    const json = await postAppsScript<T>({ resource, action, token: API_TOKEN, ...payload });
    // v10.10.5: la invalidación ahora es SELECTIVA (ver AFECTA_CACHE). Un insumo
    // creado sigue apareciendo en el catálogo AL INSTANTE, pero editar un plato
    // ya no tumba el catálogo ni las subrecetas de los demás usuarios.
    invalidarPorMutacion_(resource, (json as { ok?: boolean }).ok === true);
    return json;
  } catch (e) {
    // v10.11.7: si el script SÍ corrió, los datos cambiaron aunque no hayamos
    // podido leer la respuesta. Purgar igual, o la app seguiría mostrando lo viejo.
    if (e instanceof EscrituraSinConfirmar) invalidarPorMutacion_(resource, true);
    throw e;
  }
}

// ---------- INSUMOS ----------
export async function getInsumos(): Promise<Insumo[]> {
  const r = await apiGet<Insumo[]>('insumos');
  return r.ok ? r.data : [];
}
export async function getInsumo(id: string): Promise<Insumo | null> {
  const r = await apiGet<Insumo>('insumos', { id });
  return r.ok ? r.data : null;
}
export async function actualizarCosteInsumo(id: string, coste: number) {
  return apiPost<Insumo>('insumos', 'update', { id, data: { coste } });
}

// ---------- RECETAS ----------
export async function getRecetas(all = false): Promise<Receta[]> {
  const r = await apiGet<Receta[]>('recetas', all ? { all: 'true' } : {});
  return r.ok ? r.data : [];
}

export async function getReceta(id: string): Promise<Receta | null> {
  // v7.3: el backend getById ya devuelve la receta CON sus ingredientes y los
  // nombres resueltos, y el historial llega filtrado y SIN los snapshots
  // pesados. Antes: 4 descargas de tablas completas; ahora: 2 llamadas finas.
  const [r, historial] = await Promise.all([
    apiGet<Receta>('recetas', { id }),
    getHistorialReceta(id).catch(() => []),
  ]);
  if (!r.ok || !r.data) return null;
  const receta = r.data;
  receta.historial = historial;
  return receta;
}

/** Receta puntual SIN historial (para pantallas que solo necesitan la base). */
export async function getRecetaPorId(id: string): Promise<Receta | null> {
  const r = await apiGet<Receta>('recetas', { id });
  return r.ok ? r.data : null;
}

/**
 * v10.14.2 — "NO EXISTE" Y "NO PUDE LEERLA" NO SON LO MISMO.
 *
 * Los helpers de arriba devuelven null en los DOS casos, y las páginas de
 * detalle lo traducían a notFound(): el usuario veía "esta receta no existe"
 * cuando en realidad la lectura se había caído. Con el reintento agotando sus
 * tres intentos, eso podía tardar ~28 s antes de mentir (caso real 4/ago).
 *
 * Este helper distingue:
 *   · devuelve null  → el backend contestó bien y esa receta NO está.
 *   · LANZA          → no se pudo leer; el motivo real viaja en el mensaje.
 */
export async function getRecetaPorIdEstricto(id: string): Promise<Receta | null> {
  const r = await apiGet<Receta>('recetas', { id });
  if (!r.ok) {
    const e = (r as { error?: { message?: string } | string }).error;
    const msg = typeof e === 'string' ? e : (e && e.message) || 'El backend no respondió correctamente.';
    throw new Error(String(msg));
  }
  return r.data ?? null;
}

/**
 * v10.14.2 — Contexto liviano para la FICHA de una receta: familias y
 * parámetros de costeo, SIN el catálogo.
 *
 * La ficha reutilizaba 'pantallaeditorreceta', que carga el catálogo completo
 * (38,7 KB de 266 insumos) — y esa pantalla NO usa ni un insumo del catálogo.
 * Peor: las lecturas CON id se saltan el caché de Apps Script, así que el
 * backend reconstruía el catálogo entero en CADA visita. 'pantallarecetas' sí
 * está cacheado (60 s) y trae lo que la ficha necesita.
 * Medido con la base real: 42,1 KB → 8,7 KB.
 */
export async function getContextoCosteo(): Promise<{ familias: Familia[]; parametros: Record<string, unknown> }> {
  const r = await apiGet<PantallaRecetas>('pantallarecetas');
  if (!r.ok || !r.data) return { familias: [], parametros: {} };
  return { familias: r.data.familias || [], parametros: r.data.parametros || {} };
}

export async function getHistorialReceta(recetaId: string): Promise<HistorialReceta[]> {
  const r = await apiGet<HistorialReceta[]>('historialrecetas', { receta_id: recetaId });
  const arr = r.ok && Array.isArray(r.data) ? r.data : [];
  return arr
    .filter((h) => String(h.receta_id) === String(recetaId))
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

export async function getIngredientesReceta(recetaId: string): Promise<IngredienteReceta[]> {
  const r = await apiGet<IngredienteReceta[]>('ingredientes', { receta_id: recetaId });
  const arr = r.ok && Array.isArray(r.data) ? r.data : [];
  return arr.filter((g) => !recetaId || g.receta_id === recetaId);
}

export async function crearReceta(data: Partial<Receta>) {
  return apiPost<Receta>('recetas', 'create', { data });
}
export async function actualizarReceta(id: string, data: Partial<Receta>) {
  return apiPost<Receta>('recetas', 'update', { id, data });
}

export async function setActivoReceta(id: string, activo: boolean) {
  return apiPost<Receta>('recetas', 'setActivo', { id, data: { activo } });
}

export async function restaurarVersion(id: string, version: number, usuario?: string) {
  return apiPost<Receta>('recetas', 'restaurar', { data: { id, version, usuario: usuario || 'Sistema', _origen: 'Web' } });
}

export async function crearFamilia(data: { nombre: string; tipo?: string; activo?: boolean; centrocosto?: string }) {
  return apiPost<Familia>('familias', 'create', { data: { tipo: 'receta', activo: true, ...data } });
}
export async function crearSubfamilia(data: { familia_id: string; nombre: string; tipo?: string; activo?: boolean; centrocosto?: string }) {
  return apiPost<Subfamilia>('subfamilias', 'create', { data: { tipo: 'receta', activo: true, ...data } });
}

export async function actualizarFamilia(id: string, data: { nombre?: string; activo?: boolean; centrocosto?: string }) {
  return apiPost<Familia>('familias', 'update', { id, data });
}
export async function desactivarFamilia(id: string) {
  return apiPost<Familia>('familias', 'update', { id, data: { activo: false } });
}
export async function actualizarSubfamilia(id: string, data: { nombre?: string; familia_id?: string; activo?: boolean; centrocosto?: string }) {
  return apiPost<Subfamilia>('subfamilias', 'update', { id, data });
}
export async function desactivarSubfamilia(id: string) {
  return apiPost<Subfamilia>('subfamilias', 'update', { id, data: { activo: false } });
}

// ---------- CATALOGOS ----------
export async function getFamilias(): Promise<Familia[]> {
  const r = await apiGet<Familia[]>('familias');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}
export async function getSubfamilias(): Promise<Subfamilia[]> {
  const r = await apiGet<Subfamilia[]>('subfamilias');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}
export async function getUnidades(): Promise<Unidad[]> {
  const r = await apiGet<Unidad[]>('unidades');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}


// ---------- CATALOGO UNIFICADO (insumos + subrecetas) ----------
export type Bootstrap = {
  familias: Familia[];
  subfamilias: Subfamilia[];
  unidades: Unidad[];
  catalogo: CatalogoItem[];
};

/** Carga inicial del editor: 4 catálogos en UNA llamada al backend. */
export type FichaTecnica = {
  id?: string; receta_id: string; descripcion?: string; preparacion?: string;
  emplatado?: string; notas?: string; foto_url?: string; foto_id?: string;
  tiempo_min?: string | number; gramaje_porcion?: string | number;
};

/** Ficha técnica de una receta (cacheada 20 s). */
export async function getFicha(recetaId: string): Promise<FichaTecnica | null> {
  const r = await apiGet<FichaTecnica[]>('fichas', { receta_id: recetaId });
  return r.ok && Array.isArray(r.data) ? r.data[0] || null : null;
}

/** Carpeta de fotos de Drive (cacheada 10 min: cambia casi nunca). */
export type Parametros = {
  nombre_negocio?: string;
  fc_objetivo: number;
  fc_por_familia: Record<string, number>;
  impuesto_pct: number;
  alerta_subida_pct: number;
  familias?: { id: string; nombre: string; tipo: string }[];
};

/** Parámetros de negocio (FC objetivo, impuesto, umbral de alertas). Cache 5 min. */
export async function getParametros(): Promise<Parametros | null> {
  const r = await apiGet<Parametros>('parametros');
  return r.ok ? r.data : null;
}

export async function getConfigFotos(): Promise<{ folder_id: string; nombre: string; url: string } | null> {
  const r = await apiGet<{ folder_id: string; nombre: string; url: string }>('configfotos');
  return r.ok ? r.data : null;
}

/**
 * Acción de escritura genérica (guardar ficha, subir foto, renombrar carpeta…).
 * Pasa por la misma limpieza de caché que apiPost: tras mutar, la próxima
 * lectura trae lo nuevo.
 */
export async function accionBackend<T>(
  resource: string,
  action: string,
  payload: { id?: string; data?: unknown }
): Promise<ApiResponse<T>> {
  assertConfig();
  resource = normalizarRecurso(resource);
  try {
    const json = await postAppsScript<T>({ resource, action, token: API_TOKEN, ...payload });
    // v10.10.5: la invalidación ahora es SELECTIVA (ver AFECTA_CACHE). Un insumo
    // creado sigue apareciendo en el catálogo AL INSTANTE, pero editar un plato
    // ya no tumba el catálogo ni las subrecetas de los demás usuarios.
    invalidarPorMutacion_(resource, (json as { ok?: boolean }).ok === true);
    return json;
  } catch (e) {
    // v10.11.7: si el script SÍ corrió, los datos cambiaron aunque no hayamos
    // podido leer la respuesta. Purgar igual, o la app seguiría mostrando lo viejo.
    if (e instanceof EscrituraSinConfirmar) invalidarPorMutacion_(resource, true);
    throw e;
  }
}

export async function getBootstrap(): Promise<Bootstrap | null> {
  const r = await apiGet<Bootstrap>('bootstrap');
  return r.ok ? r.data : null;
}

// ---------- v10.11: RECURSOS DE PANTALLA (un viaje por pantalla) ----------
/**
 * Cada pantalla pide UN recurso con exactamente lo que pinta, en vez de
 * abrir 2-6 llamadas en paralelo. Sin id = modo creación/listado; con id =
 * la misma pantalla abriendo ese registro (viene con sus líneas).
 * Los recursos sueltos (catalogo, familias, subfamilias…) siguen existiendo
 * para las pantallas que aún no se migran.
 */
export type PantallaEditorSubreceta = {
  catalogo: CatalogoItem[];
  subfamilias: Subfamilia[];
  unidades: Unidad[];
  enlazados: string[];
  subreceta: Receta | null;
};

export type PantallaFamilias = {
  familias: Familia[];
  subfamilias: (Familia & { familia_id?: string })[];
  uso_familias: Record<string, number>;
  uso_subfamilias: Record<string, number>;
  recetas: { nombre: string; familia_id?: string }[];
  insumos: { articulo: string; subfamilia_id?: string }[];
};

/** /recetas/familias en una sola llamada (antes: familias + subfamilias + recetas + insumos). */
export async function getPantallaFamilias(): Promise<PantallaFamilias | null> {
  const r = await apiGet<PantallaFamilias>('pantallafamilias');
  return r.ok && r.data ? r.data : null;
}

export type PantallaConfiguracion = {
  parametros: Record<string, unknown>;
  familias: Familia[];
  mermas: { id: string; articulo: string; unidad?: string; merma_std: number }[];
};

/** /configuracion en una sola llamada (antes: 6 peticiones al montar). */
export async function getPantallaConfiguracion(): Promise<PantallaConfiguracion | null> {
  const r = await apiGet<PantallaConfiguracion>('pantallaconfiguracion');
  return r.ok && r.data ? r.data : null;
}

export type PantallaRecetas = {
  recetas: Receta[];
  familias: Familia[];
  parametros: Record<string, unknown>;
};

/** Listado /recetas y Panel /recetas/resumen en una sola llamada. */
export async function getPantallaRecetas(): Promise<PantallaRecetas | null> {
  const r = await apiGet<PantallaRecetas>('pantallarecetas');
  return r.ok && r.data ? r.data : null;
}

export type PantallaEditorReceta = {
  catalogo: CatalogoItem[];
  familias: Familia[];
  parametros: Record<string, unknown>;
  referencias: { id: string; referencia?: string }[];
  receta: Receta | null;
};

export async function getPantallaEditorReceta(id?: string): Promise<PantallaEditorReceta | null> {
  const r = await apiGet<PantallaEditorReceta>('pantallaeditorreceta', id ? { id } : undefined);
  return r.ok && r.data ? r.data : null;
}

export async function getPantallaEditorSubreceta(id?: string): Promise<PantallaEditorSubreceta | null> {
  const r = await apiGet<PantallaEditorSubreceta>('pantallaeditorsubreceta', id ? { id } : undefined);
  return r.ok && r.data ? r.data : null;
}

export async function getCatalogo(): Promise<CatalogoItem[]> {
  const r = await apiGet<CatalogoItem[]>('catalogo');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

// ---------- SUBRECETAS (preparaciones base) ----------
export async function getSubrecetas(all = false): Promise<Receta[]> {
  const r = await apiGet<Receta[]>('subrecetas', all ? { all: 'true' } : {});
  return r.ok && Array.isArray(r.data) ? r.data : [];
}
export async function getSubreceta(id: string): Promise<Receta | null> {
  // v9.11.1: pedir al recurso SUBRECETAS (el fósil pedía a recetas — del
  // mundo pre-v9, cuando las subrecetas vivían en la hoja Recetas).
  const r = await apiGet<Receta>('subrecetas', { id });
  return r.ok && r.data ? (r.data as Receta) : null;
}
export async function crearSubreceta(data: Partial<Receta>) {
  return apiPost<Receta>('subrecetas', 'create', { data });
}
export async function actualizarSubreceta(id: string, data: Partial<Receta>) {
  return apiPost<Receta>('subrecetas', 'update', { id, data });
}
export async function setActivoSubreceta(id: string, activo: boolean) {
  return apiPost<Receta>('subrecetas', 'setActivo', { id, data: { activo } });
}

// ---------- DEPENDENCIAS (recetas que usan un item) ----------
export async function getDependencias(itemId: string): Promise<Dependencia[]> {
  const r = await apiGet<Dependencia[]>('dependencias', { item_id: itemId });
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

// ---------- INSUMOS: edicion con trazabilidad ----------
export async function actualizarInsumo(id: string, data: Partial<Insumo> & { motivo?: string; usuario?: string }) {
  return apiPost<Insumo>('insumos', 'update', { id, data });
}

export async function getHistorialInsumo(insumoId: string): Promise<HistorialInsumo[]> {
  const r = await apiGet<HistorialInsumo[]>('precioshistoricos');
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data
    .filter((h) => h.insumo_id === insumoId)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}


// ---------- ANALYTICS / BI: variacion de costos ----------
export type TopMover = {
  id: string;
  referencia: string;
  articulo: string;
  subfamilia: string;
  subfamilia_id: string;
  coste_base: number;
  coste_actual: number;
  variacion_abs: number;
  variacion_pct: number;
  cambios: number;
  ultima_fecha: string;
};

export type ImpactoMenu = {
  receta_id: string;
  receta: string;
  insumo: string;
  insumo_id: string;
  variacion_pct: number;
  incremento_costo: number;
  food_cost: number;
  fuera_objetivo: boolean;
};

export type VariacionFamilia = { familia: string; variacion_pct: number };
export type EvolucionPunto = { fecha: string; costo_promedio: number };
export type Alerta = { nivel: 'rojo' | 'amarillo' | 'verde'; mensaje: string };

export type AnalyticsData = {
  generado_en: string;
  food_cost_objetivo: number;
  top_aumentos: TopMover[];
  top_reducciones: TopMover[];
  impacto_menu: ImpactoMenu[];
  variacion_familia: VariacionFamilia[];
  indicadores: {
    insumo_mas_inflacionario: TopMover | null;
    receta_mas_afectada: ImpactoMenu | null;
    variacion_promedio: number;
    recetas_fuera_objetivo: number;
  };
  evolucion_costo: EvolucionPunto[];
  food_cost_promedio: number;
  alertas: Alerta[];
  total_insumos: number;
  insumos_con_variacion: number;
};

export type SimulacionReceta = {
  receta_id: string;
  nombre: string;
  costo_actual: number;
  costo_nuevo: number;
  incremento: number;
  food_cost_actual: number;
  food_cost_nuevo: number;
  precio_real: number;
  precio_sugerido_nuevo: number;
  rentable: boolean;
  fuera_objetivo: boolean;
};

export type SimulacionResult = {
  insumo_id: string;
  articulo: string;
  precio_actual: number;
  nuevo_precio: number;
  variacion_pct: number;
  recetas: SimulacionReceta[];
};

export type SnapshotSemanal = {
  id: string;
  fecha: string;
  hora: string;
  usuario: string;
  cantidad_insumos: number;
  costo_promedio: number;
  insumos_modificados: number;
  nota: string;
};

export type PuntoHistorial = { fecha: string; coste: number; motivo?: string };

export async function getAnalytics(): Promise<AnalyticsData | null> {
  const r = await apiGet<AnalyticsData>('analytics');
  return r.ok ? r.data : null;
}

export async function getHistorialInsumoGrafica(insumoId: string): Promise<PuntoHistorial[]> {
  const r = await apiGet<PuntoHistorial[]>('analytics', { action: 'historialInsumo', item_id: insumoId });
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

export async function getSnapshots(): Promise<SnapshotSemanal[]> {
  const r = await apiGet<SnapshotSemanal[]>('snapshots');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

export async function simularImpacto(insumoId: string, nuevoPrecio: number): Promise<SimulacionResult | null> {
  const r = await apiPost<SimulacionResult>('analytics', 'simular', { data: { insumo_id: insumoId, nuevo_precio: nuevoPrecio } });
  return r.ok ? r.data : null;
}

export async function generarSnapshot(usuario?: string) {
  return apiPost('analytics', 'snapshot', { data: { usuario: usuario || 'Sistema' } });
}
