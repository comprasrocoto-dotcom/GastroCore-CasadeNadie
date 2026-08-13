/**
 * GastroCore — Datos del recetario público (SOLO servidor).
 *
 * La vista de cocina NO tiene login: estas funciones corren en el servidor de
 * Vercel, llaman al Apps Script con el token (que nunca llega al navegador) y
 * cachean el resultado 5 minutos — el mismo ritmo de refresco que tenía el
 * Recetario Malanga original. El admin edita y cocina lo ve en ≤5 min.
 */
import { unstable_cache } from 'next/cache';
import { conReintento, errorHttp, errorDefinitivo } from '@/lib/reintento';

const API_URL = process.env.GASTROCORE_API_URL || '';
const API_TOKEN = process.env.GASTROCORE_API_TOKEN || '';

export type IngredienteRecetario = {
  nombre: string;
  tipo_item: 'insumo' | 'subreceta';
  cantidad: number;
  unidad: string;
  merma_pct: number;
  costo_linea: number;
};

export type FichaRecetario = {
  preparacion: string;
  emplatado: string;
  notas: string;
  foto_url: string;
  tiempo_min: string | number;
  gramaje_porcion: string | number;
};

export type RecetaPublica = {
  id: string;
  nombre: string;
  categoria: string;
  subcategoria: string;
  centro_costo?: string; // v9.5
  rendimiento: number;
  unidad_rendimiento?: string; // v10.2: subrecetas
  es_subreceta?: boolean;
  costo_total: number;
  costo_porcion: number;
  food_cost: number;
  precio_real: number;
  precio_sugerido: number;
  ingredientes: IngredienteRecetario[];
  ficha: FichaRecetario;
};

async function llamarBackend(params: Record<string, string>): Promise<unknown> {
  // La configuración faltante NO es transitoria: se lanza fuera del reintento.
  if (!API_URL || !API_TOKEN) throw new Error('GASTROCORE_API_URL / GASTROCORE_API_TOKEN no configurados');
  // v10.10.7: antes este fetch no tenía reintento. Una sola lectura perdida en
  // la ráfaga tumbaba el recetario entero ("El recetario no está disponible").
  return conReintento(async () => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'read', resource: 'recetario', token: API_TOKEN, params }),
      cache: 'no-store',
    });
    if (!res.ok) throw errorHttp('El backend del recetario respondió ' + res.status, res.status);
    const j = await res.json();
    // El backend contestó bien pero dijo que no: reintentar sería inútil.
    if (!j.ok) throw errorDefinitivo(j.error?.message || 'Error del backend');
    return j.data;
  });
}

/** Todas las recetas de la carta (activas, sin subrecetas). Caché 5 min. */
export const getRecetario = unstable_cache(
  async (): Promise<RecetaPublica[]> => {
    const data = await llamarBackend({});
    return Array.isArray(data) ? (data as RecetaPublica[]) : [];
  },
  ['recetario-publico'],
  { revalidate: 300, tags: ['recetario'] },
);

/** Una receta puntual para el detalle público. Caché 5 min. */
export const getRecetaPublica = unstable_cache(
  async (id: string): Promise<RecetaPublica | null> => {
    const data = await llamarBackend({ id });
    return (data as RecetaPublica) || null;
  },
  ['recetario-publico-detalle'],
  { revalidate: 300, tags: ['recetario'] },
);

/** Formatea COP sin decimales: 35000 -> "$ 35.000". */
export function cop(v: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Math.round(v || 0));
}

/** URL de foto con ancho pedido (lh3 soporta =wNNN). */
export function fotoConAncho(fotoUrl: string, ancho: number): string {
  if (!fotoUrl) return '';
  if (/lh3\.googleusercontent\.com\/d\//.test(fotoUrl)) {
    return fotoUrl.replace(/=w\d+.*$/, '') + '=w' + ancho;
  }
  return fotoUrl;
}


/** Nombre del negocio (config), cacheado 5 min — para la marca del recetario público. */
const configPublicaCache = unstable_cache(
  async (): Promise<{ nombre: string; tema: string }> => {
    // Si el backend no responde LANZAMOS: unstable_cache no cachea errores.
    // v10.10.7: con reintento, igual que el resto de las lecturas.
    return conReintento(async () => {
      const res = await fetch(process.env.GASTROCORE_API_URL as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'read', resource: 'parametros', token: process.env.GASTROCORE_API_TOKEN }),
        cache: 'no-store',
      });
      if (!res.ok) throw errorHttp('parametros respondió ' + res.status, res.status);
      const j = await res.json();
      if (!j?.ok || !j.data) throw errorDefinitivo('parametros no disponibles');
      return {
        nombre: String(j.data.nombre_negocio || 'Rocoto'),
        tema: String(j.data.recetario_tema || 'rocoto'), // v9.13
      };
    });
  },
  ['recetario-config-publica'],
  { revalidate: 300, tags: ['recetario'] },
);

export async function getNombreNegocio(): Promise<string> {
  try {
    return (await configPublicaCache()).nombre;
  } catch {
    return 'Rocoto';
  }
}

export async function getTemaRecetarioId(): Promise<string> {
  try {
    return (await configPublicaCache()).tema;
  } catch {
    return 'rocoto';
  }
}
