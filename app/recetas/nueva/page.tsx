'use client';
import { fetchEnCola } from '@/lib/colaGuardado';
import { CampoNumero } from '@/components/CampoNumero';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parametrosDesdeBackend, fcObjetivoDe, precioSugerido as precioSugeridoDe, PARAMETROS_RESPALDO, type ParametrosCosteo } from '@/lib/costeo';
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

const UNIDADES = ['GRAMOS', 'KILOS', 'ML', 'LITROS', 'ONZA', 'COPA', 'UNIDADES'];

function NuevaRecetaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const modoEdicion = !!editId;

  // v10.10.5: estado visible de la carga en modo edición.
  const [cargandoEdicion, setCargandoEdicion] = useState(true); // v10.11: la carga es única y siempre ocurre
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  // v10.10.6: si el catálogo/familias no cargan, se avisa en vez de callar.
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [nombre, setNombre] = useState('');
  const [rendimiento, setRendimiento] = useState(1);
  const [desvioPct, setDesvioPct] = useState(0);
  const [refErp, setRefErp] = useState(''); // v10.4: emparejamiento ERP
  const [precioReal, setPrecioReal] = useState(0);
  // v8.0: FC objetivo e impuesto vienen de Configuración (con excepción por familia).
  const [fcGlobal, setFcGlobal] = useState(35);
  const [fcPorFamilia, setFcPorFamilia] = useState<Record<string, number>>({});
  // v10.11.2: los parámetros REALES de Configuración, ya normalizados.
  const [par, setPar] = useState<ParametrosCosteo>(PARAMETROS_RESPALDO);
  const [iva, setIva] = useState(8);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const cantRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errores, setErrores] = useState<string[]>([]);

  const [familiaId, setFamiliaId] = useState('');
  const [familias, setFamilias] = useState<Cat[]>([]);
  // v10.5b: este bloque DEBE vivir después de familiaId/familias (TDZ)
  // v10.5: EL APOYO — referencias de todas las recetas para sugerir y validar
  const [refsExistentes, setRefsExistentes] = useState<{ id: string; referencia: string }[]>([]);
  const ultimaSugerida = useRef('');
  // v10.10.6: ya NO se pide /api/recetas?all=true. El bootstrap (que esta misma
  // pantalla carga de todos modos) ya trae la lista de recetas, así que esa
  // llamada era un viaje repetido — y competía en la misma ráfaga que las demás.
  // Se alimenta desde el efecto del bootstrap, más abajo.
  // prefijo = 3 primeras letras de la familia (CEVICHES→CEV) + consecutivo libre
  useEffect(() => {
    if (modoEdicion) return;
    const fam = familias.find((x) => String(x.id) === String(familiaId));
    if (!fam) return;
    const prefijo = String(fam.nombre || '').toUpperCase().replace(/[^A-ZÑ]/g, '').slice(0, 3);
    if (!prefijo) return;
    let mayor = 0;
    refsExistentes.forEach(({ referencia: rf }) => {
      const m = rf.match(new RegExp('^' + prefijo + '(\\d+)$'));
      if (m) mayor = Math.max(mayor, parseInt(m[1], 10));
    });
    const sugerida = prefijo + String(mayor + 1).padStart(3, '0');
    // solo se auto-escribe si el campo está vacío o trae la sugerencia anterior
    if (!refErp.trim() || refErp === ultimaSugerida.current) {
      setRefErp(sugerida);
      ultimaSugerida.current = sugerida;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familiaId, familias, refsExistentes]);
  const refRepetida = useMemo(() => {
    const rf = refErp.trim().toUpperCase();
    if (!rf) return false;
    return refsExistentes.some((x) => x.referencia === rf && x.id !== (editId || ''));
  }, [refErp, refsExistentes, editId]);


  useEffect(() => {
    // v10.11: UN VIAJE POR PANTALLA. Un solo recurso trae catálogo, familias,
    // parámetros de costeo, las referencias para el consecutivo y — si estamos
    // editando — la receta con sus líneas. Antes eran 4 ejecuciones simultáneas
    // de Apps Script releyendo las mismas pestañas.
    let cancel = false;
    setCargandoEdicion(true);
    setErrorCarga(null);
    setErrorCatalogo(null);
    (async () => {
      try {
        const url = '/api/pantallas/editor-receta' + (editId ? `?id=${encodeURIComponent(editId)}` : '');
        const r = await fetch(url, { cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (cancel) return;
        if (!r.ok || !j?.ok || !j?.data) {
          throw new Error(
            j?.error ||
              (r.status === 401 ? 'Tu sesión expiró. Vuelve a entrar.'
                : r.status === 403 ? 'Tu rol no permite editar recetas.'
                : `El servidor respondió ${r.status}.`)
          );
        }
        const d = j.data;

        setFamilias((d.familias || []) as Cat[]);   // el backend ya filtra tipo receta
        setInsumos((d.catalogo || []) as Insumo[]);
        setRefsExistentes(((d.referencias || []) as { id: string; referencia?: string }[])
          .map((r2) => ({ id: r2.id, referencia: String(r2.referencia || '').trim().toUpperCase() })));

        // v10.11.2: parámetros REALES de Configuración, normalizados por lib/costeo.
        const parNorm = parametrosDesdeBackend(d.parametros);
        setPar(parNorm);
        const pb = d.parametros;
        if (pb) {
          if (Number(pb.fc_objetivo) > 0) setFcGlobal(Number(pb.fc_objetivo));
          if (pb.fc_por_familia) setFcPorFamilia(pb.fc_por_familia);
          if (Number(pb.impuesto_pct) >= 0) setIva(Number(pb.impuesto_pct));
        }

        // Modo edición: la receta viene en la MISMA respuesta.
        const rec = d.receta;
        if (editId && rec) {
          setNombre(rec.nombre || '');
          setRendimiento(Number(rec.rendimiento) || 1);
          setDesvioPct(Number(rec.desvio_pct) || 0);
          setRefErp(String((rec as { referencia?: string }).referencia || ''));
          setPrecioReal(Number(rec.precio_real) || 0);
          // El impuesto propio de la receta manda sobre el de Configuración.
          if (rec.iva !== undefined && rec.iva !== null && rec.iva !== '') setIva(Number(rec.iva));
          if (rec.familia_id) setFamiliaId(String(rec.familia_id));
          const ings = Array.isArray(rec.ingredientes) ? rec.ingredientes : [];
          if (ings.length) {
            setLineas(ings.map((g: any) => ({
              item_id: g.item_id || '',
              unidad: g.unidad_id || '',
              cantidad: Number(g.cantidad) || 0,
              merma_pct: Number(g.merma_pct) || 0,
              tipo_item: (g.tipo_item === 'subreceta' ? 'subreceta' : 'insumo'),
            })));
          }
        }
      } catch (e) {
        if (!cancel) {
          const msg = e instanceof Error ? e.message : 'No se pudo cargar la pantalla.';
          if (editId) setErrorCarga(msg); else setErrorCatalogo(msg);
        }
      } finally {
        if (!cancel) setCargandoEdicion(false);
      }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);




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
      // Tope 94.9% solo para la vista previa (el backend rechaza >= 95 al guardar).
      const mermaPct = Math.min(Math.max(Number(l.merma_pct) || 0, 0), 94.9);
      const cantReal = (Number(l.cantidad) || 0) / (1 - mermaPct / 100);
      const costoTotal = costoUnit * cantReal;
      return { ins, costoUnit, cantReal, costoTotal };
    });
  }, [lineas, insumoPorId]);

  const foodCostObjetivo = useMemo(() => {
    // v9.4: la excepción de FC se resuelve por la familia directa de la receta.
    // v10.11.2: una sola implementación (lib/costeo), con excepción por familia.
    return fcObjetivoDe(par, familiaId);
  }, [familiaId, par]);

  const costeo = useMemo(() => {
    const costoIngredientes = filas.reduce((s, f) => s + f.costoTotal, 0);
    const desvio = costoIngredientes * (desvioPct / 100);
    const costoFinal = costoIngredientes + desvio;
    const costoPorcion = costoFinal / (rendimiento || 1);
    // v10.11.2: el precio sugerido sale de lib/costeo, la misma función que
    // usarán /recetas y el Panel. El impuesto puede venir de la receta (campo
    // iva) y por eso se superpone al de Configuración.
    const parEfectivo: ParametrosCosteo = { ...par, inc: (Number(iva) || 0) / 100 };
    const precioSugerido = precioSugeridoDe(costoPorcion, parEfectivo, familiaId);
    const ivaFactor = 1 + (Number(iva) || 0) / 100;
    const precioBaseSugerido = precioSugerido / ivaFactor;
    const ivaSugerido = precioSugerido - precioBaseSugerido;
    const precioRealBase = precioReal > 0 ? precioReal / ivaFactor : 0;
    const foodCostReal = precioRealBase > 0 ? (costoPorcion / precioRealBase) * 100 : 0;
    const utilidad = precioRealBase - costoPorcion;
    const margenBruto = precioRealBase > 0 ? (utilidad / precioRealBase) * 100 : 0;
    return { costoIngredientes, desvio, costoFinal, costoPorcion, precioBaseSugerido, ivaSugerido, precioSugerido, precioRealBase, foodCostReal, utilidad, margenBruto };
  }, [filas, desvioPct, rendimiento, foodCostObjetivo, precioReal, iva, par, familiaId]);

  const addLinea = () =>
    setLineas((p) => [...p, { item_id: '', unidad: '', cantidad: 1, merma_pct: 0 }]);
  const updLinea = (i: number, patch: Partial<Linea>) =>
    setLineas((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const delLinea = (i: number) => setLineas((p) => p.filter((_, idx) => idx !== i));
  const dupLinea = (i: number) => setLineas((p) => { const c = { ...p[i] }; const n = [...p]; n.splice(i + 1, 0, c); return n; });

  const onInsumo = (i: number, ins: Insumo) => {
    // v8.0: precargar la merma estándar del insumo (el usuario puede ajustarla).
    const mermaStd = Number((ins as { merma_std?: number }).merma_std) || 0;
    updLinea(i, { item_id: ins.id, unidad: ins ? ins.unidad : '', tipo_item: ins.tipo_item || 'insumo', merma_pct: mermaStd });
  };

  function validar(): string[] {
    const e: string[] = [];
    if (nombre.trim() === '') e.push('El nombre de la receta es obligatorio.');
    if (!rendimiento || rendimiento < 1) e.push('El rendimiento debe ser al menos 1 porcion.');
    if (!familiaId) e.push('Elige la familia (categoría de la carta).');
    if (lineas.length === 0) e.push('Agrega al menos un ingrediente.');
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
        referencia: refErp.trim(), // v10.4: passthrough al ESQUEMA
        precio_real: precioReal,
        margen_objetivo: foodCostObjetivo,
        iva: Number(iva) || 0,
        familia_id: familiaId, // v9.4: familia directa
        ingredientes: lineas.map((l, idx) => ({
          tipo_item: l.tipo_item || 'insumo',
          item_id: l.item_id,
          cantidad: Number(l.cantidad),
          merma_pct: Number(l.merma_pct),
          unidad_id: l.unidad,
          orden: idx + 1,
        })),
      };
      const res = await fetchEnCola('/api/recetas', {
        method: modoEdicion ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modoEdicion ? { id: editId, ...payload } : payload),
      });
      const data = await res.json();
      if (data.ok) {
        router.push('/recetas');
      } else {
        setMsg((data.error && data.error.message) || data.error || 'No se pudo guardar la receta.');
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error inesperado al guardar.');
    } finally {
      setGuardando(false); cerrojo.current = false;
    }
  }

  const fcBadge = (fc: number) =>
    fc <= 0 ? 'text-salvia-400' : fc <= foodCostObjetivo * 100 ? 'text-green-700' : fc <= 40 ? 'text-ambar-600' : 'text-red-600';

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ambar-700">{modoEdicion ? 'Editar receta' : 'Nueva receta'}</h1>
          <p className="text-xs text-salvia-500">Costeo por ingrediente con merma real, sincronizado con la base.</p>
        </div>
        <Link href="/recetas" className="text-sm text-salvia-700 hover:underline">Volver</Link>
      </div>

      {/* v10.10.5: la carga en modo edición ya no falla en silencio. */}
      {cargandoEdicion && (
        <div className="mb-4 rounded-lg border border-salvia-200 bg-salvia-50 p-3 text-sm text-salvia-700">
          Cargando la pantalla…
        </div>
      )}
      {errorCarga && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>No se pudo cargar la receta.</strong> {errorCarga}
          <br />
          El formulario está vacío a propósito: si guardas ahora, sobrescribirías la receta con datos en blanco.
          Recarga la página o vuelve a Recetas.
        </div>
      )}

      {errorCatalogo && (
        <div className="mb-4 rounded-lg border border-ambar-200 bg-ambar-50 p-3 text-sm text-ambar-700">
          <strong>No se pudo cargar el catálogo.</strong> {errorCatalogo}
          <br />
          El buscador de insumos y la lista de familias van a salir vacíos. Recarga la página.
        </div>
      )}

      <div className="mb-4 card p-4">
        <p className="mb-3 flex items-center gap-2 border-b border-salvia-100 pb-2 text-[11px] font-bold uppercase tracking-widest text-salvia-500">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">1</span>
          📘 Datos del plato
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block sm:col-span-1">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Nombre de la receta</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Ceviche clasico"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Rendimiento (porciones)</span>
          <CampoNumero valor={rendimiento} onCambio={setRendimiento} decimales={0}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Referencia ERP <span className="normal-case text-salvia-400">(interna)</span></span>
          <input value={refErp} onChange={(e) => setRefErp(e.target.value)} placeholder="Elige la familia y se sugiere sola"
            className={'mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm uppercase text-ink transition focus:ring-2 focus:outline-none ' + (refRepetida ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-100' : 'border-line focus:border-[#2563EB] focus:ring-[#DBEAFE]')} />
          {refRepetida
            ? <span className="mt-1 block text-[11px] font-medium text-red-600">✘ Esa referencia ya la tiene otra receta</span>
            : refErp && <span className="mt-1 block text-[11px] text-emerald-700">✓ Libre — prefijo de la familia + consecutivo (editable)</span>}
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Desvio mercancia (%)</span>
          <CampoNumero valor={desvioPct} onCambio={setDesvioPct} decimales={1} sufijo="%"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] focus:outline-none" />
        </label>
        </div>
      </div>

      <div className="mb-4 card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-salvia-500"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">2</span> 🏷 Clasificacion</h2>
          <Link href="/recetas/familias" className="text-xs font-medium text-ambar-600 hover:underline">Administrar familias</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-salvia-500">Familia (categoría de la carta)</span>
            <SearchableSelect
                  value={familiaId}
                  onChange={(v) => setFamiliaId(v)}
                  options={familias.map((f) => ({ value: f.id, label: f.nombre }))}
                  placeholder="Elige la familia…"
                  searchPlaceholder="Buscar familia…"
                  clearLabel="Sin clasificar"
                />
          </label>
        </div>
        {familias.length === 0 && (<p className="mt-2 text-xs text-salvia-400">Aun no hay familias de platos de venta. <Link href="/recetas/familias" className="text-ambar-600 hover:underline">Crea la primera aqui</Link>.</p>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="card">
          <div className="sticky top-[70px] z-[100] flex items-center justify-between rounded-t-lg border-b border-salvia-100 bg-white px-5 py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-shadow duration-200">
            <h2 className="font-display text-base font-semibold text-salvia-800">Ingredientes ({lineas.length})</h2>
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

        <aside className="space-y-4 self-start lg:sticky lg:top-[90px]">
          <div className="ticket-panel">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[#1E3A5F]">Resumen de costeo</p>
            <div className="ticket-row"><span>Costo ingredientes</span><span>{money(costeo.costoIngredientes)}</span></div>
            <div className="ticket-row"><span>Desvio mercancia</span><span>{money(costeo.desvio)}</span></div>
            <div className="ticket-row"><span>Costo final</span><span>{money(costeo.costoFinal)}</span></div>
            <div className="ticket-row"><span>Costo del plato por porcion (sin impuestos)</span><span>{money(costeo.costoPorcion)}</span></div>
            <div className="ticket-row"><span>Food cost objetivo</span><span>{pct(foodCostObjetivo > 1 ? foodCostObjetivo : foodCostObjetivo * 100)}</span></div>
            <div className="my-1 border-t border-dashed border-salvia-200" />
            <div className="ticket-row font-semibold text-ambar-700"><span>Precio sugerido de venta (con INC)</span><span>{money(costeo.precioSugerido)}</span></div>
            <div className="my-1 border-t border-dashed border-salvia-200" />
            <div className="ticket-row"><span>Precio real de venta</span><span>{money(precioReal)}</span></div>
            <div className="ticket-row"><span>Utilidad</span><span>{money(costeo.utilidad)}</span></div>
            <div className="ticket-row"><span>Margen bruto</span><span>{pct(costeo.margenBruto)}</span></div>
            <div className={'ticket-total ' + fcBadge(costeo.foodCostReal)}><span>Food cost real</span><span>{pct(costeo.foodCostReal)}</span></div>
          </div>

          <div className="card p-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Precio real de venta</span>
              <CampoNumero valor={precioReal} onCambio={setPrecioReal} decimales={0}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#DBEAFE] focus:outline-none" />
            </label>
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

          <button onClick={guardar} disabled={guardando || (modoEdicion && (cargandoEdicion || !!errorCarga))} className="btn-primary w-full disabled:opacity-50">
            {guardando ? 'Guardando...' : modoEdicion ? 'Actualizar receta' : 'Guardar receta'}
          </button>
        </aside>
      </div>
    </main>
  );
}

export default function NuevaRecetaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-salvia-500">Cargando...</div>}>
      <NuevaRecetaInner />
    </Suspense>
  );
}
