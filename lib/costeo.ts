// lib/costeo.ts
// ============================================================================
// FUENTE UNICA DE VERDAD PARA EL CALCULO DE COSTOS (CostCalculator)
// ----------------------------------------------------------------------------
// Todas las vistas (Recetas, ficha, Panel Ejecutivo, Reportes, Exportaciones)
// deben consumir estas funciones. NO duplicar formulas en otros modulos.
//
// v10.11.2 — LOS PARAMETROS YA NO ESTAN CLAVADOS.
// Antes este archivo fijaba el impuesto en 8%, el Food Cost objetivo en 35% y
// el del Panel en 30%, mientras el editor de recetas usaba los parametros de
// Configuracion. Resultado: el mismo plato daba un precio sugerido distinto
// segun la pantalla, y el Panel tarifaba la carta con un objetivo que nadie
// habia configurado. Ahora las formulas RECIBEN los parametros.
//
// Reglas del negocio (las formulas no cambian, solo de donde salen los numeros):
//   - Food Cost = Costo por porcion / Precio base SIN impuesto.
//   - Precio base sin impuesto = precio_real / (1 + INC).
//   - Precio sugerido = (Costo por porcion / FC_OBJ) * (1 + INC).
//   - El FC objetivo puede tener EXCEPCION POR FAMILIA (Configuracion).
// ============================================================================

const num = (n: any): number => Number(n) || 0;

export type ParametrosCosteo = {
  /** Impuesto al consumo como fraccion: 0.08 = 8%. */
  inc: number;
  /** Food Cost objetivo global como fraccion: 0.28 = 28%. */
  fcObjetivo: number;
  /** Excepciones por familia (familia_id -> fraccion). */
  fcPorFamilia: Record<string, number>;
};

/**
 * Valores de respaldo. Se usan SOLO si los parametros aun no llegaron del
 * backend (primer render). Son los historicos del archivo para que ninguna
 * pantalla cambie de comportamiento por accidente durante la carga.
 */
export const PARAMETROS_RESPALDO: ParametrosCosteo = {
  inc: 0.08,
  fcObjetivo: 0.35,
  fcPorFamilia: {},
};

/** Un numero puede venir como 28 (porcentaje) o 0.28 (fraccion). */
function aFraccion(v: any, respaldo: number): number {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return respaldo;
  return n > 1 ? n / 100 : n;
}

/**
 * Traduce los parametros que manda el backend (porcentajes 0-100) al formato
 * que usan las formulas (fracciones). Es el UNICO punto de conversion.
 */
export function parametrosDesdeBackend(par: any): ParametrosCosteo {
  if (!par) return PARAMETROS_RESPALDO;
  const porFamilia: Record<string, number> = {};
  const crudo = par.fc_por_familia || {};
  Object.keys(crudo).forEach((k) => {
    const f = aFraccion(crudo[k], 0);
    if (f > 0) porFamilia[String(k)] = f;
  });
  const incCrudo = Number(par.impuesto_pct);
  return {
    // El impuesto SI puede ser 0 legitimamente, por eso no usa aFraccion.
    inc:
      isFinite(incCrudo) && incCrudo >= 0
        ? incCrudo > 1
          ? incCrudo / 100
          : incCrudo
        : PARAMETROS_RESPALDO.inc,
    fcObjetivo: aFraccion(par.fc_objetivo, PARAMETROS_RESPALDO.fcObjetivo),
    fcPorFamilia: porFamilia,
  };
}

/** Food Cost objetivo que aplica a una receta: el de su familia, o el global. */
export function fcObjetivoDe(par: ParametrosCosteo, familiaId?: string | null): number {
  const p = par || PARAMETROS_RESPALDO;
  const fam = familiaId ? p.fcPorFamilia[String(familiaId)] : undefined;
  return fam && fam > 0 ? fam : p.fcObjetivo;
}

/** Precio de venta base, quitando el impuesto al consumo. */
export function precioBaseSinImpuesto(
  precioReal: number,
  par: ParametrosCosteo = PARAMETROS_RESPALDO
): number {
  return num(precioReal) / (1 + par.inc);
}

/**
 * Food Cost canonico = Costo por porcion / Precio base sin impuesto.
 * Es la UNICA definicion de Food Cost de la aplicacion.
 */
export function foodCost(
  costoPorcion: number,
  precioReal: number,
  par: ParametrosCosteo = PARAMETROS_RESPALDO
): number {
  const base = precioBaseSinImpuesto(precioReal, par);
  return base > 0 ? num(costoPorcion) / base : 0;
}

/**
 * Precio sugerido para alcanzar el Food Cost objetivo (con impuesto incluido).
 * Respeta la excepcion por familia si la receta tiene familia_id.
 */
export function precioSugerido(
  costoPorcion: number,
  par: ParametrosCosteo = PARAMETROS_RESPALDO,
  familiaId?: string | null
): number {
  const fcObj = fcObjetivoDe(par, familiaId);
  return fcObj > 0 ? (num(costoPorcion) / fcObj) * (1 + par.inc) : 0;
}

/** Utilidad = Precio de venta - Costo por porcion. */
export function utilidad(precioReal: number, costoPorcion: number): number {
  const p = num(precioReal);
  return p > 0 ? p - num(costoPorcion) : 0;
}

/** Margen bruto = Utilidad / Precio de venta. */
export function margenBruto(precioReal: number, costoPorcion: number): number {
  const p = num(precioReal);
  return p > 0 ? (p - num(costoPorcion)) / p : 0;
}

/** Precio de venta necesario para volver al Food Cost objetivo dado un nuevo costo. */
export function precioParaObjetivo(
  costoPorcion: number,
  par: ParametrosCosteo = PARAMETROS_RESPALDO,
  familiaId?: string | null
): number {
  return precioSugerido(costoPorcion, par, familiaId);
}

export type Semaforo = {
  hex: string;
  dot: string;
  text: string;
  bg: string;
  border: string;
  label: string;
  emoji: string;
};

/**
 * Semaforo relativo al objetivo: verde hasta 2 puntos por debajo del objetivo,
 * amarillo hasta el objetivo, rojo por encima. Con el objetivo historico del
 * 35% da exactamente los mismos cortes de antes (33% / 35%).
 */
export function semaforo(
  fc: number,
  fcObjetivo: number = PARAMETROS_RESPALDO.fcObjetivo
): Semaforo {
  const v = num(fc);
  const obj = fcObjetivo > 0 ? fcObjetivo : PARAMETROS_RESPALDO.fcObjetivo;
  if (v <= obj - 0.02)
    return { hex: '#16A34A', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-[#DCFCE7]', border: 'border-[#BBF7D0]', label: 'Rentable', emoji: 'Optimo' };
  if (v <= obj)
    return { hex: '#F59E0B', dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-[#FEF3C7]', border: 'border-[#FDE68A]', label: 'En limite', emoji: 'Alerta' };
  return { hex: '#DC2626', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-[#FEE2E2]', border: 'border-[#FECACA]', label: 'Critico', emoji: 'Critico' };
}

/** True si el Food Cost esta dentro del objetivo. */
export function esRentable(
  fc: number,
  fcObjetivo: number = PARAMETROS_RESPALDO.fcObjetivo
): boolean {
  return num(fc) > 0 && num(fc) <= (fcObjetivo > 0 ? fcObjetivo : PARAMETROS_RESPALDO.fcObjetivo);
}

export type Costeo = {
  costoPorcion: number;
  precioReal: number;
  precioSugerido: number;
  precioBase: number;
  foodCost: number;
  utilidad: number;
  margenBruto: number;
  rentable: boolean;
  semaforo: Semaforo;
  /** El objetivo que se aplico (util para mostrarlo en pantalla). */
  fcObjetivo: number;
};

/**
 * Costeo completo de una receta desde la fuente unica.
 * Usa el costo por porcion del backend (motor de costeo canonico) y calcula
 * el resto de indicadores. Si se pasa `precioOverride`, simula ese precio de
 * venta SIN alterar los datos guardados (para "Nuevo precio de venta").
 *
 * `par` viene de parametrosDesdeBackend(...) con los parametros REALES de
 * Configuracion. Si no se pasa, usa los de respaldo.
 */
export function costearReceta(
  receta: any,
  precioOverride?: number,
  par: ParametrosCosteo = PARAMETROS_RESPALDO
): Costeo {
  const costoPorcion = num(receta?.costo_porcion) || num(receta?.costo_total);
  const precioReal =
    precioOverride !== undefined && precioOverride !== null && !isNaN(Number(precioOverride))
      ? num(precioOverride)
      : num(receta?.precio_real);
  const familiaId = receta?.familia_id;
  const fcObj = fcObjetivoDe(par, familiaId);
  const fc = foodCost(costoPorcion, precioReal, par);
  return {
    costoPorcion,
    precioReal,
    precioSugerido: precioSugerido(costoPorcion, par, familiaId),
    precioBase: precioBaseSinImpuesto(precioReal, par),
    foodCost: fc,
    utilidad: utilidad(precioReal, costoPorcion),
    margenBruto: margenBruto(precioReal, costoPorcion),
    rentable: esRentable(fc, fcObj),
    semaforo: semaforo(fc, fcObj),
    fcObjetivo: fcObj,
  };
}

// ----------------------------------------------------------------------------
// v10.11.3 — Las constantes clavadas (INC, FC_OBJ, FC_OBJ_PANEL) y
// precioSugeridoPanel() FUERON RETIRADAS. Ya no queda ninguna pantalla que las
// use: /recetas, /recetas/[id] y el Panel pasan los parametros reales de
// Configuracion. Si algo vuelve a necesitarlas, es senal de que esa pantalla
// no esta recibiendo los parametros y hay que pasarselos, no reponerlas.
// ----------------------------------------------------------------------------
