'use client';
import { fetchEnCola } from '@/lib/colaGuardado';
import { useRol } from '@/lib/useRol';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SearchableSelect from '@/components/SearchableSelect';
import { precioSugerido as precioSugeridoObjetivo, parametrosDesdeBackend, fcObjetivoDe, PARAMETROS_RESPALDO, type ParametrosCosteo } from '@/lib/costeo';
import { BookOpen, DollarSign, CheckCircle, TriangleAlert, Tag, CalendarClock } from 'lucide-react';

type Receta = any;
type Familia = { id: string; nombre: string; tipo?: string; activo: any; centrocosto?: string };
// PUNTO 2: datos que el SERVIDOR ya trae en el render (SSR). Si llegan nulos
// (fallo del backend), el cliente reintenta como antes.
type RecetasInicial = { recetas: any[]; familias: any[]; parametros: Record<string, unknown> };

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const fcPct = (n: number) => ((Number(n) || 0) * 100).toFixed(1) + '%';

// v10.11.3: los parametros salen de Configuracion (no de constantes clavadas).

// v10.11.3: los cortes ya no estan clavados en 33/35 %. Se calculan contra el
// Food Cost objetivo de CADA receta (el de su familia, o el global). Por eso
// el listado y la ficha de la receta ahora dicen lo mismo.
function semaforo(fc: number, fcObjetivo: number) {
  const v = Number(fc) || 0;
  const obj = fcObjetivo > 0 ? fcObjetivo : 0.35;
  if (v <= obj - 0.02) return { color: '#16A34A', text: 'text-[#16A34A]', bg: 'bg-[#DCFCE7]', border: 'border-[#BBF7D0]', emoji: '🟢', label: 'Rentable' };
  if (v <= obj) return { color: '#F59E0B', text: 'text-[#B45309]', bg: 'bg-[#FEF3C7]', border: 'border-[#FDE68A]', emoji: '🟡', label: 'Vigilar' };
  return { color: '#DC2626', text: 'text-[#DC2626]', bg: 'bg-[#FEE2E2]', border: 'border-[#FECACA]', emoji: '🔴', label: 'Accion inmediata' };
}

function Semaforo({ fc, fcObjetivo }: { fc: number; fcObjetivo: number }) {
  const s = semaforo(fc, fcObjetivo);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.bg} ${s.text} ${s.border}`}
      title={`Food Cost ${fcPct(fc)} - ${s.label}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
      <span className="tabular-nums">{fcPct(fc)}</span>
      <span className="hidden opacity-90 sm:inline">· {s.label}</span>
    </span>
  );
}

export default function RecetasClient({ initial }: { initial: RecetasInicial | null }) {
  const router = useRouter();
  const { puedeEditarRecetas } = useRol();
  const [recetas, setRecetas] = useState<Receta[]>(initial?.recetas ?? []);
  const [familias, setFamilias] = useState<Familia[]>(initial?.familias ?? []);
  const [loading, setLoading] = useState(!initial); // con datos del servidor no hay spinner
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function toggleActivo(r: Receta) {
    const nuevo = !(r.activo === true || r.activo === 'TRUE' || r.activo === 'VERDADERO' || r.activo === '' || r.activo === undefined);
    setSavingId(r.id);
    setRecetas((prev) => prev.map((x) => (x.id === r.id ? { ...x, activo: nuevo } : x)));
    try {
      const res = await fetchEnCola('/api/recetas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, activo: nuevo }),
      });
      const j = await res.json();
      if (!j.ok) {
        const em = j.error && typeof j.error === 'object' ? (j.error.message || JSON.stringify(j.error)) : (j.error || 'No se pudo actualizar el estado');
        throw new Error(em);
      }
    } catch (e: any) {
      setRecetas((prev) => prev.map((x) => (x.id === r.id ? { ...x, activo: r.activo } : x)));
      setError(e?.message || 'Error al cambiar el estado');
    } finally {
      setSavingId(null);
    }
  }

  const [q, setQ] = useState('');
  const [famSel, setFamSel] = useState('');
  const [fcSel, setFcSel] = useState('');
  const [estadoSel, setEstadoSel] = useState('activos');
  const [ccSel, setCcSel] = useState('');
  // v10.11.3: parámetros REALES de costeo, normalizados por lib/costeo.
  const [par, setPar] = useState<ParametrosCosteo>(initial ? parametrosDesdeBackend(initial.parametros) : PARAMETROS_RESPALDO);

  useEffect(() => {
    if (initial) return; // el servidor ya trajo los datos; no repetir al montar
    let cancel = false;
    async function load() {
      try {
        setLoading(true);
        // v10.11: UN VIAJE POR PANTALLA. Recetas + familias + parámetros de
        // costeo en una sola llamada, y esta sí sale del caché del backend
        // (60 s) — antes ninguna de las dos era cacheable y por eso volver al
        // listado siempre se quedaba esperando.
        const r = await fetch('/api/pantallas/recetas', { cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (cancel) return;
        if (!r.ok || !j?.ok || !j?.data) {
          throw new Error(j?.error || `El servidor respondió ${r.status}.`);
        }
        setRecetas(Array.isArray(j.data.recetas) ? j.data.recetas : []);
        setFamilias(Array.isArray(j.data.familias) ? j.data.familias : []);
        setPar(parametrosDesdeBackend(j.data.parametros));
      } catch (e: any) {
        if (!cancel) setError(e?.message || 'Error al cargar');
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, []);

  const famMap = useMemo(() => new Map(familias.map((f) => [f.id, f])), [familias]);

  const esReceta = (t?: string) => String(t || '').toLowerCase() === 'receta';
  const famRecetas = useMemo(
    () => familias.filter((f) => esReceta(f.tipo) || (!f.tipo && f.id !== 'FAM-000001')),
    [familias]
  );

  function famNombre(r: Receta) {
    const f = famMap.get(r.familia_id); // v9.4: familia directa
    return f ? f.nombre : 'Sin clasificar';
  }
  function esActivo(r: Receta) {
    return r.activo === true || r.activo === 'true' || r.activo === 'TRUE' || r.activo === 1;
  }

  // v9.4: el centro de costo de la receta es el de su FAMILIA (directo).
  const ccDe = (familia_id: string) => String(famMap.get(familia_id)?.centrocosto || '').toUpperCase();

  const filtradas = useMemo(() => {
    return recetas.filter((r) => {
      if (q && !String(r.nombre || '').toLowerCase().includes(q.toLowerCase())) return false;
      if (famSel && String(r.familia_id) !== String(famSel)) return false;
      if (ccSel && ccDe(r.familia_id) !== ccSel) return false;
      if (estadoSel === 'activos' && !esActivo(r)) return false;
      if (estadoSel === 'inactivos' && esActivo(r)) return false;
      const fc = Number(r.food_cost) || 0;
      // v10.11.3: relativos al objetivo de esta receta, no a 33/35 % fijos.
      const objR = fcObjetivoDe(par, r.familia_id);
      if (fcSel === 'verde' && !(fc <= objR - 0.02)) return false;
      if (fcSel === 'amarillo' && !(fc > objR - 0.02 && fc <= objR)) return false;
      if (fcSel === 'rojo' && !(fc > objR)) return false;
      return true;
    });
  }, [recetas, q, famSel, estadoSel, fcSel, ccSel, famMap]);

  const centrosCosto = useMemo(() => {
    const set = new Set<string>();
    recetas.forEach((r) => { const c = ccDe(r.familia_id); if (c) set.add(c); });
    return Array.from(set).sort();
  }, [recetas, famMap]);

  const grupos = useMemo(() => {
    const map = new Map<string, Receta[]>();
    for (const r of filtradas) {
      const key = famNombre(r); // v9.4: agrupar por familia, como el recetario
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtradas, famMap]);

  // v9.5: bloques por CENTRO DE COSTO — familias adentro. Sin CC digitado,
  // todo queda en el bloque plano y la vista es idéntica a la de siempre.
  const bloquesCC = useMemo(() => {
    const sin: [string, Receta[]][] = [];
    const por = new Map<string, Map<string, Receta[]>>();
    for (const [fam, items] of grupos) {
      const cc = items.length ? ccDe(items[0].familia_id) : '';
      if (!cc) { sin.push([fam, items]); continue; }
      if (!por.has(cc)) por.set(cc, new Map());
      por.get(cc)!.set(fam, items);
    }
    return {
      sin,
      grupos: Array.from(por.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([cc, m]) => [cc, Array.from(m.entries())] as [string, [string, Receta[]][]]),
    };
  }, [grupos, famMap]);

  const stats = useMemo(() => {
    const act = recetas.filter(esActivo);
    const n = act.length;
    const costoProm = n ? act.reduce((a, r) => a + (Number(r.costo_porcion) || 0), 0) / n : 0;
    const conFc = act.filter((r) => Number(r.food_cost) > 0);
    const fcProm = conFc.length ? conFc.reduce((a, r) => a + Number(r.food_cost), 0) / conFc.length : 0;
    // v10.11.3: "Rentables" y "Fuera de objetivo" se miden contra el objetivo
    // real de cada receta. Antes contaban contra un 35 % que nadie configuro,
    // y por eso "Fuera de objetivo" podia marcar 0 con platos ya pasados.
    const rentables = act.filter((r) => Number(r.food_cost) > 0 && Number(r.food_cost) <= fcObjetivoDe(par, r.familia_id)).length;
    const fuera = act.filter((r) => Number(r.food_cost) > fcObjetivoDe(par, r.familia_id)).length;
    const sinPrecio = act.filter((r) => !(Number(r.precio_real) > 0)).length;
    const hoy = new Date().toISOString().slice(0, 10);
    const actualizadasHoy = act.filter((r) => String(r.actualizado_en || '').slice(0, 10) === hoy).length;
    return { n, costoProm, fcProm, rentables, fuera, sinPrecio, actualizadasHoy };
  }, [recetas]);

  // v9.8.4: el sidebar se agrupa por CENTRO DE COSTO — familias sin CC
  // primero (planas, como siempre); las que tienen, bajo su encabezado 🏷.
  const familiasSidebar = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recetas.filter(esActivo)) {
      counts.set(String(r.familia_id), (counts.get(String(r.familia_id)) || 0) + 1);
    }
    const todas = famRecetas.map((f) => ({ fam: f, count: counts.get(String(f.id)) || 0 }));
    const sin = todas.filter((x) => !String(x.fam.centrocosto || '').trim());
    const por = new Map<string, typeof todas>();
    for (const x of todas) {
      const cc = String(x.fam.centrocosto || '').trim().toUpperCase();
      if (!cc) continue;
      if (!por.has(cc)) por.set(cc, []);
      por.get(cc)!.push(x);
    }
    return { sin, grupos: Array.from(por.entries()).sort((a, b) => a[0].localeCompare(b[0])) };
  }, [recetas, famRecetas]);

  return (
    <div className="app-shell flex min-h-screen gap-4">
      <aside className="hidden w-60 shrink-0 border-r border-salvia-100 bg-salvia-50/40 p-4 lg:block">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-salvia-500">Familias</h2>
        <button onClick={() => setFamSel('')} className={`mb-1 block w-full rounded-md px-2 py-1.5 text-left text-sm ${!famSel ? 'bg-ambar-100 font-semibold text-ambar-800' : 'text-salvia-700 hover:bg-salvia-100'}`}>Todas las recetas</button>
        {familiasSidebar.sin.map((g, i) => (
          <div key={'s' + i} className="mb-1">
            <button onClick={() => setFamSel(famSel === g.fam.id ? '' : g.fam.id)} className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-medium ${famSel === g.fam.id ? 'bg-ambar-100 text-ambar-800' : 'text-salvia-800 hover:bg-salvia-100'}`}>
              <span>{g.fam.nombre}</span>
              <span className="text-xs text-salvia-400">{g.count}</span>
            </button>
          </div>
        ))}
        {familiasSidebar.grupos.map(([cc, fams]) => (
          <div key={cc} className="mb-1 mt-3">
            <button onClick={() => setCcSel(ccSel === cc ? '' : cc)}
              title="Filtrar por este centro de costo"
              className={`mb-0.5 flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[11px] font-bold uppercase tracking-wide ${ccSel === cc ? 'bg-ambar-100 text-ambar-800' : 'text-ambar-700 hover:bg-ambar-50'}`}>
              <span>🏷 {cc}</span>
              <span className="font-normal text-salvia-400">{fams.reduce((a, x) => a + x.count, 0)}</span>
            </button>
            {fams.map((g, i) => (
              <button key={i} onClick={() => setFamSel(famSel === g.fam.id ? '' : g.fam.id)} className={`flex w-full items-center justify-between rounded-md py-1.5 pl-5 pr-2 text-left text-sm font-medium ${famSel === g.fam.id ? 'bg-ambar-100 text-ambar-800' : 'text-salvia-800 hover:bg-salvia-100'}`}>
                <span>{g.fam.nombre}</span>
                <span className="text-xs text-salvia-400">{g.count}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <main className="min-w-0 flex-1 py-6 lg:pl-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-salvia-100 pb-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-salvia-400">GastroCore · Recetario</p>
            <h1 className="font-display text-[32px] font-bold leading-tight text-ambar-700">Recetario</h1>
            <p className="mt-1 text-[16px] text-salvia-600">Consulta y administra tus recetas por familia, con costeo en tiempo real.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/recetas/familias" className="btn-secondary">Familias</Link>
            <Link href="/recetas/resumen" className="btn-secondary">Panel ejecutivo</Link>
            <a href="/recetario" target="_blank" rel="noopener" className="rounded-lg border border-ambar-300 bg-ambar-50 px-4 py-2 text-sm font-semibold text-ambar-700 hover:bg-ambar-100">📖 Ver recetario completo</a>
            {puedeEditarRecetas && <Link href="/recetas/nueva" className="btn-primary">+ Nueva receta</Link>}
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-5 md:grid-cols-4 xl:grid-cols-4">
          <Card label="Total recetas" value={String(stats.n)} tone="indigo" icon={<BookOpen size={18} strokeWidth={2} />} />
          <Card label="Costo promedio" value={money(stats.costoProm)} tone="blue" icon={<DollarSign size={18} strokeWidth={2} />} />
          <FoodCostCard fc={stats.fcProm} fcObjetivo={par.fcObjetivo} />
          <Card label="Rentables" value={String(stats.rentables)} tone="green" icon={<CheckCircle size={18} strokeWidth={2} />} />
          <Card label="Fuera de objetivo" value={String(stats.fuera)} tone="red" icon={<TriangleAlert size={18} strokeWidth={2} />} />
          <Card label="Sin precio" value={String(stats.sinPrecio)} tone="amber" icon={<Tag size={18} strokeWidth={2} />} />
          <Card label="Actualizadas hoy" value={String(stats.actualizadasHoy)} tone="neutral" icon={<CalendarClock size={18} strokeWidth={2} />} />
        </section>

        <section className="mb-6 flex flex-wrap items-center gap-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar receta..." className="min-w-[300px] flex-1 rounded-md border border-salvia-200 px-3 py-2 text-[15px] focus:border-ambar-400 focus:outline-none" />
          <div className="min-w-[250px] flex-1">
              <SearchableSelect
                value={famSel}
                onChange={(v) => setFamSel(v)}
                options={famRecetas.map((f) => ({ value: f.id, label: f.nombre }))}
                placeholder="Todas las familias"
                searchPlaceholder="Buscar familia…"
                clearLabel="Todas las familias"
              />
            </div>
          <select value={fcSel} onChange={(e) => setFcSel(e.target.value)} className="min-w-[220px] flex-1 rounded-md border border-salvia-200 px-3 py-2 text-[15px]">
            <option value="">Food Cost: todos</option>
            <option value="verde">Verde (&le;33%)</option>
            <option value="amarillo">Amarillo (33-35%)</option>
            <option value="rojo">Rojo (&gt;35%)</option>
          </select>
          <select value={estadoSel} onChange={(e) => setEstadoSel(e.target.value)} className="min-w-[180px] flex-1 rounded-md border border-salvia-200 px-3 py-2 text-[15px]">
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
          {centrosCosto.length > 0 && (
            <select value={ccSel} onChange={(e) => setCcSel(e.target.value)} className="min-w-[180px] flex-1 rounded-md border border-salvia-200 px-3 py-2 text-[15px]">
              <option value="">🏷 Centro de costo (todos)</option>
              {centrosCosto.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          )}
        </section>

        {loading ? (
          <p className="py-10 text-center text-salvia-500">Cargando recetas...</p>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : grupos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-salvia-200 p-10 text-center text-salvia-500">No hay recetas que coincidan con los filtros.</div>
        ) : (
          <div className="space-y-8">
            {bloquesCC.sin.length > 0 && (
              <div className="space-y-6">
            {bloquesCC.sin.map(([sub, items]) => (
                  <div key={sub}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-salvia-700"><span>{sub}</span><span className="rounded-full bg-salvia-100 px-2 text-xs text-salvia-500">{items.length}</span></h3>
                    <div className="card overflow-hidden">
                      <div className="erp-scroll">
                      <table className="erp-table recetas-table">
                        <thead>
                          <tr>
                            <th>Receta</th>
                            <th className="!text-right">Costo porcion</th>
                            <th className="!text-right">Precio venta</th>
                            <th className="!text-right">Precio sugerido</th>
                            <th className="!text-center">Food Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((r) => {
                            const fc = Number(r.food_cost);
                            const sinPrecio = !(Number(r.precio_real) > 0);
                            const objR = fcObjetivoDe(par, r.familia_id); // v10.11.3: objetivo de ESTA receta
                            const sugerido = precioSugeridoObjetivo(Number(r.costo_porcion), par, r.familia_id);
                            return (
                            <tr
                              key={r.id}
                              onClick={() => router.push(`/recetas/${r.id}`)}
                              className={esActivo(r) ? '' : 'bg-slate-50 text-slate-400 opacity-70'}
                            >
                              <td className="font-medium"><span className="text-[#2563EB]">{r.nombre}</span></td>
                              <td className="text-right fin-value">{money(Number(r.costo_porcion))}</td>
                              <td className="text-right fin-value">{Number(r.precio_real) > 0 ? money(Number(r.precio_real)) : <span className="text-[#B45309] font-medium">sin precio</span>}</td>
                              <td className="text-right fin-value">
                                {sinPrecio || !(fc > 0) ? (
                                  <span className="text-xs text-slate-400">-</span>
                                ) : fc > objR ? (
                                  <span className="font-semibold text-[#DC2626]" title="El precio debe aumentar para cumplir el objetivo">{money(sugerido)}</span>
                                ) : fc <= objR - 0.02 ? (
                                  <span className="font-semibold text-[#B45309]" title="El precio podria disminuir">{money(sugerido)}</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-semibold text-[#16A34A]" title="El precio actual cumple el objetivo"><span className="h-2 w-2 rounded-full bg-[#16A34A]" />&#10003; Correcto</span>
                                )}
                              </td>
                              <td className="text-center">{fc > 0 ? <Semaforo fc={fc} fcObjetivo={objR} /> : <span className="text-xs text-slate-400">-</span>}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {bloquesCC.grupos.map(([cc, fams]) => (
              <div key={cc}>
                <h2 className="mb-3 flex items-center gap-2 border-b border-ambar-200 pb-1.5 text-sm font-bold uppercase tracking-wide text-ambar-700">
                  🏷 {cc}
                  <span className="rounded-full bg-ambar-50 px-2 text-xs font-medium text-ambar-600">{fams.reduce((a, [, its]) => a + its.length, 0)} recetas</span>
                </h2>
                <div className="space-y-6">
            {fams.map(([sub, items]) => (
                    <div key={sub}>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-salvia-700"><span>{sub}</span><span className="rounded-full bg-salvia-100 px-2 text-xs text-salvia-500">{items.length}</span></h3>
                      <div className="card overflow-hidden">
                        <div className="erp-scroll">
                        <table className="erp-table recetas-table">
                          <thead>
                            <tr>
                              <th>Receta</th>
                              <th className="!text-right">Costo porcion</th>
                              <th className="!text-right">Precio venta</th>
                              <th className="!text-right">Precio sugerido</th>
                              <th className="!text-center">Food Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((r) => {
                              const fc = Number(r.food_cost);
                              const sinPrecio = !(Number(r.precio_real) > 0);
                              const objR = fcObjetivoDe(par, r.familia_id); // v10.11.3: objetivo de ESTA receta
                            const sugerido = precioSugeridoObjetivo(Number(r.costo_porcion), par, r.familia_id);
                              return (
                              <tr
                                key={r.id}
                                onClick={() => router.push(`/recetas/${r.id}`)}
                                className={esActivo(r) ? '' : 'bg-slate-50 text-slate-400 opacity-70'}
                              >
                                <td className="font-medium"><span className="text-[#2563EB]">{r.nombre}</span></td>
                                <td className="text-right fin-value">{money(Number(r.costo_porcion))}</td>
                                <td className="text-right fin-value">{Number(r.precio_real) > 0 ? money(Number(r.precio_real)) : <span className="text-[#B45309] font-medium">sin precio</span>}</td>
                                <td className="text-right fin-value">
                                  {sinPrecio || !(fc > 0) ? (
                                    <span className="text-xs text-slate-400">-</span>
                                  ) : fc > objR ? (
                                    <span className="font-semibold text-[#DC2626]" title="El precio debe aumentar para cumplir el objetivo">{money(sugerido)}</span>
                                  ) : fc <= objR - 0.02 ? (
                                    <span className="font-semibold text-[#B45309]" title="El precio podria disminuir">{money(sugerido)}</span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-semibold text-[#16A34A]" title="El precio actual cumple el objetivo"><span className="h-2 w-2 rounded-full bg-[#16A34A]" />&#10003; Correcto</span>
                                  )}
                                </td>
                                <td className="text-center">{fc > 0 ? <Semaforo fc={fc} fcObjetivo={objR} /> : <span className="text-xs text-slate-400">-</span>}</td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          </div>
        )}
      </main>
    </div>
  );
}

const TONES: Record<string, { bg: string; ring: string; icon: string; val: string }> = {
  neutral: { bg: 'bg-white', ring: 'border-line', icon: 'bg-slate-100 text-slate-500', val: 'text-ink' },
  blue: { bg: 'bg-[#EFF6FF]', ring: 'border-[#DBEAFE]', icon: 'bg-[#DBEAFE] text-[#2563EB]', val: 'text-[#1E3A5F]' },
  indigo: { bg: 'bg-[#EEF2FF]', ring: 'border-[#E0E7FF]', icon: 'bg-[#E0E7FF] text-[#1E3A5F]', val: 'text-[#1E3A5F]' },
  green: { bg: 'bg-[#ECFDF5]', ring: 'border-[#D1FAE5]', icon: 'bg-[#DCFCE7] text-[#16A34A]', val: 'text-[#16A34A]' },
  amber: { bg: 'bg-[#FFFBEB]', ring: 'border-[#FEF3C7]', icon: 'bg-[#FEF3C7] text-[#B45309]', val: 'text-[#B45309]' },
  red: { bg: 'bg-[#FEF2F2]', ring: 'border-[#FEE2E2]', icon: 'bg-[#FEE2E2] text-[#DC2626]', val: 'text-[#DC2626]' },
};

function Card({ label, value, tone = 'neutral', icon }: { label: string; value: string; tone?: string; icon?: ReactNode }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <div className={`card-hover flex h-full flex-col justify-between rounded-xl border ${t.ring} ${t.bg} p-5 shadow-card`}>
      <div className="flex items-start justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">{label}</p>
        {icon && <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.icon}`}>{icon}</span>}
      </div>
      <p className={`mt-3 text-[34px] font-bold leading-none tabular-nums tracking-tight ${t.val}`}>{value}</p>
    </div>
  );
}

function FoodCostCard({ fc, fcObjetivo }: { fc: number; fcObjetivo: number }) {
  const pct = Math.max(0, Math.min(1, fc));
  const s = semaforo(fc, fcObjetivo);
  const obj = fcObjetivo > 0 ? fcObjetivo : 0.35;
  const color = fc <= obj - 0.02 ? '#16A34A' : fc <= obj ? '#F59E0B' : '#DC2626';
  const bg = fc <= obj - 0.02 ? '#ECFDF5' : fc <= obj ? '#FFFBEB' : '#FEF2F2';
  const ring = fc <= obj - 0.02 ? '#D1FAE5' : fc <= obj ? '#FEF3C7' : '#FEE2E2';
  return (
    <div className="card-hover rounded-xl border p-4 shadow-card sm:col-span-2" style={{ backgroundColor: bg, borderColor: ring }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Food Cost prom.</p>
        <span className="text-[11px] font-semibold" style={{ color }}>{s.label}</span>
      </div>
      <div className="mt-2 flex items-end gap-3">
        <p className="text-3xl font-bold tabular-nums tracking-tight" style={{ color }}>{fcPct(fc)}</p>
      </div>
      <div className="progress-track mt-3">
        <div className="progress-fill" style={{ width: `${(pct * 100).toFixed(0)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
