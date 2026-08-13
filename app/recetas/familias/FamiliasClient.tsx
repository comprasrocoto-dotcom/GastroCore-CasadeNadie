'use client';

/**
 * ADMINISTRAR FAMILIAS — v9.3 (rediseño completo)
 *
 * Dos mundos claros, como opera el negocio:
 *   🍽 FAMILIAS DE RECETAS: las categorías de la carta. Cada tarjeta muestra
 *      su familia con centro de costo, cuántas recetas viven en ella y sus
 *      subfamilias adentro (la unión es visible, no un rompecabezas).
 *   📦 CLASIFICACIONES DE INSUMOS: las subfamilias del maestro (FRUVER,
 *      ABARROTES...), con su conteo de insumos y centro de costo.
 *
 * Reglas de trabajo:
 *   - Crear y editar EN LÍNEA (nombre + centro de costo juntos, un solo flujo).
 *   - El centro de costo se HEREDA: subfamilia vacía usa el de su familia.
 *   - Solo Admin muta; Chef y Lector ven todo en modo lectura.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { fetchEnCola } from '@/lib/colaGuardado';
import { useRol } from '@/lib/useRol';
import { Ayuda } from '@/components/Ayuda';

type Familia = { id: string; nombre: string; tipo?: string; activo: boolean | string; centrocosto?: string };
type Subfamilia = { id: string; familia_id: string; nombre: string; tipo?: string; activo: boolean | string; centrocosto?: string };

const esActivo = (v: boolean | string) => v === true || v === 'TRUE' || v === 'True' || v === '';

type FamiliasInicial = { familias: any[]; subfamilias: any[]; recetas: any[]; insumos: any[] };

export default function FamiliasClient({ initial }: { initial: FamiliasInicial | null }) {
  const { esAdmin } = useRol();

  const [familias, setFamilias] = useState<Familia[]>([]);
  const [subfamilias, setSubfamilias] = useState<Subfamilia[]>([]);
  const [usoRecetas, setUsoRecetas] = useState<Map<string, number>>(new Map());
  // v10.9d: las listas crudas (no solo conteos) para el modal Dónde se usa
  const [recetasLista, setRecetasLista] = useState<{ nombre: string; familia_id?: string }[]>([]);
  const [insumosLista, setInsumosLista] = useState<{ articulo: string; subfamilia_id?: string }[]>([]);
  const [usoInsumos, setUsoInsumos] = useState<Map<string, number>>(new Map());
  const [cargando, setCargando] = useState(!initial); // con datos del servidor no hay spinner
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // ── creación ──
  const [nuevaFamilia, setNuevaFamilia] = useState('');
  const [nuevaFamiliaCC, setNuevaFamiliaCC] = useState('');
  const [nuevaClasif, setNuevaClasif] = useState('');
  const [nuevaClasifCC, setNuevaClasifCC] = useState('');

  // ── edición en línea (un solo mecanismo para familias y subfamilias) ──
  const [edit, setEdit] = useState<{ clase: 'fam' | 'sub'; id: string; nombre: string; cc: string } | null>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  // v9.8.4b: BLINDAJE del foco. El foco al nombre se da UNA sola vez, cuando se
  // abre o cambia la edicion (clase+id) — nunca por teclear en otro campo.
  const editKey = edit ? edit.clase + ':' + edit.id : '';
  useEffect(() => {
    if (editKey) nombreRef.current?.focus();
  }, [editKey]);

  // PUNTO 2: sembrar el estado desde un payload de pantalla. Se usa tanto con los
  // datos que trae el SERVIDOR (SSR) como con los del refetch tras una edición,
  // así la transformación vive en UN solo lugar (no se puede desincronizar).
  const aplicar = useCallback((d: any) => {
    setFamilias((d?.familias || []).filter((f: Familia) => esActivo(f.activo)));
    setSubfamilias((d?.subfamilias || []).filter((s: Subfamilia) => esActivo(s.activo)));
    setRecetasLista((d?.recetas || []) as { nombre: string; familia_id?: string }[]);
    setInsumosLista((d?.insumos || []) as { articulo: string; subfamilia_id?: string }[]);
    const ur = new Map<string, number>();
    (d?.recetas || []).forEach((x: { familia_id?: string }) => {
      const k = String(x.familia_id || '');
      ur.set(k, (ur.get(k) || 0) + 1);
    });
    setUsoRecetas(ur);
    const ui = new Map<string, number>();
    (d?.insumos || []).forEach((x: { subfamilia_id?: string }) => {
      const k = String(x.subfamilia_id || '');
      ui.set(k, (ui.get(k) || 0) + 1);
    });
    setUsoInsumos(ui);
    setMsg(null);
  }, []);

  const cargar = useCallback(async () => {
    try {
      // v10.11: UN VIAJE POR PANTALLA. Antes eran cuatro peticiones en
      // paralelo, y dos de ellas traían las recetas y los 266 insumos
      // COMPLETOS solo para contar y para el modal "Dónde se usa".
      const r = await fetch('/api/pantallas/familias', { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok || !j?.data) {
        throw new Error(
          j?.error ||
            (r.status === 401 ? 'Tu sesión expiró. Vuelve a entrar.'
              : r.status === 403 ? 'Tu rol no permite ver esta pantalla.'
              : `El servidor respondió ${r.status}.`)
        );
      }
      aplicar(j.data);
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudieron cargar las familias.' });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (initial) { aplicar(initial); setCargando(false); return; } // SSR ya trajo los datos
    cargar();
  }, [cargar, aplicar, initial]);

  const esFamReceta = (f: Familia) => String(f.tipo || '').toLowerCase() === 'receta' || (!f.tipo && f.id !== 'FAM-000001');
  const famRecetas = useMemo(() => familias.filter(esFamReceta).sort((a, b) => a.nombre.localeCompare(b.nombre)), [familias]);
  const famInsumos = useMemo(() => familias.filter((f) => !esFamReceta(f)), [familias]);
  const famInsumoPrincipal = famInsumos[0] || null;

  const subsDe = useCallback((fid: string) => subfamilias.filter((s) => String(s.familia_id) === String(fid)), [subfamilias]);
  const clasifInsumos = useMemo(
    () => famInsumos.flatMap((f) => subsDe(f.id)).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [famInsumos, subsDe]
  );
  const recetasDeFamilia = (fid: string) => usoRecetas.get(String(fid)) || 0; // v9.4: conteo directo

  // ─────────────────────────── acciones ───────────────────────────
  // v10.9d: Dónde se usa — la lista real detrás del contador
  const [verUsos, setVerUsos] = useState<{ titulo: string; items: string[] } | null>(null);
  function usosDeFamilia(fid: string, nombre: string) {
    const items = recetasLista.filter((r) => String(r.familia_id) === String(fid)).map((r) => '🍽️ ' + r.nombre);
    setVerUsos({ titulo: 'Familia "' + nombre + '"', items });
  }
  function usosDeSubfamilia(sid: string, nombre: string) {
    const items = insumosLista.filter((r) => String(r.subfamilia_id) === String(sid)).map((r) => '📦 ' + r.articulo);
    setVerUsos({ titulo: 'Clasificación "' + nombre + '"', items });
  }
  const cerrojo = useRef(false); // v10.9b: anti doble-clic (un cerrojo para TODOS los botones)
  async function llamar(url: string, method: string, body: Record<string, unknown>, okTexto: string) {
    if (cerrojo.current) return false;
    cerrojo.current = true;
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetchEnCola(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json());
      if (r.ok) { setMsg({ tipo: 'ok', texto: okTexto }); await cargar(); return true; }
      setMsg({ tipo: 'error', texto: (r.error && r.error.message) || r.error || 'No se pudo guardar.' });
      return false;
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de red.' });
      return false;
    } finally {
      setOcupado(false);
      cerrojo.current = false;
    }
  }

  async function crearFamiliaReceta() {
    const nombre = nuevaFamilia.trim().toUpperCase();
    if (!nombre) return;
    if (await llamar('/api/familias', 'POST', { nombre, centrocosto: nuevaFamiliaCC.trim() }, `Familia "${nombre}" creada.`)) {
      setNuevaFamilia(''); setNuevaFamiliaCC('');
    }
  }
  async function crearClasifInsumo() {
    const nombre = nuevaClasif.trim().toUpperCase();
    if (!nombre || !famInsumoPrincipal) return;
    if (await llamar('/api/subfamilias', 'POST', { nombre, familia_id: famInsumoPrincipal.id, tipo: 'insumo', centrocosto: nuevaClasifCC.trim() }, `Clasificación "${nombre}" creada.`)) {
      setNuevaClasif(''); setNuevaClasifCC('');
    }
  }
  async function guardarEdicion() {
    if (!edit) return;
    const url = edit.clase === 'fam' ? '/api/familias' : '/api/subfamilias';
    if (await llamar(url, 'PUT', { id: edit.id, nombre: edit.nombre.trim().toUpperCase(), centrocosto: edit.cc.trim() }, 'Cambios guardados.')) {
      setEdit(null);
    }
  }
  async function desactivar(clase: 'fam' | 'sub', id: string, nombre: string, enUso: number) {
    const aviso = enUso > 0
      ? `"${nombre}" tiene ${enUso} ${clase === 'fam' ? 'receta(s)' : 'elemento(s)'} clasificados. Quedarán SIN clasificación visible hasta reasignarlos. ¿Desactivar igual?`
      : `¿Desactivar "${nombre}"?`;
    if (!window.confirm(aviso)) return;
    const url = clase === 'fam' ? '/api/familias' : '/api/subfamilias';
    await llamar(url, 'PUT', { id, activo: false }, `"${nombre}" desactivada.`);
  }

  // ─────────────────────────── piezas de UI ───────────────────────────
  function ChipCC({ cc, heredado }: { cc?: string; heredado?: string }) {
    if (cc) return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">🏷 {cc}</span>;
    if (heredado) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500" title="Heredado de la familia">🏷 {heredado} ↩</span>;
    return null;
  }

  // v9.8.4: función normal (NO componente). Si fuera <FilaEdicion/>, React la
  // recrearía en cada tecla, remontaría los inputs y el autoFocus del nombre
  // robaría el cursor al escribir el centro de costo (el bug reportado).
  function filaEdicion() {
    if (!edit) return null;
    return (
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <input
          ref={nombreRef}
          value={edit.nombre}
          onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
          className="min-w-[180px] flex-1 rounded-md border border-ambar-300 px-2 py-1.5 text-sm uppercase focus:border-ambar-400 focus:outline-none"
        />
        <input
          value={edit.cc}
          onChange={(e) => setEdit({ ...edit, cc: e.target.value })}
          placeholder="Centro de costo"
          className="w-40 rounded-md border border-salvia-200 px-2 py-1.5 text-xs uppercase focus:border-ambar-400 focus:outline-none"
        />
        <button onClick={guardarEdicion} disabled={ocupado} className="rounded bg-ambar px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Guardar</button>
        <button onClick={() => setEdit(null)} disabled={ocupado} className="rounded border border-salvia-200 px-3 py-1.5 text-xs text-salvia-600">Cancelar</button>
      </div>
    );
  }

  const botonEditar = (clase: 'fam' | 'sub', x: { id: string; nombre: string; centrocosto?: string }) => (
    <button
      onClick={() => setEdit({ clase, id: x.id, nombre: x.nombre, cc: String(x.centrocosto || '') })}
      className="rounded border border-salvia-200 px-2.5 py-1 text-xs text-salvia-600 hover:bg-salvia-50"
    >✏️ Editar</button>
  );

  // ─────────────────────────── render ───────────────────────────
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 border-b border-salvia-100 pb-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-salvia-400">GastroCore · Clasificaciones</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold text-ink">
            Administrar familias
            <Ayuda titulo="Cómo funciona la clasificación">
              <p><b>🍽 Familias de recetas</b> = las categorías de tu carta (ENTRADAS, CEVICHES…). Cada receta pertenece a una.</p>
              <p><b>📦 Clasificaciones de insumos</b> = cómo agrupas el maestro de compras (FRUVER, ABARROTES…).</p>
              <p><b>Centro de costo (🏷):</b> se hereda hacia abajo — si una subfamilia no tiene, usa el de su familia. Pon &quot;COCINA&quot; a la familia y afina solo donde haga falta.</p>
              <p><b>Desactivar</b> no borra nada: el historial y las recetas quedan intactos, solo deja de aparecer en los selectores.</p>
            </Ayuda>
          </h1>
          <Link href="/recetas" className="text-xs font-medium text-ambar-600 hover:underline">← Volver a recetas</Link>
        </div>
      </header>

      {msg && (
        <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg.texto}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-salvia-500">Cargando…</p>
      ) : (
        <div className="space-y-8">
          {/* ══════════ 🍽 FAMILIAS DE RECETAS ══════════ */}
          <section>
            <div className="mb-3 flex items-center gap-2 border-l-4 border-ambar-400 pl-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-salvia-600">🍽 Familias de recetas</h2>
              <span className="rounded-full bg-salvia-50 px-2 py-0.5 text-[11px] text-salvia-500">{famRecetas.length}</span>
            </div>

            {esAdmin && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-salvia-200 bg-white p-3">
                <input
                  value={nuevaFamilia}
                  onChange={(e) => setNuevaFamilia(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && crearFamiliaReceta()}
                  placeholder="Nueva familia (ej: POSTRES DE TEMPORADA)"
                  className="min-w-[220px] flex-1 rounded-md border border-salvia-200 px-3 py-2 text-sm uppercase focus:border-ambar-400 focus:outline-none"
                />
                <input
                  value={nuevaFamiliaCC}
                  onChange={(e) => setNuevaFamiliaCC(e.target.value)}
                  placeholder="Centro de costo (opcional)"
                  className="w-48 rounded-md border border-salvia-200 px-3 py-2 text-xs uppercase focus:border-ambar-400 focus:outline-none"
                />
                <button onClick={crearFamiliaReceta} disabled={ocupado || !nuevaFamilia.trim()} className="rounded-lg bg-ambar px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  + Crear
                </button>
              </div>
            )}

            <ul className="space-y-2">
              {famRecetas.map((f) => {
                const subs = subsDe(f.id);
                const nRec = recetasDeFamilia(f.id);
                return (
                  <li key={f.id} className="rounded-xl border border-salvia-100 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {edit && edit.clase === 'fam' && edit.id === f.id ? filaEdicion() : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-ink">{f.nombre}</span>
                            <ChipCC cc={f.centrocosto} />
                            <span className="text-[11px] text-salvia-400">{nRec} receta{nRec === 1 ? '' : 's'}</span>
                          </div>
                          {esAdmin && (
                            <div className="flex items-center gap-2">
                              {botonEditar('fam', f)}
                              <button onClick={() => usosDeFamilia(f.id, f.nombre)} disabled={ocupado} className="mr-1 rounded border border-line px-2.5 py-1 text-xs text-salvia-700 hover:bg-salvia-50">🔎 Ver recetas</button>
                              <button onClick={() => desactivar('fam', f.id, f.nombre, nRec)} disabled={ocupado} className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">Desactivar</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                                      </li>
                );
              })}
            </ul>
          </section>

          {/* ══════════ 📦 CLASIFICACIONES DE INSUMOS ══════════ */}
          <section>
            <div className="mb-3 flex items-center gap-2 border-l-4 border-blue-400 pl-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-salvia-600">📦 Clasificaciones de insumos</h2>
              <span className="rounded-full bg-salvia-50 px-2 py-0.5 text-[11px] text-salvia-500">{clasifInsumos.length}</span>
              <Ayuda titulo="Clasificaciones de insumos">
                <p>Son las subfamilias del maestro de INSUMOS: agrupan tus compras (FRUVER, ABARROTES, LICORES…) y también las preparaciones &quot;SUB.&quot;.</p>
                <p>El número entre paréntesis es cuántos insumos viven en cada una. El 🏷 es su centro de costo (si está vacío, hereda el de la familia INSUMOS).</p>
              </Ayuda>
            </div>

            {esAdmin && famInsumoPrincipal && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-blue-200 bg-white p-3">
                <input
                  value={nuevaClasif}
                  onChange={(e) => setNuevaClasif(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && crearClasifInsumo()}
                  placeholder="Nueva clasificación (ej: EMPAQUES)"
                  className="min-w-[220px] flex-1 rounded-md border border-salvia-200 px-3 py-2 text-sm uppercase focus:border-blue-400 focus:outline-none"
                />
                <input
                  value={nuevaClasifCC}
                  onChange={(e) => setNuevaClasifCC(e.target.value)}
                  placeholder="Centro de costo (opcional)"
                  className="w-48 rounded-md border border-salvia-200 px-3 py-2 text-xs uppercase focus:border-blue-400 focus:outline-none"
                />
                <button onClick={crearClasifInsumo} disabled={ocupado || !nuevaClasif.trim()} className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  + Crear
                </button>
              </div>
            )}

            <ul className="grid gap-2 sm:grid-cols-2">
              {clasifInsumos.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-salvia-100 bg-white px-3 py-2.5">
                  {edit && edit.clase === 'sub' && edit.id === s.id ? filaEdicion() : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{s.nombre}</span>
                        <ChipCC cc={s.centrocosto} heredado={famInsumoPrincipal?.centrocosto} />
                        <span className="text-[11px] text-salvia-400">{usoInsumos.get(s.id) || 0} insumos</span>
                      </div>
                      {esAdmin && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          {botonEditar('sub', s)}
                          <button onClick={() => usosDeSubfamilia(s.id, s.nombre)} disabled={ocupado} className="mr-1 rounded border border-line px-2 py-1 text-xs text-salvia-700 hover:bg-salvia-50">🔎</button>
                          <button onClick={() => desactivar('sub', s.id, s.nombre, usoInsumos.get(s.id) || 0)} disabled={ocupado} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">✕</button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      {verUsos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setVerUsos(null)}>
          <div className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">🔎 {verUsos.titulo}</h2>
              <button onClick={() => setVerUsos(null)} className="rounded-lg px-2 py-1 text-sm hover:bg-slate-100">✕</button>
            </div>
            {verUsos.items.length === 0 ? (
              <p className="text-sm text-salvia-600">No tiene elementos parametrizados todavía.</p>
            ) : (
              <ul className="space-y-1.5">
                {verUsos.items.map((x, i) => (<li key={i} className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-800">{x}</li>))}
              </ul>
            )}
            <p className="mt-3 text-right text-[11px] text-salvia-500">{verUsos.items.length} elemento(s)</p>
          </div>
        </div>
      )}
    </main>
  );
}
