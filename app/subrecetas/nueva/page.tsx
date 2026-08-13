'use client';
import { fetchEnCola } from '@/lib/colaGuardado';
import { BotonPDF } from '@/components/BotonPDF';
import { CampoNumero } from '@/components/CampoNumero';
import { useRol } from '@/lib/useRol';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SearchableSelect from '@/components/SearchableSelect';
import InsumoAutocomplete from '@/components/InsumoAutocomplete';

type Insumo = { id: string; referencia: string; articulo: string; unidad: string; coste: number; tipo_item?: 'insumo' | 'subreceta' };
type Linea = { item_id: string; unidad: string; cantidad: number; merma_pct: number; tipo_item?: 'insumo' | 'subreceta' };
type Cat = { id: string; nombre: string; familia_id?: string; tipo?: string };

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const pct = (n: number) => (n || 0).toFixed(2) + '%';
const num = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n || 0);

// v10.7: FALLBACK únicamente — la lista real sale de la tabla UnidadesMedida
// (una sola fuente de verdad: lo que agregues/quites allá, aparece aquí).
const UNIDADES_FALLBACK = ['GRAMOS', 'ONZA', 'COPA', 'UNIDADES'];

function NuevaSubrecetaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { puedeEditarRecetas } = useRol();
  const editId = searchParams.get('edit');
  const modoEdicion = !!editId;
  // v9.11: al ENTRAR a una subreceta se ve en modo lectura (como cuando se
  // registra, pero sin tocar nada). El botón ✏️ Editar desbloquea los campos.
  const [soloLectura, setSoloLectura] = useState(modoEdicion);

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [nombre, setNombre] = useState('');
  const [rendimiento, setRendimiento] = useState(1);
  const [unidadRendimiento, setUnidadRendimiento] = useState('GRAMOS');
  const [desvioPct, setDesvioPct] = useState(0);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const cantRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errores, setErrores] = useState<string[]>([]);

  // v9: el MAESTRO de la preparacion vive en INSUMOS — aqui se enlaza uno
  // existente ("SUB. ...") o se crea uno nuevo (referencia + subfamilia).
  // v10.3: llegar desde la vista INSUMOS con ?insumo=INS-xxx preselecciona
  // el enlace al maestro (mismos campos, cero lógica nueva de guardado).
  const insumoParam = searchParams.get('insumo') || '';
  const [insumoEnlazado, setInsumoEnlazado] = useState(insumoParam);
  const [unidadesCat, setUnidadesCat] = useState<string[]>([]); // v10.7: catálogo real
  const [busquedaSub, setBusquedaSub] = useState('');
  const [enlazadosIds, setEnlazadosIds] = useState<Set<string>>(new Set());
  const [referencia, setReferencia] = useState('');
  const [subfamiliaId, setSubfamiliaId] = useState('');
  const [subfamilias, setSubfamilias] = useState<Cat[]>([]);
  // v10.10.6: si el catálogo no carga, se avisa en vez de dejar los desplegables vacíos.
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  // v10.11: estado visible de la carga única de la pantalla.
  const [cargando, setCargando] = useState(true);
  const [insumoMaestro, setInsumoMaestro] = useState<{ articulo: string; referencia: string; coste: number } | null>(null);

  useEffect(() => {
    // v10.11: UN VIAJE POR PANTALLA. Un solo recurso trae catálogo,
    // subfamilias, unidades, los insumos ya enlazados y — si estamos
    // editando — la subreceta con sus líneas. Antes eran 6 peticiones
    // simultáneas; esa ráfaga era la que perdía lecturas.
    let cancel = false;
    setCargando(true);
    setErrorCatalogo(null);
    (async () => {
      try {
        const url = '/api/pantallas/editor-subreceta' + (editId ? `?id=${encodeURIComponent(editId)}` : '');
        const r = await fetch(url, { cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (cancel) return;
        if (!r.ok || !j?.ok || !j?.data) {
          throw new Error(
            j?.error ||
              (r.status === 401 ? 'Tu sesión expiró. Vuelve a entrar.'
                : r.status === 403 ? 'Tu rol no permite editar subrecetas.'
                : `El servidor respondió ${r.status}.`)
          );
        }
        const d = j.data;

        const us = ((d.unidades || []) as { codigo?: string; activo?: boolean | string }[])
          .filter((u) => u.activo === true || u.activo === 'TRUE' || u.activo === undefined || u.activo === '')
          .map((u) => String(u.codigo || '').toUpperCase()).filter(Boolean);
        if (us.length) setUnidadesCat(us);
        setSubfamilias((d.subfamilias || []) as Cat[]);   // el backend ya filtra tipo insumo
        setInsumos((d.catalogo || []) as Insumo[]);
        setEnlazadosIds(new Set(((d.enlazados || []) as string[]).map((x) => String(x))));

        // v10.3: si venimos de Insumos, sugerir el nombre desde el maestro
        if (insumoParam && !modoEdicion) {
          const ins = ((d.catalogo || []) as { id: string; articulo?: string }[]).find((x) => x.id === insumoParam);
          if (ins && ins.articulo) setNombre((prev) => prev || String(ins.articulo).replace(/^SUB\.\s*/i, ''));
        }

        // Modo edición: la subreceta viene en la MISMA respuesta.
        const rec = d.subreceta;
        if (editId && rec) {
          setNombre(rec.nombre || '');
          setRendimiento(Number(rec.rendimiento) || 1);
          setDesvioPct(Number(rec.desvio_pct) || 0);
          if (rec.insumo) {
            setInsumoMaestro({ articulo: rec.insumo.articulo, referencia: rec.insumo.referencia, coste: Number(rec.insumo.coste) || 0 });
          }
          if (rec.unidad_rendimiento_id) setUnidadRendimiento(String(rec.unidad_rendimiento_id));
          const ings = Array.isArray(rec.ingredientes) ? rec.ingredientes : [];
          if (ings.length) {
            setLineas(ings.map((g: any) => ({
              item_id: g.item_id || '',
              unidad: g.unidad_id || '',
              cantidad: Number(g.cantidad) || 0,
              merma_pct: Number(g.merma_pct) || 0,
              tipo_item: 'insumo',
            })));
          }
        }
      } catch (e) {
        if (!cancel) setErrorCatalogo(e instanceof Error ? e.message : 'No se pudo cargar la pantalla.');
      } finally {
        if (!cancel) setCargando(false);
      }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // v10.5: EL APOYO — siguiente referencia SUB### libre, calculada del catálogo.
  const sugerenciaRef = useMemo(() => {
    let mayor = 0;
    insumos.forEach((i) => {
      const m = String((i as { referencia?: string }).referencia || '').trim().toUpperCase().match(/^SUB(\d+)$/);
      if (m) mayor = Math.max(mayor, parseInt(m[1], 10));
    });
    return 'SUB' + String(mayor + 1).padStart(3, '0');
  }, [insumos]);
  // al abrir el panel de crear (sin enlace y campo vacío), la sugerencia se ofrece sola
  useEffect(() => {
    if (!modoEdicion && !insumoEnlazado && !referencia.trim() && insumos.length > 0) setReferencia(sugerenciaRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugerenciaRef, insumoEnlazado]);

  const insumoPorId = useMemo(() => {
    const m: Record<string, Insumo> = {};
    insumos.forEach((i) => (m[i.id] = i));
    return m;
  }, [insumos]);

  const filas = useMemo(() => {
    return lineas.map((l) => {
      const ins = insumoPorId[l.item_id];
      const costoUnit = ins ? Number(ins.coste) : 0;
      // v7.2: merma por RENDIMIENTO (gross-up ÷), igual que el backend y HioPOS.
      const mermaPct = Math.min(Math.max(Number(l.merma_pct) || 0, 0), 94.9);
      const cantReal = (Number(l.cantidad) || 0) / (1 - mermaPct / 100);
      const costoTotal = costoUnit * cantReal;
      return { ins, costoUnit, cantReal, costoTotal };
    });
  }, [lineas, insumoPorId]);

  const costeo = useMemo(() => {
    // v9: la subreceta es una FABRICACION — solo costeo, sin venta.
    const costoIngredientes = filas.reduce((s, f) => s + f.costoTotal, 0);
    const desvio = costoIngredientes * (desvioPct / 100);
    const costoFinal = costoIngredientes + desvio;
    const costoPorcion = costoFinal / (rendimiento || 1);
    return { costoIngredientes, desvio, costoFinal, costoPorcion };
  }, [filas, desvioPct, rendimiento]);

  const [actualizandoInsumo, setActualizandoInsumo] = useState(false);
  // v9.10: EL PUENTE a un clic — empuja el costo calculado al insumo maestro.
  async function actualizarCostoInsumo() {
    if (!editId) return;
    setActualizandoInsumo(true);
    try {
      const rp = await fetchEnCola('/api/subrecetas/actualizar-insumo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId }),
      });
      const jp = await rp.json();
      if (jp.ok) {
        if (jp.data?.sin_cambio) {
          setMsg('El insumo ya estaba al día con lo calculado.');
        } else {
          setMsg('✓ Insumo actualizado. ' + (jp.data?.recetas_recalculadas || ''));
          setInsumoMaestro((prev) => (prev ? { ...prev, coste: costeo.costoPorcion } : prev));
        }
      } else {
        setMsg('No se pudo actualizar el insumo: ' + ((jp.error && jp.error.message) || jp.error || ''));
      }
    } catch {
      setMsg('No se pudo actualizar el insumo.');
    } finally {
      setActualizandoInsumo(false);
    }
  }

  const addLinea = () =>
    setLineas((p) => [...p, { item_id: '', unidad: '', cantidad: 1, merma_pct: 0 }]);
  const updLinea = (i: number, patch: Partial<Linea>) =>
    setLineas((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const delLinea = (i: number) => setLineas((p) => p.filter((_, idx) => idx !== i));
  const dupLinea = (i: number) => setLineas((p) => { const c = { ...p[i] }; const n = [...p]; n.splice(i + 1, 0, c); return n; });

  const onInsumo = (i: number, ins: Insumo) => {
    const mermaStd = Number((ins as { merma_std?: number }).merma_std) || 0;
    updLinea(i, { item_id: ins.id, unidad: ins ? ins.unidad : '', tipo_item: ins.tipo_item || 'insumo', merma_pct: mermaStd });
  };

  function validar(): string[] {
    const e: string[] = [];
    if (nombre.trim() === '') e.push('El nombre de la receta es obligatorio.');
    if (!rendimiento || rendimiento < 1) e.push('El rendimiento debe ser al menos 1 porcion.');
    if (lineas.length === 0) e.push('Agrega al menos un ingrediente.');
    if (!modoEdicion && !insumoEnlazado) {
      if (!referencia.trim()) e.push('La referencia del maestro es obligatoria (o enlaza un insumo SUB. existente).');
      if (refDuplicada) e.push('La referencia ya existe: ' + refDuplicada.articulo);
      if (!subfamiliaId) e.push('Elige la subfamilia del maestro.');
    }
    lineas.forEach((l, idx) => {
      const n = idx + 1;
      if (!l.item_id) e.push('Ingrediente ' + n + ': selecciona un insumo.');
      if (!l.unidad) e.push('Ingrediente ' + n + ': falta la unidad.');
      if (!l.cantidad || Number(l.cantidad) <= 0) e.push('Ingrediente ' + n + ': la cantidad debe ser mayor a 0.');
      if (Number(l.merma_pct) < 0) e.push('Ingrediente ' + n + ': la merma no puede ser negativa.');
      const ins = insumoPorId[l.item_id];
      if (ins && Number(ins.coste) < 0) e.push('Ingrediente ' + n + ': costo invalido.');
    });
    return e;
  }

  const cerrojo = useRef(false); // v10.9b: anti doble-clic (síncrono)
  async function guardar() {
    if (cerrojo.current) return;
    cerrojo.current = true;
    const e = validar();
    setErrores(e);
    setMsg(null);
    // v10.9c: si la validación falla hay que LIBERAR el cerrojo antes de
    // salir — antes quedaba cerrado y el botón Guardar moría hasta recargar
    // (los errores viejos quedaban congelados en pantalla).
    if (e.length > 0) { cerrojo.current = false; return; }
    setGuardando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        rendimiento,
        merma_pct: 0,
        desvio_pct: desvioPct,
        // v10.4b: la referencia ERP de la subreceta ES la del maestro — se
        // llena sola (enlazado: su referencia; nuevo: la digitada arriba).
        // v10.6c: la referencia SOLO viaja al CREAR (donde el panel del maestro
        // la define). En EDICIÓN no se envía → el backend preserva la existente
        // (antes viajaba '' y cada guardado de edición la borraba).
        ...(modoEdicion ? {} : { referencia_erp: (insumoEnlazado ? String(insumoPorId[insumoEnlazado]?.referencia || '') : referencia.trim()) }),
        unidad_rendimiento_id: unidadRendimiento,
        // v9: maestro — enlazar existente O crear con referencia+subfamilia
        insumo_id: !modoEdicion && insumoEnlazado ? insumoEnlazado : undefined,
        referencia: !modoEdicion && !insumoEnlazado ? referencia.trim() : undefined,
        subfamilia_id: !modoEdicion && !insumoEnlazado ? subfamiliaId : undefined,
        ingredientes: lineas.map((l, idx) => ({
          tipo_item: 'insumo',
          item_id: l.item_id,
          cantidad: Number(l.cantidad),
          merma_pct: Number(l.merma_pct),
          unidad_id: l.unidad,
          orden: idx + 1,
        })),
      };
      const res = await fetchEnCola('/api/subrecetas', {
        method: modoEdicion ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modoEdicion ? { id: editId, ...payload } : payload),
      });
      const data = await res.json();
      if (data.ok) {
        const d = data.data || {};
        // v9.10: guardar y ya — sin interrogatorio. El puente vive como botón
        // consciente DENTRO de la subreceta (tarjeta del maestro en edición).
        router.push('/subrecetas');
      } else {
        setMsg((data.error && data.error.message) || data.error || 'No se pudo guardar la subreceta.');
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error inesperado al guardar.');
    } finally {
      setGuardando(false); cerrojo.current = false;
    }
  }

  // Preparaciones del maestro candidatas a migrar (insumos "SUB. ...")
  const refNormal = referencia.trim().toUpperCase();
  const refDuplicada = useMemo(() => {
    if (!refNormal || insumoEnlazado) return null;
    return insumos.find((i) => String((i as { referencia?: string }).referencia || '').trim().toUpperCase() === refNormal) || null;
  }, [refNormal, insumos, insumoEnlazado]);

  const candidatosEnlace = useMemo(() => {
    const t = busquedaSub.trim().toLowerCase();
    return insumos
      .filter((i) => /^SUB[\s.]/i.test(String(i.articulo || '')))
      .filter((i) => !enlazadosIds.has(String(i.id)))
      .filter((i) => !t || String(i.articulo).toLowerCase().includes(t) || String((i as { referencia?: string }).referencia || '').toLowerCase().includes(t))
      .slice(0, 30);
  }, [insumos, busquedaSub, enlazadosIds]);

  function seleccionarEnlace(id: string) {
    setInsumoEnlazado(id);
    const ins = insumoPorId[id];
    if (ins && !nombre.trim()) {
      setNombre(String(ins.articulo).replace(/^SUB[\s.]+/i, '').trim());
    }
  }


  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ambar-700">{!modoEdicion ? 'Nueva subreceta' : soloLectura ? 'Subreceta' : 'Editar subreceta'}</h1>
          <p className="text-xs text-salvia-500">Preparación base costeada por ingrediente. Su costo por unidad se usa como insumo en otras recetas.</p>
        </div>
        <div className="flex items-center gap-3">
          {modoEdicion && (
            <Link href={`/subrecetas/${editId}/ficha`}
              className="rounded-lg border border-[#1E3A5F] px-4 py-2 text-sm font-semibold text-[#1E3A5F] transition hover:bg-blue-50">
              📝 Ficha técnica
            </Link>
          )}
          {modoEdicion && soloLectura && puedeEditarRecetas && (
            <button onClick={() => setSoloLectura(false)}
              className="rounded-lg bg-ambar-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ambar-700">
              ✏️ Editar
            </button>
          )}
          {modoEdicion && editId && <BotonPDF id={editId} tipo="subreceta" />}
          <Link href="/subrecetas" className="text-sm text-salvia-700 hover:underline">Volver</Link>
        </div>
      </div>

      {cargando && !errorCatalogo && (
        <div className="mb-4 rounded-lg border border-salvia-200 bg-salvia-50 p-3 text-sm text-salvia-700">
          Cargando la pantalla…
        </div>
      )}
      {errorCatalogo && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>No se pudo cargar la pantalla.</strong> {errorCatalogo}
          <br />
          {modoEdicion
            ? 'El formulario está vacío a propósito: si guardas ahora, sobrescribirías la subreceta con datos en blanco. Recarga la página.'
            : 'Las subfamilias y el buscador de insumos van a salir vacíos. Recarga la página.'}
        </div>
      )}

      {!modoEdicion ? (
        <div className="mb-4 card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">1</span> 🔗 Maestro en Insumos</h2>
              <p className="text-xs text-salvia-500">
                Toda preparación vive en INSUMOS (es lo que las recetas usan). Enlaza un insumo
                &quot;SUB.&quot; existente, o crea el maestro nuevo con su referencia y subfamilia.
              </p>
            </div>
            {insumoEnlazado && (
              <button onClick={() => setInsumoEnlazado('')}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-salvia-700 hover:bg-neutral-50">
                ✕ Quitar enlace (crear maestro nuevo)
              </button>
            )}
          </div>
          {!insumoEnlazado ? (
            <>
              {/* v10.3b: DOS CAMINOS GEMELOS — buscar en Insumos o crear el maestro.
                  La referencia visible en ambos: chip en los candidatos, campo al crear. */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* ── CAMINO 1: buscar y enlazar desde INSUMOS ── */}
                <div className="rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#1E3A5F]">
                    🔍 Buscar en Insumos <span className="font-normal normal-case text-salvia-500">— la preparación ya existe como &quot;SUB.&quot;</span>
                  </p>
                  <input value={busquedaSub} onChange={(e) => setBusquedaSub(e.target.value)}
                    placeholder="Buscar por nombre o referencia… (ej: fondo, SUB-ARROZ)"
                    className="mb-2 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none" />
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-blue-100 bg-white">
                    {candidatosEnlace.length === 0 ? (
                      <p className="p-4 text-center text-xs text-salvia-500">No hay preparaciones &quot;SUB.&quot; sin enlazar que coincidan.</p>
                    ) : candidatosEnlace.map((i) => (
                      <button key={i.id} onClick={() => seleccionarEnlace(i.id)}
                        className="group flex w-full items-center justify-between gap-3 border-b border-l-2 border-b-line border-l-transparent px-3 py-2.5 text-left transition-colors last:border-b-0 hover:border-l-[#2563EB] hover:bg-blue-50/60">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800">{i.articulo}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">{(i as { referencia?: string }).referencia || '—'}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-[#1E3A5F]">${Number(i.coste).toLocaleString('es-CO')}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">{i.unidad}</span>
                          <span className="text-xs text-[#2563EB] opacity-0 transition group-hover:opacity-100">Enlazar →</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* ── CAMINO 2: crear el maestro NUEVO (referencia digitable) ── */}
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-800">
                    ➕ Crear maestro nuevo <span className="font-normal normal-case text-salvia-500">— la preparación NO existe aún en Insumos</span>
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-salvia-500">Referencia del maestro (código único — digítala)</span>
                    <input value={referencia} onChange={(e) => setReferencia(e.target.value)}
                      placeholder={sugerenciaRef}
                      className={'w-full rounded-lg border bg-white px-3 py-2 text-sm font-mono uppercase focus:outline-none ' + (refDuplicada ? 'border-red-400 bg-red-50' : 'border-amber-200 focus:border-amber-500')} />
                    {refDuplicada && <span className="mt-1 block text-[11px] font-medium text-red-600">✘ Ya existe: {refDuplicada.articulo}</span>}
                    {!refDuplicada && <span className="mt-1 block text-[11px] text-emerald-700">✓ Siguiente disponible: <b className="font-mono">{sugerenciaRef}</b> (editable)</span>}
                  </label>
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-medium text-salvia-500">Subfamilia del maestro</span>
                    <SearchableSelect
                      value={subfamiliaId}
                      onChange={(v) => setSubfamiliaId(v)}
                      options={subfamilias.map((s) => ({ value: s.id, label: s.nombre }))}
                      placeholder="Elige la subfamilia…"
                      searchPlaceholder="Buscar subfamilia…"
                      clearLabel="Sin clasificar"
                    />
                  </label>
                  <p className="mt-2 text-[11px] text-salvia-500">Al guardar, el insumo nace en Insumos con el NOMBRE tal cual lo digites (usa el prefijo SUB. si quieres que se agrupe como preparación), esta referencia y el costo calculado.</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm">
              <span className="text-base">🔗</span>
              <span><span className="text-xs uppercase tracking-wide text-blue-500">Enlazada a</span>{' '}
                <b className="text-slate-800">{insumoPorId[insumoEnlazado]?.articulo}</b></span>
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600 ring-1 ring-blue-200">{(insumoPorId[insumoEnlazado] as { referencia?: string } | undefined)?.referencia || '—'}</span>
              <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-xs font-semibold text-[#1E3A5F] ring-1 ring-blue-200">
                ${Number(insumoPorId[insumoEnlazado]?.coste || 0).toLocaleString('es-CO')}
              </span>
              <span className="text-xs text-salvia-600">al guardar podrás actualizarlo con el costo calculado</span>
            </div>
          )}
        </div>
      ) : insumoMaestro ? (
        <div className="mb-4 rounded-lg border border-line bg-white px-4 py-3 text-sm shadow-sm">
          {/* fila 1: identidad del maestro | su costo, alineados en los extremos */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-base">🔗</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-salvia-500">Maestro en Insumos</span>
              <b className="truncate text-slate-800">{insumoMaestro.articulo}</b>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{insumoMaestro.referencia}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-slate-50 px-2.5 py-0.5 font-mono text-sm font-semibold text-[#1E3A5F] ring-1 ring-slate-200">
                ${Number(insumoMaestro.coste).toLocaleString('es-CO')}
              </span>
              <span className="text-[11px] text-salvia-500">costo actual en INSUMOS</span>
            </div>
          </div>
          {/* fila 2: el puente — calculado vs actual, alineado con la fila 1 */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2">
            {Math.abs(costeo.costoPorcion - Number(insumoMaestro.coste)) > 0.01 ? (
              <>
                <span className="text-xs text-salvia-600">
                  La calculadora dice <b className="font-mono text-amber-700">${costeo.costoPorcion.toLocaleString('es-CO', { maximumFractionDigits: 2 })}</b> por {unidadRendimiento || 'unidad'}:
                </span>
                <button
                  type="button"
                  disabled={actualizandoInsumo}
                  onClick={actualizarCostoInsumo}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
                >
                  {actualizandoInsumo ? 'Actualizando…' : '⇪ Actualizar el costo del insumo según lo calculado'}
                </button>
                <span className="text-[11px] text-salvia-400">queda en el historial y recalcula las recetas que lo usan</span>
              </>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">✓ al día con lo calculado</span>
            )}
          </div>
        </div>
      ) : null}

      {/* v9.11: en modo lectura TODO lo editable queda apagado de un golpe */}
      <fieldset disabled={soloLectura} className="contents">
      <div className="mb-4 card p-4">
        <p className="mb-3 flex items-center gap-2 border-b border-salvia-100 pb-2 text-[11px] font-bold uppercase tracking-widest text-salvia-500">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">2</span>
          🥣 Datos de la preparación
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-1">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Nombre de la receta</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Ceviche clasico"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Rendimiento producido</span>
          <CampoNumero valor={rendimiento} onCambio={setRendimiento} decimales={2}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Unidad de rendimiento</span>
          <select value={unidadRendimiento} onChange={(e) => setUnidadRendimiento(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] focus:outline-none">
            {(unidadesCat.length ? unidadesCat : UNIDADES_FALLBACK).map((u) => (<option key={u} value={u}>{u}</option>))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Desvio mercancia (%)</span>
          <CampoNumero valor={desvioPct} onCambio={setDesvioPct} decimales={1} sufijo="%"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] focus:outline-none" />
        </label>
        </div>
      </div>

      {/* v9: la clasificación vive en el MAESTRO (Insumos) */}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="card">
          <div className="flex items-center justify-between border-b border-salvia-100 px-4 py-3">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-salvia-800"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">3</span> Ingredientes</h2>
            <button onClick={addLinea} className="btn-primary text-xs">+ Agregar ingrediente</button>
          </div>
          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th className="whitespace-nowrap !px-2 !py-2 !text-[11px]">Insumo</th>
                  <th className="whitespace-nowrap !px-2 !py-2 !text-[11px]">Unidad</th>
                  <th className="whitespace-nowrap !px-2 !py-2 !text-[11px] !text-right">Cantidad</th>
                  <th className="whitespace-nowrap !px-2 !py-2 !text-[11px] !text-right">% Merma</th>
                  <th className="whitespace-nowrap !px-2 !py-2 !text-[11px] !text-right">Cant. real</th>
                  <th className="whitespace-nowrap !px-2 !py-2 !text-[11px] !text-right">C. unitario</th>
                  <th className="whitespace-nowrap !px-2 !py-2 !text-[11px] !text-right">C. total</th>
                  <th className="whitespace-nowrap !px-2 !py-2 !text-[11px] !text-center">Accion</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i} className="border-b border-salvia-50 last:border-0">
                    <td className="px-3 py-2">
                      <InsumoAutocomplete
                        value={l.item_id}
                        insumos={insumos}
                        existingIds={lineas.filter((_, idx) => idx !== i).map((x) => x.item_id).filter(Boolean)}
                        onSelect={(ins) => onInsumo(i, ins)}
                        onCommit={() => cantRefs.current[i]?.focus()}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <span className="inline-block min-w-[64px] rounded-md bg-salvia-50 px-2 py-1.5 text-center text-sm text-salvia-700" title="La unidad la define el insumo en el maestro">{l.unidad || '—'}</span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <CampoNumero valor={l.cantidad} onCambio={(n) => updLinea(i, { cantidad: n })} decimales={2}
                        inputRef={(el) => { cantRefs.current[i] = el; }}
                        className="w-20 rounded-md border border-salvia-200 px-1.5 py-1.5 text-right text-sm focus:border-ambar-400 focus:outline-none" />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <CampoNumero valor={l.merma_pct} onCambio={(n) => updLinea(i, { merma_pct: n })} decimales={1} sufijo="%"
                        className="w-16 rounded-md border border-salvia-200 px-1.5 py-1.5 text-right text-sm focus:border-ambar-400 focus:outline-none" />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-right font-mono text-xs text-salvia-700">{num(filas[i]?.cantReal || 0)}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-right font-mono text-xs text-salvia-700">{money(filas[i]?.costoUnit || 0)}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-right font-mono text-xs font-semibold text-ambar-700">{money(filas[i]?.costoTotal || 0)}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => dupLinea(i)} title="Duplicar" className="text-salvia-400 hover:text-salvia-700">&#10697;</button>
                        <button onClick={() => delLinea(i)} title="Eliminar" className="text-salvia-400 hover:text-red-600">&#10005;</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {lineas.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-salvia-400">Aun no hay ingredientes. Presiona + Agregar ingrediente para comenzar.</td></tr>
                )}
              </tbody>
              {lineas.length > 0 && (
                <tfoot>
                  <tr className="border-t border-salvia-100 bg-salvia-50">
                    <td colSpan={6} className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-salvia-600">Costo ingredientes</td>
                    <td className="px-2 py-2 text-right font-mono text-sm font-bold text-ambar-700">{money(costeo.costoIngredientes)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border-2 border-[#2563EB] bg-[#EFF6FF] p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#1E3A5F]">Costo por unidad producida</p>
            <p className="mt-1 text-3xl font-bold text-[#1E3A5F]">{money(costeo.costoPorcion)}</p>
            <p className="mt-1 text-xs text-salvia-600">por {unidadRendimiento || 'unidad'} · rinde {rendimiento} {unidadRendimiento}</p>
            <p className="mt-2 text-[11px] text-salvia-500">Este valor se usará automáticamente como costo cuando esta subreceta se agregue a otras recetas.</p>
          </div>
          <div className="ticket-panel">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[#1E3A5F]">Resumen de costeo</p>
            <div className="ticket-row"><span>Costo ingredientes</span><span>{money(costeo.costoIngredientes)}</span></div>
            <div className="ticket-row"><span>Desvio mercancia</span><span>{money(costeo.desvio)}</span></div>
            <div className="ticket-row"><span>Costo final</span><span>{money(costeo.costoFinal)}</span></div>
            {/* v7.9: las subrecetas son FABRICACIONES — solo costeo. La venta
                (precio, food cost, margen) vive en la receta que las usa. */}
            <div className="ticket-total"><span>Costo por {unidadRendimiento || 'unidad'}</span><span>{money(costeo.costoPorcion)}</span></div>
          </div>

          {errores.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <p className="mb-1 font-semibold">Corrige lo siguiente:</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {errores.map((er, k) => (<li key={k}>{er}</li>))}
              </ul>
            </div>
          )}
          {msg && <p className="rounded-lg border border-ambar-200 bg-ambar-50 p-2 text-sm text-ambar-700">{msg}</p>}

          {!soloLectura && (
            <button onClick={guardar} disabled={guardando || cargando || (modoEdicion && !!errorCatalogo)} className="btn-primary w-full disabled:opacity-50">
              {guardando ? 'Guardando...' : modoEdicion ? 'Actualizar receta' : 'Guardar receta'}
            </button>
          )}

        </aside>
      </div>
      </fieldset>
    </main>
  );
}

export default function NuevaSubrecetaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-salvia-500">Cargando...</div>}>
      <NuevaSubrecetaInner />
    </Suspense>
  );
}
