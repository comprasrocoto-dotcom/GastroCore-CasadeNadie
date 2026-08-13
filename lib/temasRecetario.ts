/**
 * TEMAS DEL RECETARIO — v9.13
 * Paletas completas curadas (banda, fondo, títulos y bordes que armonizan).
 * El estilo activo se elige en Configuración y vive en la hoja Configuración
 * (clave RECETARIO_TEMA) — cada proyecto/marca puede tener el suyo.
 */
export type TemaRecetario = {
  id: string;
  nombre: string;
  acento: string;       // banda superior, títulos H1/H2, botones
  acentoSuave: string;  // degradado de la banda, hovers
  titulo: string;       // rótulos de categoría (el rol del "rojo rocoto")
  fondo: string;        // fondo general de la página
  borde: string;        // separadores de sección
};

export const TEMAS: TemaRecetario[] = [
  { id: 'rocoto',   nombre: 'Rocoto clásico',   acento: '#1E3B2C', acentoSuave: '#41654A', titulo: '#B93A2B', fondo: '#F6F1E6', borde: '#DDD4C0' },
  { id: 'malanga',  nombre: 'Malanga tropical', acento: '#8C3A1D', acentoSuave: '#B4592F', titulo: '#1F5C4D', fondo: '#FBF2E7', borde: '#E7D3BC' },
  { id: 'pacifico', nombre: 'Pacífico',         acento: '#14384F', acentoSuave: '#2A5B77', titulo: '#C2571B', fondo: '#EFF4F5', borde: '#CFDDE2' },
  { id: 'aji',      nombre: 'Ají amarillo',     acento: '#8A6512', acentoSuave: '#B98A1C', titulo: '#4A5D3A', fondo: '#FBF7E9', borde: '#E6DCB8' },
  { id: 'carbon',   nombre: 'Carbón elegante',  acento: '#1C1C1C', acentoSuave: '#3D3D3D', titulo: '#B08A3E', fondo: '#F2F2F0', borde: '#D8D8D4' },
  { id: 'vino',     nombre: 'Vino tinto',       acento: '#571E2A', acentoSuave: '#7C3242', titulo: '#8C5A2B', fondo: '#F9F2EF', borde: '#E4D0CB' },
];

export const TEMA_BASE = TEMAS[0];
export function temaPorId(id?: string): TemaRecetario {
  return TEMAS.find((t) => t.id === String(id || '').toLowerCase()) || TEMA_BASE;
}
