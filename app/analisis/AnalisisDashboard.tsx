'use client';

import { useMemo, useState } from 'react';
import { Ayuda } from '@/components/Ayuda';
import type { AnalyticsData, SimulacionResult } from '@/lib/api/gastrocore';

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const pct = (n: number) => (n >= 0 ? '+' : '') + (n || 0).toFixed(1) + '%';

function riesgoSim(fc: number) {
  const v = Number(fc) || 0;
  if (v <= 0.33) return { emoji: '🟢', label: 'Rentable', bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', border: 'border-[#BBF7D0]', dot: '#16A34A' };
  if (v <= 0.35) return { emoji: '🟡', label: 'Vigilar', bg: 'bg-[#FEF3C7]', text: 'text-[#B45309]', border: 'border-[#FDE68A]', dot: '#F59E0B' };
  return { emoji: '🔴', label: 'Accion', bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]', dot: '#DC2626' };
}

const fechaCorta = (v: string) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
};

function descargarCSV(nombre: string, filas: (string | number)[][]) {
  const csv = filas.map((f) => f.map((c) => {
    const s = String(c ?? '');
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function BarraVar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  const color = value >= 0 ? 'bg-red-500' : 'bg-green-500';
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div className={'h-2 rounded-full ' + color} style={{ width: w + '%' }} />
    </div>
  );
}

function LineChart({ points, label, color = '#B45309' }: { points: { x: string; y: number }[]; label: string; color?: string }) {
  if (!points.length) {
    return <p className="py-8 text-center text-sm text-muted">Sin datos históricos todavía. Genera snapshots semanales.</p>;
  }
  const w = 560, h = 180, pad = 30;
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p.y - minY) / rangeY) * (h - pad * 2);
    return { x, y };
  });
  const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c.x.toFixed(1) + ' ' + c.y.toFixed(1)).join(' ');
  return (
    <svg viewBox={'0 0 ' + w + ' ' + h} className="w-full" role="img" aria-label={label}>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#E5E7EB" />
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={3} fill={color} />
          <text x={c.x} y={h - pad + 14} fontSize={9} textAnchor="middle" fill="#94A3B8">{fechaCorta(points[i].x)}</text>
        </g>
      ))}
      <text x={pad} y={pad - 10} fontSize={10} fill="#64748B">{label}</text>
    </svg>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return <p className="py-6 text-center text-sm text-muted">Sin variaciones por familia.</p>;
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="w-32 shrink-0 truncate text-xs text-ink" title={d.label}>{d.label}</span>
          <div className="flex-1"><BarraVar value={d.value} max={max} /></div>
          <span className={'w-16 shrink-0 text-right text-xs font-semibold ' + (d.value >= 0 ? 'text-red-600' : 'text-green-700')}>{pct(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Simulador({ insumos }: { insumos: { id: string; articulo: string; coste: number }[] }) {
  const [insumoId, setInsumoId] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<SimulacionResult | null>(null);

  const insumoSel = insumos.find((i) => i.id === insumoId);

  const simular = async () => {
    setError(null);
    setRes(null);
    if (!insumoId) { setError('Selecciona un insumo.'); return; }
    const np = Number(nuevoPrecio);
    if (Number.isNaN(np) || np < 0) { setError('Ingresa un precio válido.'); return; }
    setCargando(true);
    try {
      const r = await fetch('/api/analytics/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insumo_id: insumoId, nuevo_precio: np }),
      });
      const j = await r.json();
      if (!j.ok) { setError(j.error || 'No se pudo simular.'); return; }
      setRes(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al simular.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-display text-lg font-bold text-ambar-700">🧪 Simular impacto
          <Ayuda titulo="Simular impacto"><p>El laboratorio del &quot;¿qué pasa si?&quot;: elige un insumo y un % de subida para ver <b>qué recetas se afectan y cuánto</b>, ANTES de que ocurra — sin tocar los datos reales.</p><p><b>Ejemplo:</b> &quot;aguacate +15%&quot; te lista las recetas que lo usan, el costo nuevo de cada una y cuáles cruzarían el Food Cost objetivo.</p><p><b>Úsalo</b> cuando el proveedor anuncie alzas o antes de negociar: llegas a la mesa sabiendo cuánto te duele cada punto.</p></Ayuda></h2>
        <span className="chip bg-slate-100 text-slate-600">Solo consulta</span>
      </div>
      <p className="mb-4 text-xs text-salvia-700">Prueba un nuevo precio sin guardarlo. Verás qué recetas se afectan, el nuevo Food Cost y el precio de venta sugerido.</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-salvia-700">Insumo</span>
          <select value={insumoId} onChange={(e) => { setInsumoId(e.target.value); const it = insumos.find((x) => x.id === e.target.value); setNuevoPrecio(it ? String(it.coste) : ''); }}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]">
            <option value="">Selecciona un insumo...</option>
            {insumos.map((i) => (<option key={i.id} value={i.id}>{i.articulo}</option>))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-salvia-700">Nuevo precio</span>
          <input type="number" min="0" step="any" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]" />
        </label>
      </div>

      {insumoSel && (
        <p className="mt-2 text-xs text-muted">Precio actual: {money(insumoSel.coste)}</p>
      )}

      <button onClick={simular} disabled={cargando}
        className="mt-3 rounded-lg bg-ambar-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ambar-700 disabled:opacity-50">
        {cargando ? 'Calculando...' : 'Simular impacto'}
      </button>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {res && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-sm">
            <span className="font-semibold">{res.articulo}</span>: {money(res.precio_actual)} → {money(res.nuevo_precio)}{' '}
            <span className={res.variacion_pct >= 0 ? 'text-red-600' : 'text-green-700'}>({pct(res.variacion_pct)})</span>
          </p>
          {res.recetas.length === 0 ? (
            <p className="text-sm text-muted">Este insumo no se usa en ninguna receta.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="erp-table text-xs">
                <thead>
                  <tr>
                    <th>Receta</th>
                    <th className="!text-right">Costo actual</th>
                    <th className="!text-right">Costo nuevo</th>
                    <th className="!text-right">Incremento</th>
                    <th className="!text-right">Nuevo Food Cost</th>
                    <th className="!text-right">Precio sug.</th>
                    <th className="!text-center">Riesgo</th>
                  </tr>
                </thead>
                <tbody>
                  {res.recetas.map((r) => {
                    const rg = riesgoSim(r.food_cost_nuevo);
                    return (
                    <tr key={r.receta_id} className={r.fuera_objetivo ? 'bg-red-50/60' : ''}>
                      <td className="font-medium">{r.nombre}</td>
                      <td className="text-right">{money(r.costo_actual)}</td>
                      <td className="text-right">{money(r.costo_nuevo)}</td>
                      <td className="text-right text-red-600">+{money(r.incremento)}</td>
                      <td className={'text-right font-semibold ' + rg.text}>{(r.food_cost_nuevo * 100).toFixed(1)}%</td>
                      <td className={'text-right font-semibold ' + (r.fuera_objetivo ? 'text-[#DC2626]' : 'text-[#16A34A]')}>{money(r.precio_sugerido_nuevo)}</td>
                      <td className="text-center">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${rg.bg} ${rg.text} ${rg.border}`} title={`Nuevo Food Cost ${(r.food_cost_nuevo * 100).toFixed(1)}% - ${rg.label}`}>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: rg.dot }} />
                          {rg.label}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AnalisisDashboard({ analytics, insumos }: { analytics: AnalyticsData; insumos: { id: string; articulo: string; coste: number }[] }) {
  const [tab, setTab] = useState<'resumen' | 'impacto' | 'simular'>('resumen');
  const ind = analytics.indicadores;
  const maxAum = useMemo(() => Math.max(...analytics.top_aumentos.map((t) => Math.abs(t.variacion_pct)), 1), [analytics]);
  const maxRed = useMemo(() => Math.max(...analytics.top_reducciones.map((t) => Math.abs(t.variacion_pct)), 1), [analytics]);

  const alertaColor = (n: string) => (n === 'rojo' ? 'border-red-200 bg-red-50 text-red-700' : n === 'amarillo' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700');
  const alertaIcono = (n: string) => (n === 'rojo' ? '🔴' : n === 'amarillo' ? '🟡' : '🟢');

  return (
    <div className="space-y-6">
      {/* ═══ v9.9: LECTURA DEL PERÍODO — los números traducidos a decisiones ═══ */}
      {(ind.insumo_mas_inflacionario || ind.receta_mas_afectada) && (
        <section className="rounded-xl border-l-4 border-[#1E3A5F] bg-gradient-to-r from-slate-50 to-white p-4 shadow-sm">
          <p className="mb-2 flex items-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
            📣 Lectura del período — qué hacer con estos números
            <Ayuda titulo="Lectura del período"><p>La traducción de los indicadores a decisiones concretas: quién te está subiendo el costo, qué plato ya lo absorbió y hacia dónde va el menú. Si solo lees una cosa de esta vista, que sea esta.</p></Ayuda>
          </p>
          <div className="space-y-1.5 text-[13.5px] leading-relaxed text-slate-700">
            {ind.insumo_mas_inflacionario && (
              <p>1. <b>{ind.insumo_mas_inflacionario.articulo}</b> es tu prioridad de negociación: subió <b className="text-red-600">{pct(ind.insumo_mas_inflacionario.variacion_pct)}</b> en el período. Llama al proveedor con este dato en la mano — o busca alterno antes de que el Food Cost lo delate.</p>
            )}
            {ind.receta_mas_afectada && (
              <p>2. <b>{ind.receta_mas_afectada.receta}</b> ya absorbió <b className="text-red-600">+{money(ind.receta_mas_afectada.incremento_costo)}</b> de costo. Decide HOY: subir su precio, ajustar la porción, o aceptar el margen menor a conciencia — lo único prohibido es no decidir.</p>
            )}
            <p>3. El costo promedio del menú se movió <b className={ind.variacion_promedio >= 0 ? 'text-red-600' : 'text-green-700'}>{pct(ind.variacion_promedio)}</b>{ind.variacion_promedio > 2 ? ' — con los precios de carta quietos, ese movimiento sale directo de tu margen. Revisa el Panel: la sección "Dinero en la mesa" te dice dónde recuperarlo.' : ind.variacion_promedio < -2 ? ' — los costos bajaron: es la ventana para empujar los platos beneficiados SIN tocar precios y quedarte el margen extra.' : ' — el menú está estable: el momento ideal para trabajar fichas, mermas y subrecetas sin presión.'}</p>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-salvia-600">Insumo más inflacionario</p>
          {ind.insumo_mas_inflacionario ? (
            <>
              <p className="mt-1 truncate font-semibold text-ink" title={ind.insumo_mas_inflacionario.articulo}>🥑 {ind.insumo_mas_inflacionario.articulo}</p>
              <p className="text-2xl font-bold text-red-600">{pct(ind.insumo_mas_inflacionario.variacion_pct)}</p>
            </>
          ) : <p className="mt-1 text-muted">—</p>}
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-salvia-600">Receta más afectada</p>
          {ind.receta_mas_afectada ? (
            <>
              <p className="mt-1 truncate font-semibold text-ink" title={ind.receta_mas_afectada.receta}>🍽️ {ind.receta_mas_afectada.receta}</p>
              <p className="text-2xl font-bold text-red-600">+{money(ind.receta_mas_afectada.incremento_costo)}</p>
            </>
          ) : <p className="mt-1 text-muted">—</p>}
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-salvia-600">Variación promedio de costos</p>
          <p className={'mt-1 text-3xl font-bold ' + (ind.variacion_promedio >= 0 ? 'text-red-600' : 'text-green-700')}>{pct(ind.variacion_promedio)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-salvia-600">Recetas fuera de objetivo</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{ind.recetas_fuera_objetivo} recetas</p>
          <p className="text-xs text-muted">Food Cost &gt; {analytics.food_cost_objetivo}%</p>
        </div>
      </section>

      {analytics.alertas.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-bold text-ambar-700">🔔 Alertas automáticas
            <Ayuda titulo="Alertas automáticas"><p>El sistema vigila solo y avisa de tres cosas:</p><p>1. <b>Insumos que subieron</b> más del umbral configurado en los últimos 30 días (hoy: 5%).</p><p>2. <b>Recetas cuyo Food Cost superó el objetivo</b> — el margen ya está comprometido.</p><p>3. <b>Insumos en $0</b> usados en recetas activas: esos platos están SUBCOSTEADOS (parecen más rentables de lo que son).</p><p><b>Rojo</b> = actuar ya; <b>ámbar</b> = vigilar.</p></Ayuda></h2>
          <ul className="space-y-2">
            {analytics.alertas.map((a, i) => (
              <li key={i} className={'flex items-center gap-2 rounded-md border px-3 py-2 text-sm ' + alertaColor(a.nivel)}>
                <span>{alertaIcono(a.nivel)}</span><span>{a.mensaje}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Reportes */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-semibold text-ambar-700">📄 Reportes:</span>
          <button onClick={() => descargarCSV('variacion_precios', [['Insumo', 'Referencia', 'Precio base', 'Precio actual', 'Variacion abs', 'Variacion %', 'Cambios'], ...[...analytics.top_aumentos, ...analytics.top_reducciones].map((t) => [t.articulo, t.referencia, t.coste_base, t.coste_actual, t.variacion_abs, t.variacion_pct.toFixed(2), t.cambios])])}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50">Historial de precios (Excel)</button>
          <button onClick={() => descargarCSV('impacto_recetas', [['Receta', 'Insumo', 'Variacion insumo %', 'Incremento costo', 'Nuevo food cost %', 'Fuera de objetivo'], ...analytics.impacto_menu.map((x) => [x.receta, x.insumo, x.variacion_pct.toFixed(2), Math.round(x.incremento_costo), (x.food_cost * 100).toFixed(1), x.fuera_objetivo ? 'SI' : 'NO'])])}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50">Impacto en recetas (Excel)</button>
          <button onClick={() => descargarCSV('variacion_por_familia', [['Familia', 'Variacion %'], ...analytics.variacion_familia.map((f) => [f.familia, f.variacion_pct.toFixed(2)])])}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50">Variacion por familia (Excel)</button>
          <button onClick={() => descargarCSV('evolucion_costos', [['Fecha', 'Costo promedio'], ...analytics.evolucion_costo.map((e) => [e.fecha, Math.round(e.costo_promedio)])])}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50">Evolucion de costos (Excel)</button>
          <button onClick={() => window.print()}
            className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-slate-50">Exportar PDF (imprimir)</button>
        </div>
      </section>

      <div className="flex gap-2 border-b border-line">
        {([['resumen', 'Variación de costos'], ['impacto', 'Impacto en el menú'], ['simular', 'Simulación']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={'px-4 py-2 text-sm font-medium ' + (tab === k ? 'border-b-2 border-ambar-600 text-ambar-700' : 'text-muted hover:text-ink')}>{l}</button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h3 className="mb-3 font-semibold text-ink">Top 10 insumos con mayor aumento
              <Ayuda titulo="Top aumentos"><p>Los insumos que más subieron de precio (%) en el período, según su historial real de compras.</p><p><b>Es tu lista de negociación con proveedores.</b> Ejemplo: si CAMARÓN aparece +18%, revisa los platos marisqueros antes de que el Food Cost lo delate — o busca proveedor alterno.</p></Ayuda></h3>
              {analytics.top_aumentos.length === 0 ? <p className="text-sm text-muted">Sin aumentos registrados.</p> : (
                <div className="space-y-3">
                  {analytics.top_aumentos.map((t) => (
                    <div key={t.id} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-sm text-ink" title={t.articulo}>🔴 {t.articulo}</span>
                      <div className="flex-1"><BarraVar value={t.variacion_pct} max={maxAum} /></div>
                      <span className="w-16 shrink-0 text-right text-sm font-semibold text-red-600">{pct(t.variacion_pct)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="card p-5">
              <h3 className="mb-3 font-semibold text-ink">Top 10 insumos con mayor reducción
              <Ayuda titulo="Top reducciones"><p>Los insumos que más BAJARON de precio: oportunidades escondidas.</p><p><b>Ejemplo:</b> si el pulpo bajó 12%, es momento de empujar los platos que lo usan (sugerencia del mesero, especial del día) — margen extra sin subir un solo precio.</p></Ayuda></h3>
              {analytics.top_reducciones.length === 0 ? <p className="text-sm text-muted">Sin reducciones registradas.</p> : (
                <div className="space-y-3">
                  {analytics.top_reducciones.map((t) => (
                    <div key={t.id} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-sm text-ink" title={t.articulo}>🟢 {t.articulo}</span>
                      <div className="flex-1"><BarraVar value={t.variacion_pct} max={maxRed} /></div>
                      <span className="w-16 shrink-0 text-right text-sm font-semibold text-green-700">{pct(t.variacion_pct)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h3 className="mb-3 font-semibold text-ink">Variación por familia
              <Ayuda titulo="Variación por familia"><p>Agrupa el movimiento de costos por familia de insumos para ver <b>dónde vive la inflación de tu cocina</b>.</p><p><b>Ejemplo:</b> &quot;FRUVER +8% este mes&quot; te dice más que mirar 50 insumos sueltos — y orienta si el problema es un proveedor, una categoría o el mercado entero.</p></Ayuda></h3>
              <BarChart data={analytics.variacion_familia.map((f) => ({ label: f.familia, value: f.variacion_pct }))} />
            </section>
            <section className="card p-5">
              <h3 className="mb-3 font-semibold text-ink">Evolución semanal del costo promedio
              <Ayuda titulo="Evolución semanal"><p>La línea del costo promedio del menú: el sistema toma una <b>foto automática cada lunes 6 AM</b>.</p><p><b>Cómo leerla:</b> si la línea sube sostenida y tus precios siguen iguales, tu margen se encoge en silencio. Ejemplo: +4% en el trimestre con precios congelados = 4 puntos de Food Cost regalados.</p></Ayuda></h3>
              <LineChart points={analytics.evolucion_costo.map((e) => ({ x: e.fecha, y: e.costo_promedio }))} label="Costo promedio" />
              <p className="mt-2 text-center text-xs text-muted">Food Cost promedio actual del menú: <span className="font-semibold text-ink">{analytics.food_cost_promedio.toFixed(1)}%</span></p>
            </section>
          </div>
        </div>
      )}

      {tab === 'impacto' && (
        <section className="card p-5">
          <h3 className="mb-1 font-semibold text-ink">Impacto en el menú
          <Ayuda titulo="Impacto en el menú"><p>Traduce los movimientos de insumos a <b>platos concretos</b>: qué recetas cambiaron de costo en el período y cuánto.</p><p><b>Úsalo</b> para decidir precios plato por plato: si un ceviche subió $1.800 de costo, aquí lo ves con nombre y apellido — en vez de enterarte a fin de mes en el P&amp;G.</p></Ayuda></h3>
          <p className="mb-3 text-xs text-salvia-700">Recetas afectadas por la variación de precios, ordenadas de mayor a menor impacto.</p>
          {analytics.impacto_menu.length === 0 ? <p className="text-sm text-muted">Aún no hay impacto calculado.</p> : (
            <div className="overflow-x-auto">
              <table className="erp-table text-sm">
                <thead>
                  <tr>
                    <th>Receta</th>
                    <th>Insumo afectado</th>
                    <th className="!text-right">Variación insumo</th>
                    <th className="!text-right">Incremento del costo</th>
                    <th className="!text-right">Nuevo Food Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.impacto_menu.map((x, i) => (
                    <tr key={x.receta_id + '-' + x.insumo_id + '-' + i}>
                      <td className="font-medium">{x.receta}</td>
                      <td>{x.insumo}</td>
                      <td className={'text-right ' + (x.variacion_pct >= 0 ? 'text-red-600' : 'text-green-700')}>{pct(x.variacion_pct)}</td>
                      <td className="text-right font-semibold text-red-600">+{money(x.incremento_costo)}</td>
                      <td className={'text-right font-semibold ' + (x.fuera_objetivo ? 'text-red-600' : 'text-green-700')}>{(x.food_cost * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'simular' && <Simulador insumos={insumos} />}
    </div>
  );
}
