'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Ayuda } from '@/components/Ayuda';
import Link from 'next/link';
import { costearReceta, precioSugerido as calcPrecioSugerido, semaforo as calcSem, fcObjetivoDe, parametrosDesdeBackend, PARAMETROS_RESPALDO, type ParametrosCosteo } from '@/lib/costeo';

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fcPct = (n: number) => ((Number(n) || 0) * 100).toFixed(1) + '%';

function sem(fc: number, fcObj?: number) {
  const s = calcSem(fc, fcObj);
  return { dot: s.dot, text: s.text, emoji: s.emoji };
}

function precioSugeridoObjetivo(costoPorcion: number) {
  return calcPrecioSugerido(costoPorcion);
}

function fechaCorta(s?: string) {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString('es-CO', { dateStyle: 'medium' });
}

type Sort = 'food_cost' | 'costo' | 'precio' | 'rentabilidad' | 'familia';
type EstadoFiltro = 'activos' | 'inactivos' | 'todos';

export default function ResumenClient() {
  const [recetas, setRecetas] = useState<any[]>([]);
  const [fams, setFams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>('food_cost');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [mostrarFuera, setMostrarFuera] = useState(false);
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('activos');
  const [familiaF, setFamiliaF] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string>('');

  // v10.11.3: parámetros REALES de Configuración (antes: 30 % y 8 % clavados).
  const [par, setPar] = useState<ParametrosCosteo>(PARAMETROS_RESPALDO);

  const cargar = useCallback(async () => {
    // v10.11: UN VIAJE POR PANTALLA, y este recurso SÍ sale del caché del
    // backend (60 s). Trae además los parámetros de costeo.
    const res = await fetch('/api/pantallas/recetas', { cache: 'no-store' });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok || !j?.data) {
      throw new Error(j?.error || `El servidor respondió ${res.status}.`);
    }
    setRecetas(Array.isArray(j.data.recetas) ? j.data.recetas : []);
    setFams(Array.isArray(j.data.familias) ? j.data.familias : []);
    setPar(parametrosDesdeBackend(j.data.parametros));
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try { await cargar(); } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [cargar]);

  const famMap = useMemo(() => new Map(fams.map((f) => [f.id, f])), [fams]);
  const esActivo = (r: any) => r.activo === true || r.activo === 'true' || r.activo === 'TRUE' || r.activo === 1;
  const familiaDe = (r: any) => {
    const f = famMap.get(r.familia_id); // v9.4: familia directa
    return f ? f.nombre : 'Sin clasificar';
  };

  const visibles = useMemo(() => {
    let base = recetas;
    if (estadoFiltro === 'activos') base = base.filter(esActivo);
    else if (estadoFiltro === 'inactivos') base = base.filter((r) => !esActivo(r));
    // v9.4: filtro por familia directa
    if (familiaF) base = base.filter((r) => String(r.familia_id) === familiaF);
    return base;
  }, [recetas, estadoFiltro, familiaF]);

  const rows = useMemo(() => {
    const arr = visibles.map((r) => {
      const base = costearReceta(r, undefined, par);
      // v10.11.3: antes esto usaba precioSugeridoPanel(), con el 30 % CLAVADO.
      // Ahora usa el Food Cost objetivo configurado, con excepción por familia.
      const sugeridoPanel = calcPrecioSugerido(base.costoPorcion, par, r.familia_id);
      const editado = nuevoPrecio[r.id];
      const editValor =
        editado !== undefined && editado !== ''
          ? Number(editado)
          : Math.round(sugeridoPanel);
      const sim = costearReceta(r, editValor, par);
      return {
        r,
        familia: familiaDe(r),
        activo: esActivo(r),
        costo: base.costoPorcion,
        precio: base.precioReal,
        sugerido: base.precioSugerido,
        sugeridoPanel,
        editValor,
        fc: base.foodCost,
        rent: base.utilidad,
        margen: base.margenBruto,
        rentable: base.rentable,
        fcObj: base.fcObjetivo, // v10.11.3: el objetivo que aplica a ESTA receta
        sim,
      };
    });
    const s = [...arr].sort((a, b) => {
      let c = 0;
      if (sort === 'food_cost') c = a.fc - b.fc;
      else if (sort === 'costo') c = a.costo - b.costo;
      else if (sort === 'precio') c = a.precio - b.precio;
      else if (sort === 'rentabilidad') c = a.rent - b.rent;
      else if (sort === 'familia') c = a.familia.localeCompare(b.familia);
      return dir === 'asc' ? c : -c;
    });
    return s;
  }, [visibles, sort, dir, famMap, nuevoPrecio]);

  const activos = useMemo(() => recetas.filter(esActivo), [recetas]);
  const porFamilia = useMemo(() => {
    const m = new Map<string, { suma: number; n: number }>();
    for (const x of rows) {
      if (!(x.fc > 0)) continue;
      if (!m.has(x.familia)) m.set(x.familia, { suma: 0, n: 0 });
      const g = m.get(x.familia)!;
      g.suma += x.fc; g.n++;
    }
    return Array.from(m.entries()).map(([fam, v]) => ({ fam, prom: v.suma / v.n })).sort((a, b) => b.prom - a.prom);
  }, [rows]);

  const topRentables = useMemo(() => [...rows].filter((x) => x.precio > 0).sort((a, b) => b.rent - a.rent).slice(0, 10), [rows]);
  const topFoodCost = useMemo(() => [...rows].filter((x) => x.fc > 0).sort((a, b) => b.fc - a.fc).slice(0, 10), [rows]);
  const utilidadTotal = useMemo(() => rows.reduce((a, x) => a + (x.rent > 0 ? x.rent : 0), 0), [rows]);
  const fueraPrecio = useMemo(() => rows.filter((x) => x.fc > x.fcObj).map((x) => {
    const sugerido = precioSugeridoObjetivo(x.costo);
    return { ...x, sugerido, diff: sugerido - x.precio };
  }).sort((a, b) => b.fc - a.fc), [rows]);
  const maxRent = topRentables[0]?.rent || 1;
  const maxFc = topFoodCost[0]?.fc || 1;

  async function actualizarPrecio(id: string) {
    const row = rows.find((x) => x.r.id === id);
    const escrito = nuevoPrecio[id];
    const val =
      escrito !== undefined && escrito !== ''
        ? Number(escrito)
        : row
        ? row.editValor
        : NaN;
    if (!val || isNaN(val) || val <= 0) { setAviso('Ingresa un precio valido.'); return; }
    setGuardando(id);
    setAviso('');
    try {
      const res = await fetch('/api/recetas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, precio_real: val }),
      }).then((x) => x.json());
      if (res?.ok === false) { setAviso('No se pudo actualizar: ' + (res.error || '')); }
      else {
        // v10.10.5: se retiró una espera artificial de 1.500 ms que había aquí.
        // No hacía falta: el PUT es síncrono (el backend escribe bajo lock antes
        // de responder) y 'recetas' no se sirve del caché compartido del backend,
        // así que la recarga siempre lee la hoja real. Con 26 platos, esa espera
        // sumaba más de medio minuto de reloj por una carga completa de precios.
        await cargar();
        setNuevoPrecio((p) => { const n = { ...p }; delete n[id]; return n; });
        setAviso('Precio actualizado y sincronizado.');
      }
    } catch (e) {
      setAviso('Error de red al actualizar el precio.');
    } finally {
      setGuardando(null);
    }
  }

  async function cambiarEstado(id: string, activo: boolean) {
    setGuardando(id);
    setAviso('');
    try {
      const res = await fetch('/api/recetas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activo }),
      }).then((x) => x.json());
      if (res?.ok === false) { setAviso('No se pudo cambiar el estado: ' + (res.error || '')); }
      else { await cargar(); setAviso(activo ? 'Receta activada.' : 'Receta marcada como inactiva.'); } // v10.10.5: sin espera artificial
    } catch (e) {
      setAviso('Error de red al cambiar el estado.');
    } finally {
      setGuardando(null);
    }
  }

  function exportarExcel() {
    const cols = ['Codigo', 'Receta', 'Familia', 'Estado', 'Costo por porcion', 'Precio de venta', 'Precio sugerido', 'Food Cost', 'Rentabilidad', 'Utilidad', 'Ultima actualizacion'];
    const esc = (v: any) => {
      const s = String(v ?? '');
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lineas = rows.map((x) => [
      x.r.id,
      x.r.nombre,
      x.familia,
      x.activo ? 'Activo' : 'Inactivo',
      Math.round(x.costo),
      Math.round(x.precio),
      Math.round(x.sugerido),
      (x.fc * 100).toFixed(1) + '%',
      x.rentable ? 'Rentable' : 'Fuera de objetivo',
      Math.round(x.rent),
      fechaCorta(x.r.actualizado_en),
    ].map(esc).join(';'));
    const csv = '\uFEFF' + [cols.join(';'), ...lineas].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'panel-ejecutivo-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function th(label: string, key: Sort) {
    const active = sort === key;
    return (
      <th className="px-3 py-2 font-medium">
        <button onClick={() => { if (active) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDir('desc'); } }} className={`inline-flex items-center gap-1 ${active ? 'text-ambar-700' : 'text-salvia-600 hover:text-salvia-800'}`}>
          {label}<span className="text-[10px]">{active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
        </button>
      </th>
    );
  }

  return (
    <main className="app-shell py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-salvia-100 pb-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-salvia-400">GastroCore · Inteligencia de costos</p>
          <h1 className="font-display text-[28px] font-bold leading-tight text-ambar-700">Panel Ejecutivo</h1>
          <p className="mt-1 text-sm text-salvia-600">Tablero ejecutivo del costeo de recetas, sincronizado con la base.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportarExcel} className="btn-secondary">⬇ Exportar a Excel</button>
          <Link href="/recetas" className="btn-secondary">Volver al recetario</Link>
        </div>
      </header>

      {aviso && (
        <div className="mb-4 rounded-md border border-ambar-200 bg-ambar-50 px-4 py-2 text-sm text-ambar-800">{aviso}</div>
      )}

      {loading ? (
        <p className="py-10 text-center text-salvia-500">Cargando tablero...</p>
      ) : (
        <>
          {/* v8.1: filtros de clasificación — todo el tablero (KPIs incluidos) responde a ellos */}
          <section className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 shadow-sm">
            <span className="text-[11px] font-bold uppercase tracking-widest text-salvia-500">Filtrar</span>
            <select value={familiaF}
              onChange={(e) => setFamiliaF(e.target.value)}
              className={'rounded-full border px-3.5 py-1.5 text-sm transition ' + (familiaF ? 'border-ambar-400 bg-ambar-50 font-medium text-ambar-800' : 'border-line text-slate-600 hover:border-slate-300')}>
              <option value="">🍽 Todas las familias</option>
              {fams.filter((f: any) => String(f.tipo).toLowerCase() === 'receta').map((f: any) => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </select>
            {familiaF && (
              <button onClick={() => setFamiliaF('')}
                className="ml-auto rounded-full px-3 py-1.5 text-xs font-medium text-salvia-600 hover:bg-neutral-100">
                ✕ Limpiar filtros
              </button>
            )}
          </section>

          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card label="Recetas activas" value={String(rows.filter((x) => x.activo).length)} tone="blue" icon="📘"
              ayuda={<Ayuda titulo="Recetas activas"><p>Cuántos platos del menú están <b>activos</b> (a la venta hoy). Las recetas desactivadas no cuentan en ningún número de este panel.</p><p><b>Ejemplo:</b> tienes 86 recetas creadas y desactivas 6 de temporada → este número muestra 80 y todos los KPIs se calculan sobre esas 80.</p></Ayuda>} />
            <Card label="Food Cost promedio" value={fcPct(rows.filter((x) => x.fc > 0).reduce((a, x, _, arr) => a + x.fc / arr.length, 0))} tone="green" icon="📊"
              ayuda={<Ayuda titulo="Food Cost promedio"><p>De cada $100 que vendes, cuántos se van en <b>materia prima</b>. Se calcula sobre el precio SIN impuesto: costo ÷ (precio ÷ 1,08).</p><p><b>Ejemplo:</b> un plato a $43.200 tiene base de $40.000; si sus insumos cuestan $12.000, su Food Cost es 30%.</p><p>Este KPI promedia todas las recetas activas con precio. <b>Meta:</b> el objetivo configurado en Parámetros de Costeo. Más bajo = más margen.</p></Ayuda>} />
            <Card label="Utilidad potencial" value={money(utilidadTotal)} tone="green" icon="💰"
              ayuda={<Ayuda titulo="Utilidad potencial"><p>La suma de lo que deja cada plato (precio base sin impuesto − costo de insumos) <b>si se vendiera uno de cada uno</b>. No es la utilidad del mes: es el músculo del menú.</p><p><b>Ejemplo:</b> plato con base $40.000 y costo $12.000 aporta $28.000 a este total.</p><p><b>Cómo usarlo:</b> compáralo semana a semana. Si baja sin haber cambiado precios, los insumos subieron y te están comiendo margen en silencio.</p></Ayuda>} />
            <button type="button" onClick={() => setMostrarFuera((v) => !v)} className="text-left focus:outline-none">
              <Card label="Recetas fuera de precio" value={String(fueraPrecio.length)} tone="red" icon="⚠"
                ayuda={<Ayuda titulo="Recetas fuera de precio"><p>Platos cuyo <b>precio real de venta está por debajo del sugerido</b> para cumplir el Food Cost objetivo: cada venta regala margen.</p><p><b>Ejemplo:</b> si para estar en 30% el sistema sugiere $44.400 y lo vendes a $39.000, el plato aparece aquí.</p><p>Toca esta tarjeta para ver la lista y decidir: subir precio, bajar costo de la receta, o aceptarlo conscientemente (ej: un gancho comercial).</p></Ayuda>} />
            </button>
          </section>

          {/* ═══ v9.9: LECTURA DE EXPERTO — ángulos que los KPIs no muestran ═══ */}
          {(() => {
            const conP = rows.filter((x) => x.activo && x.precio > 0);
            if (conP.length < 5) return null;
            const fuera = conP.filter((x) => x.fc > x.fcObj);
            const regalo = fuera.reduce((a, x) => a + Math.max(0, (x.sugeridoPanel || 0) - x.precio), 0);
            const frontera = conP.filter((x) => x.fc > x.fcObj - 0.03 && x.fc <= x.fcObj);
            const rentables = conP.filter((x) => x.rent > 0);
            const utilTotal = rentables.reduce((a, x) => a + x.rent, 0);
            const top5 = [...rentables].sort((a, b) => b.rent - a.rent).slice(0, 5);
            const pctTop = utilTotal > 0 ? Math.round((top5.reduce((a, x) => a + x.rent, 0) / utilTotal) * 100) : 0;
            const fantasmas = conP.filter((x) => x.fc > 0 && x.fc < 0.10);
            const porFam = new Map<string, number[]>();
            conP.forEach((x) => { if (!porFam.has(x.familia)) porFam.set(x.familia, []); porFam.get(x.familia)!.push(x.fc); });
            const despareja = Array.from(porFam.entries())
              .filter(([, v]) => v.length >= 3)
              .map(([fam, v]) => ({ fam, rango: Math.max(...v) - Math.min(...v), n: v.length }))
              .sort((a, b) => b.rango - a.rango)[0];
            const Tarjeta = ({ tono, titulo, cifra, frase, ayuda }: { tono: string; titulo: string; cifra: string; frase: React.ReactNode; ayuda: React.ReactNode }) => (
              <div className={'rounded-xl border-l-4 bg-white p-4 shadow-sm ' + tono}>
                <p className="flex items-center text-[11px] font-bold uppercase tracking-wide text-slate-500">{titulo}{ayuda}</p>
                <p className="mt-1 text-2xl font-extrabold text-ink">{cifra}</p>
                <p className="mt-1 text-[12.5px] leading-snug text-slate-600">{frase}</p>
              </div>
            );
            return (
              <section className="mb-6">
                <div className="mb-3 flex items-center gap-2 border-l-4 border-[#1E3A5F] pl-2 text-sm font-semibold uppercase tracking-wide text-salvia-600">
                  <span>🔬</span>Lectura de experto
                  <Ayuda titulo="Lectura de experto"><p>Cinco ángulos que los KPIs de arriba NO muestran, calculados en vivo con tus recetas activas con precio. No son promedios: son los puntos exactos donde se gana o se pierde plata esta semana.</p></Ayuda>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Tarjeta tono="border-red-500" titulo="💸 Dinero en la mesa" cifra={money(regalo)}
                    frase={<>La carta está <b>{money(regalo)} por debajo</b> del precio que cumple el objetivo, repartidos en <b>{fuera.length} platos</b>. Cada venta de uno de ellos regala margen.</>}
                    ayuda={<Ayuda titulo="Dinero en la mesa"><p>Suma de (precio sugerido − precio real) de todos los platos fuera del Food Cost objetivo. NO es utilidad perdida del mes — es cuánto le falta a la carta para estar alineada. <b>Cómo usarlo:</b> es tu lista de aumentos priorizada; empieza por los de mayor diferencia y decide plato por plato: subir, reformular o aceptarlo como gancho.</p></Ayuda>} />
                  <Tarjeta tono="border-amber-500" titulo="⚡ A un paso del rojo" cifra={String(frontera.length) + ' platos'}
                    frase={<>Están a <b>menos de 3 puntos</b> del objetivo{frontera.length > 0 && <>: <b>{frontera.slice(0, 3).map((x) => x.r.nombre).join(', ')}</b>{frontera.length > 3 ? '…' : ''}</>}. La próxima subida de insumos los cruza.</>}
                    ayuda={<Ayuda titulo="A un paso del rojo"><p>Platos con Food Cost entre el objetivo y 3 puntos por debajo. Hoy están &quot;bien&quot; — pero sin colchón: un alza del 10% en su insumo principal los pasa al rojo. <b>Cómo usarlo:</b> revísalos ANTES de la próxima negociación con proveedores, no después. Son los primeros candidatos a ajuste preventivo de precio o porción.</p></Ayuda>} />
                  <Tarjeta tono="border-emerald-500" titulo="🏆 Concentración del margen" cifra={String(pctTop) + '%'}
                    frase={<>El <b>top 5</b> de platos aporta el <b>{pctTop}%</b> de la utilidad potencial{top5[0] && <> — el #1 es <b>{top5[0].r.nombre}</b></>}. {pctTop >= 40 ? 'Dependencia alta: protege esos 5 con proveedor alterno y ficha impecable.' : 'Margen bien repartido: ningún plato te tiene de rehén.'}</>}
                    ayuda={<Ayuda titulo="Concentración del margen"><p>Qué % de la utilidad potencial total viene de solo 5 platos. <b>Regla de lectura:</b> arriba de 40% = el negocio depende de pocos platos (si uno sube de costo o sale de temporada, duele en serio) — asegúrales proveedor alterno y merma controlada. Debajo de 25% = cartera sana y diversificada.</p></Ayuda>} />
                  <Tarjeta tono="border-purple-500" titulo="🩻 Demasiado bueno para ser verdad" cifra={String(fantasmas.length) + ' platos'}
                    frase={<>Food Cost <b>menor al 10%</b>{fantasmas.length > 0 && <>: <b>{fantasmas.slice(0, 3).map((x) => x.r.nombre).join(', ')}</b>{fantasmas.length > 3 ? '…' : ''}</>}. Eso no es un triunfo: casi siempre es una <b>ficha incompleta</b>. Audítalos hoy.</>}
                    ayuda={<Ayuda titulo="Demasiado bueno para ser verdad"><p>Un plato real rara vez opera bajo el 10% de Food Cost. Cuando aparece, la causa habitual es una receta con <b>insumos en $0, cantidades faltantes o unidad equivocada</b> (gramos digitados como kilos). <b>Cómo usarlo:</b> abre cada uno y revisa su detalle de ingredientes — estos platos están inflando la utilidad potencial del panel con plata que no existe.</p></Ayuda>} />
                  {despareja && (
                    <Tarjeta tono="border-blue-500" titulo="📏 La familia despareja" cifra={despareja.fam}
                      frase={<>Sus {despareja.n} platos van de punta a punta con <b>{(despareja.rango * 100).toFixed(0)} puntos</b> de diferencia en Food Cost. El pricing de esa familia no sigue una regla.</>}
                      ayuda={<Ayuda titulo="La familia despareja"><p>La familia con mayor brecha entre su plato de mejor y peor Food Cost. Una brecha grande dice que los precios se pusieron a ojo en momentos distintos. <b>Cómo usarlo:</b> siéntate con esa familia completa en una sola sesión y alinéala con un criterio único — es la corrección de precios más rápida que existe, porque el problema está concentrado en un solo lugar de la carta.</p></Ayuda>} />
                  )}
                </div>
              </section>
            );
          })()}

          {(() => {
            const criticas = rows.filter((x) => x.fc > x.fcObj);
            const vigilar = rows.filter((x) => x.fc > x.fcObj - 0.02 && x.fc <= x.fcObj);
            const peor = [...rows].filter((x) => x.fc > 0).sort((a, b) => b.fc - a.fc)[0];
            if (criticas.length === 0 && vigilar.length === 0) {
              return (
                <section className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <span className="text-lg">🟢</span>
                  <p className="text-sm text-emerald-800"><span className="font-semibold">Todo bajo control.</span> Ninguna receta activa supera el Food Cost objetivo.</p>
                </section>
              );
            }
            return (
              <section className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-r from-red-50 to-amber-50 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔥</span>
                    <Ayuda titulo="Semáforo de Food Cost"><p>Clasifica las recetas activas por su Food Cost frente al objetivo:</p><p>🔥 <b>Críticas:</b> superan el objetivo — el costo se comió el margen. Acciones: subir precio, renegociar insumos o ajustar porciones.</p><p>👀 <b>En vigilancia:</b> entre 33% y el objetivo — aún no duelen, pero van en camino.</p><p><b>Ejemplo:</b> con objetivo 30%, un plato en FC 36% y base $40.000 pierde $2.400 de margen por plato frente a la meta.</p></Ayuda>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Alertas de rentabilidad</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-base">🔴</span>
                    <span className="font-semibold text-red-700">{criticas.length}</span>
                    <span className="text-salvia-600">acción inmediata</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-base">🟡</span>
                    <span className="font-semibold text-amber-700">{vigilar.length}</span>
                    <span className="text-salvia-600">a vigilar</span>
                  </div>
                  {peor && (
                    <div className="ml-auto flex items-center gap-2 text-sm">
                      <span className="text-salvia-500">Mayor Food Cost:</span>
                      <Link href={`/recetas/${peor.r.id}`} className="font-semibold text-ambar-700 hover:underline">{peor.r.nombre}</Link>
                      <span className={`font-mono ${sem(peor.fc).text}`}>{fcPct(peor.fc)}</span>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {mostrarFuera && (
            <section className="card mb-6">
              <div className="flex items-center justify-between border-b border-salvia-100 px-4 py-3">
                <div className="text-sm font-semibold uppercase tracking-wide text-salvia-500">Recetas fuera de precio ({fueraPrecio.length})</div>
                <button type="button" onClick={() => setMostrarFuera(false)} className="text-xs text-salvia-500 hover:text-salvia-700">Cerrar</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-salvia-50 text-left text-salvia-600">
                      <th className="px-3 py-2 font-medium">Receta</th>
                      <th className="px-3 py-2 text-right font-medium">Food Cost</th>
                      <th className="px-3 py-2 text-right font-medium">Precio actual</th>
                      <th className="px-3 py-2 text-right font-medium">Precio sugerido</th>
                      <th className="px-3 py-2 text-right font-medium">Ajuste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fueraPrecio.map((x) => (
                      <tr key={x.r.id} className="border-t border-salvia-50">
                        <td className="px-3 py-2 font-medium"><Link href={`/recetas/${x.r.id}`} className="text-ambar-700 hover:underline">{x.r.nombre}</Link></td>
                        <td className="px-3 py-2 text-right font-mono text-red-600">{fcPct(x.fc)}</td>
                        <td className="px-3 py-2 text-right font-mono">{x.precio > 0 ? money(x.precio) : '-'}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-700">{money(x.sugerido)}</td>
                        <td className="px-3 py-2 text-right font-mono">{money(x.diff)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2 border-l-4 border-emerald-400 pl-2 text-sm font-semibold uppercase tracking-wide text-salvia-600"><span>🥇</span>Top 10 más rentables</div>
              <div className="space-y-2">
                {topRentables.map((x) => (
                  <div key={x.r.id} className="flex items-center gap-2 text-sm">
                    <Link href={`/recetas/${x.r.id}`} className="w-40 shrink-0 truncate text-ambar-700 hover:underline">{x.r.nombre}</Link>
                    <div className="h-2 flex-1 rounded-full bg-salvia-100">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(4, (x.rent / maxRent) * 100)}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right font-mono text-salvia-700">{money(x.rent)}</span>
                  </div>
                ))}
                {topRentables.length === 0 && <p className="text-sm text-salvia-400">Sin datos.</p>}
              </div>
            </div>
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2 border-l-4 border-red-400 pl-2 text-sm font-semibold uppercase tracking-wide text-salvia-600"><span>🔴</span>Top recetas que más pierden</div>
              <div className="space-y-2">
                {topFoodCost.map((x) => (
                  <div key={x.r.id} className="flex items-center gap-2 text-sm">
                    <Link href={`/recetas/${x.r.id}`} className="w-40 shrink-0 truncate text-ambar-700 hover:underline">{x.r.nombre}</Link>
                    <div className="h-2 flex-1 rounded-full bg-salvia-100">
                      <div className={`h-2 rounded-full ${sem(x.fc, x.fcObj).dot}`} style={{ width: `${Math.max(4, (x.fc / maxFc) * 100)}%` }} />
                    </div>
                    <div className="flex w-28 shrink-0 flex-col items-end leading-tight"><span className={`font-mono ${sem(x.fc, x.fcObj).text}`}>{fcPct(x.fc)}</span>{x.fc > x.fcObj && (<span className="font-mono text-[11px] text-red-500">+{((x.fc - x.fcObj) * 100).toFixed(1)} pp</span>)}</div>
                  </div>
                ))}
                {topFoodCost.length === 0 && <p className="text-sm text-salvia-400">Sin datos.</p>}
              </div>
            </div>
          </section>

          <section className="card mb-6 p-4">
            <div className="mb-3 flex items-center gap-2 border-l-4 border-sky-400 pl-2 text-sm font-semibold uppercase tracking-wide text-salvia-600"><span>🗂️</span>Food Cost promedio por familia</div>
            <div className="space-y-2">
              {porFamilia.map((x) => (
                <div key={x.fam} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 truncate text-salvia-700">{x.fam}</span>
                  <div className="h-2 flex-1 rounded-full bg-salvia-100">
                    <div className={`h-2 rounded-full ${sem(x.prom).dot}`} style={{ width: `${Math.min(100, x.prom * 200)}%` }} />
                  </div>
                  <span className={`w-16 shrink-0 text-right font-mono ${sem(x.prom).text}`}>{fcPct(x.prom)}</span>
                </div>
              ))}
              {porFamilia.length === 0 && <p className="text-sm text-salvia-400">Sin datos.</p>}
            </div>
          </section>

          <section className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-salvia-100 px-4 py-3">
              <div className="flex items-center gap-2 border-l-4 border-ambar-400 pl-2 text-sm font-semibold uppercase tracking-wide text-salvia-600"><span>📋</span>Detalle por receta
                <Ayuda titulo="Detalle por receta"><p>Cada fila es una receta activa con su economía completa: costo por porción, precio, Food Cost y utilidad.</p><p><b>El precio de venta es EDITABLE:</b> escribe un valor y el FC y la utilidad se recalculan al instante — es un simulador. Al Guardar, el precio se vuelve oficial y queda registrado en la trazabilidad de la receta.</p><p><b>Rentabilidad</b> = qué % del precio base queda como margen. <b>Ejemplo:</b> base $40.000, costo $12.000 → utilidad $28.000, rentabilidad 70%.</p></Ayuda></div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-salvia-500">Estado</label>
                <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)} className="rounded-md border border-salvia-200 px-2 py-1 text-sm">
                  <option value="activos">Activos</option>
                  <option value="inactivos">Inactivos</option>
                  <option value="todos">Todos</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-salvia-50 text-left text-salvia-600">
                    <th className="px-3 py-2 font-medium">Receta</th>
                    {th('Familia', 'familia')}
                    {th('Costo plato', 'costo')}
                    {th('Precio actual', 'precio')}
                    {th('Food Cost actual', 'food_cost')}
                    <th className="px-3 py-2 text-right font-medium">Precio sugerido editable</th>
                    <th className="px-3 py-2 text-right font-medium">Food Cost resultante</th>
                    <th className="px-3 py-2 text-right font-medium">Utilidad</th>
                    <th className="px-3 py-2 text-center font-medium">Estado</th>
                    <th className="px-3 py-2 text-center font-medium">Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => {
                    const valorCampo =
                      nuevoPrecio[x.r.id] !== undefined && nuevoPrecio[x.r.id] !== ''
                        ? nuevoPrecio[x.r.id]
                        : String(Math.round(x.sugeridoPanel));
                    const sugMayor = x.sugeridoPanel > x.precio + 0.5;
                    const sugMenor = x.sugeridoPanel < x.precio - 0.5;
                    const indicador = x.precio <= 0
                      ? { bg: 'border-salvia-200', icon: '', tip: '' }
                      : sugMayor
                      ? { bg: 'border-amber-300 bg-amber-50', icon: '↑', tip: 'Se recomienda subir el precio' }
                      : sugMenor
                      ? { bg: 'border-emerald-300 bg-emerald-50', icon: '↓', tip: 'Puede bajar el precio' }
                      : { bg: 'border-sky-300 bg-sky-50', icon: '✓', tip: 'El precio actual ya cumple el objetivo' };
                    const diferencia = x.editValor - x.precio;
                    return (
                      <tr key={x.r.id} className={`border-t border-salvia-50 hover:bg-ambar-50/40 ${!x.activo ? 'opacity-60' : ''}`}>
                        <td className="px-3 py-2 font-medium"><Link href={`/recetas/${x.r.id}`} className="text-ambar-700 hover:underline">{x.r.nombre}</Link></td>
                        <td className="px-3 py-2 text-salvia-600">{x.familia}</td>
                        <td className="px-3 py-2 text-right font-mono">{money(x.costo)}</td>
                        <td className="px-3 py-2 text-right font-mono">{x.precio > 0 ? money(x.precio) : <span className="text-amber-500">-</span>}</td>
                        <td className="px-3 py-2 text-right"><span className={`inline-flex items-center gap-1.5 font-mono ${sem(x.fc).text}`}><span className={`h-2 w-2 rounded-full ${sem(x.fc, x.fcObj).dot}`} />{x.fc > 0 ? fcPct(x.fc) : '-'}</span></td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-xs" title={indicador.tip}>{indicador.icon}</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={valorCampo}
                              title={indicador.tip}
                              onChange={(e) => setNuevoPrecio((p) => ({ ...p, [x.r.id]: e.target.value }))}
                              className={`w-28 rounded-md border px-2 py-1 text-right font-mono text-sm focus:border-ambar-400 focus:outline-none ${indicador.bg}`}
                            />
                          </div>
                          {x.precio > 0 && (
                            <div className={`mt-0.5 text-right text-[10px] ${diferencia > 0 ? 'text-amber-600' : diferencia < 0 ? 'text-emerald-600' : 'text-sky-600'}`}>
                              {diferencia === 0 ? 'Sin cambio' : (diferencia > 0 ? '+' : '') + money(diferencia)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-flex items-center gap-1.5 font-mono ${sem(x.sim.foodCost).text}`}><span className={`h-2 w-2 rounded-full ${sem(x.sim.foodCost).dot}`} />{x.sim.foodCost > 0 ? fcPct(x.sim.foodCost) : '-'}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{x.sim.precioReal > 0 ? money(x.sim.utilidad) : '-'}</td>
                        <td className="px-3 py-2 text-center">
                          <select
                            value={x.activo ? 'activo' : 'inactivo'}
                            disabled={guardando === x.r.id}
                            onChange={(e) => cambiarEstado(x.r.id, e.target.value === 'activo')}
                            className={`rounded-md border px-2 py-1 text-xs ${x.activo ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-salvia-200 bg-salvia-50 text-salvia-600'}`}
                          >
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            disabled={guardando === x.r.id}
                            onClick={() => actualizarPrecio(x.r.id)}
                            className="rounded-md bg-ambar-600 px-2.5 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-ambar-700"
                          >
                            {guardando === x.r.id ? 'Guardando...' : 'Actualizar precio'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={10} className="px-3 py-6 text-center text-salvia-400">No hay recetas para el filtro seleccionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

const RTONES: Record<string, { bg: string; ring: string; icon: string; val: string }> = {
  neutral: { bg: 'bg-white', ring: 'border-line', icon: 'bg-slate-100 text-slate-500', val: 'text-ink' },
  blue: { bg: 'bg-[#EFF6FF]', ring: 'border-[#DBEAFE]', icon: 'bg-[#DBEAFE] text-[#2563EB]', val: 'text-[#1E3A5F]' },
  green: { bg: 'bg-[#ECFDF5]', ring: 'border-[#D1FAE5]', icon: 'bg-[#DCFCE7] text-[#16A34A]', val: 'text-[#16A34A]' },
  red: { bg: 'bg-[#FEF2F2]', ring: 'border-[#FEE2E2]', icon: 'bg-[#FEE2E2] text-[#DC2626]', val: 'text-[#DC2626]' },
};

function Card({ label, value, tone = 'neutral', icon, ayuda }: { label: string; value: string; tone?: string; icon?: string; ayuda?: React.ReactNode }) {
  const t = RTONES[tone] || RTONES.neutral;
  return (
    <div className={`card-hover rounded-xl border ${t.ring} ${t.bg} p-4 shadow-card`}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}{ayuda}</p>
        {icon && <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${t.icon}`}>{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${t.val}`}>{value}</p>
    </div>
  );
}
