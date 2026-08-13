'use client';
import { fetchEnCola } from '@/lib/colaGuardado';
import { APP_VERSION } from '@/lib/version';
import { TEMAS } from '@/lib/temasRecetario';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Configuración (solo ADMIN) — /configuracion  · v8.0
 * 1. Parámetros de costeo: Food Cost objetivo (global y por familia) e
 *    impuesto al consumo. Al guardar, el backend RECALCULA todo el menú.
 * 2. Umbral de alertas de Análisis (% de subida que dispara alerta roja).
 * 3. Mermas estándar por insumo (se precargan en los editores de recetas).
 * 4. Respaldo: copia Excel del Sheet completo con un clic.
 * 4b. Poner costos al día (v10.10.3): barrido completo de costeo para
 *     cuando alguien editó Costes DIRECTO en la hoja de Google.
 * 5. Credenciales: rotación guiada del API token y del AUTH_SECRET.
 * 6. Carpeta de fotos del recetario (Drive).
 */

type Carpeta = { folder_id: string; nombre: string; url: string };
type Familia = { id: string; nombre: string; tipo: string };
type Parametros = {
  fc_objetivo: number;
  fc_por_familia: Record<string, number>;
  impuesto_pct: number;
  alerta_subida_pct: number;
  familias?: Familia[];
};
type InsumoLite = { id: string; articulo: string; unidad: string; merma_std?: number };
type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null;

/**
 * v10.11 — UNA SOLA CARGA PARA TODA LA PANTALLA.
 *
 * Antes cada sección se cargaba por su cuenta y CUATRO de ellas pedían
 * /api/config/parametros por separado (identidad, parámetros, estilo del
 * recetario y "Acerca del sistema"), más /api/familias y /api/insumos: seis
 * peticiones al abrir. Ahora hay un único fetch y las secciones lo consumen.
 *
 * `recargar()` existe para las secciones que GUARDAN: al terminar piden los
 * datos frescos y toda la pantalla se entera, sin recargar el navegador.
 */
type DatosConfig = {
  parametros: (Parametros & Record<string, any>) | null;
  familias: Familia[];
  mermas: InsumoLite[];
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<void>;
};

const ConfigCtx = createContext<DatosConfig>({
  parametros: null, familias: [], mermas: [], cargando: true, error: null,
  recargar: async () => {},
});
const useConfig = () => useContext(ConfigCtx);

function ProveedorConfig({ children }: { children: ReactNode }) {
  const [parametros, setParametros] = useState<(Parametros & Record<string, any>) | null>(null);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [mermas, setMermas] = useState<InsumoLite[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      const r = await fetch('/api/pantallas/configuracion', { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok || !j?.data) {
        throw new Error(
          j?.error ||
            (r.status === 401 ? 'Tu sesión expiró. Vuelve a entrar.'
              : r.status === 403 ? 'Esta pantalla es solo para Admin.'
              : `El servidor respondió ${r.status}.`)
        );
      }
      setParametros(j.data.parametros || null);
      setFamilias((j.data.familias || []) as Familia[]);
      setMermas((j.data.mermas || []) as InsumoLite[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la configuración.');
    }
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => { await recargar(); if (!cancel) setCargando(false); })();
    return () => { cancel = true; };
  }, [recargar]);

  return (
    <ConfigCtx.Provider value={{ parametros, familias, mermas, cargando, error, recargar }}>
      {children}
    </ConfigCtx.Provider>
  );
}

export default function ConfiguracionPage() {
  return (
    <ProveedorConfig>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ambar-600">Solo Admin</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">Configuración</h1>
        <p className="mt-1 text-sm text-salvia-600">Los parámetros que gobiernan el costeo, las alertas y la identidad del sistema.</p>
      </header>
      <AvisoCarga />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2"><SeccionIdentidad /></div>
        <div className="lg:col-span-2"><SeccionEstiloRecetario /></div>
        <div className="lg:col-span-2"><SeccionAcercaDe /></div>
        <div className="lg:col-span-2"><SeccionParametros /></div>
        <div className="lg:col-span-2"><SeccionMermas /></div>
        <div className="lg:col-span-2"><SeccionRecalcular /></div>{/* v10.10.3 */}
        <SeccionRespaldo />
        <SeccionCarpetaFotos />
        <div className="lg:col-span-2"><SeccionCredenciales /></div>
      </div>
    </main>
    </ProveedorConfig>
  );
}

/** v10.11: un solo aviso para toda la pantalla, en vez de secciones mudas. */
function AvisoCarga() {
  const { cargando, error } = useConfig();
  if (error) return (
    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <strong>No se pudo cargar la configuración.</strong> {error}
      <br />Los valores de abajo pueden salir vacíos. Recarga la página.
    </div>
  );
  if (cargando) return (
    <div className="mb-5 rounded-lg border border-salvia-200 bg-salvia-50 p-3 text-sm text-salvia-700">
      Cargando la configuración…
    </div>
  );
  return null;
}

/* Cabecera visual homogénea de cada tarjeta */
function CabeceraSeccion({ icono, tono, titulo, descripcion }:
  { icono: string; tono: string; titulo: string; descripcion: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ' + tono}>{icono}</span>
      <div>
        <h2 className="text-[15px] font-bold text-slate-900">{titulo}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-salvia-600">{descripcion}</p>
      </div>
    </div>
  );
}

/* ══════════════ 0. IDENTIDAD DEL NEGOCIO ══════════════ */
function SeccionIdentidad() {
  const [nombre, setNombre] = useState('');
  const [original, setOriginal] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);

  // v10.11: el dato viene de la carga única de la pantalla.
  const { parametros, recargar } = useConfig();
  useEffect(() => {
    const n = parametros?.nombre_negocio;
    if (n) { setNombre(String(n)); setOriginal(String(n)); }
  }, [parametros]);

  async function guardar() {
    const n = nombre.trim();
    if (!n || n === original) return;
    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetchEnCola('/api/config/parametros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_negocio: n }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      setOriginal(n);
      await recargar(); // v10.11: toda la pantalla se entera del cambio
      setMsg({ tipo: 'ok', texto: 'Nombre guardado. El recetario público y los PDF lo mostrarán en unos minutos (caché de 5 min).' });
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error inesperado' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <CabeceraSeccion icono="🏪" tono="bg-ambar-100 text-ambar-700"
        titulo="Identidad del negocio"
        descripcion="El nombre aparece en el recetario público que ve el equipo de cocina y en la cabecera de los PDF de recetas." />
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60}
          placeholder="Ej: Rocoto, Malanga, Arrebatao…"
          className="flex-1 rounded-lg border border-line px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none" />
        <button onClick={guardar} disabled={guardando || !nombre.trim() || nombre.trim() === original}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {msg && (
        <p className={'mt-3 rounded-lg px-3 py-2 text-xs ' + (msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {msg.texto}
        </p>
      )}
    </section>
  );
}

function SeccionParametros() {
  const [par, setPar] = useState<Parametros | null>(null);
  const [fc, setFc] = useState(35);
  const [imp, setImp] = useState(8);
  const [umbral, setUmbral] = useState(15);
  const [porFam, setPorFam] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);
  // v10.11: parámetros Y familias vienen de la carga única de la pantalla.
  // (En 10.10.4 las familias se pedían aparte porque el recurso de parámetros
  // no las incluía; ahora el recurso de pantalla trae las dos cosas juntas.)
  const { parametros, familias, recargar } = useConfig();
  useEffect(() => {
    if (!parametros) return;
    const p = parametros as Parametros;
    setPar(p);
    setFc(p.fc_objetivo);
    setImp(p.impuesto_pct);
    setUmbral(p.alerta_subida_pct);
    setPorFam(p.fc_por_familia || {});
  }, [parametros]);

  const familiasVenta = useMemo(
    () => (familias || []).filter((f) => String(f.tipo).toLowerCase() === 'receta'),
    [familias]
  );

  async function guardar() {
    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetchEnCola('/api/config/parametros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fc_objetivo: fc, impuesto_pct: imp, alerta_subida_pct: umbral, fc_por_familia: porFam }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      await recargar(); // v10.11: refresca la pantalla con los valores recién guardados
      setMsg({
        tipo: 'ok',
        texto: j.recalculo
          ? 'Parámetros guardados. ' + j.recalculo + ' — precios sugeridos y food cost actualizados en todo el menú.'
          : 'Parámetros guardados (sin cambios que afecten precios).',
      });
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error inesperado' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <CabeceraSeccion icono="🎯" tono="bg-blue-100 text-blue-700"
        titulo="Parámetros de costeo"
        descripcion="Definen el precio sugerido y el food cost de todas las recetas. Al guardar cambios, el sistema recalcula el menú completo (con rastro en el historial de cada receta)." />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Food cost objetivo (%)</span>
          <input type="number" min={1} max={90} step={0.5} value={fc}
            onChange={(e) => setFc(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Impuesto al consumo (%)</span>
          <input type="number" min={0} max={40} step={0.5} value={imp}
            onChange={(e) => setImp(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Alerta roja si un insumo sube más de (%)</span>
          <input type="number" min={1} max={100} step={1} value={umbral}
            onChange={(e) => setUmbral(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-salvia-600">
          Excepciones de food cost por familia <span className="normal-case font-normal">(vacío = usa el global)</span>
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {familiasVenta.map((f) => (
            <label key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
              <span className="text-sm">{f.nombre}</span>
              <span className="flex items-center gap-1 text-xs text-salvia-500">
                <input type="number" min={0} max={90} step={0.5}
                  value={porFam[f.id] ?? ''}
                  placeholder={String(fc)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPorFam((prev) => {
                      const n = { ...prev };
                      if (v === '' || Number(v) <= 0) delete n[f.id];
                      else n[f.id] = Number(v);
                      return n;
                    });
                  }}
                  className="w-20 rounded border border-line px-2 py-1 text-right text-sm" />
                %
              </span>
            </label>
          ))}
          {familiasVenta.length === 0 && <p className="text-xs text-salvia-500">Cargando familias…</p>}
        </div>
      </div>

      {msg && (
        <p className={'mt-3 rounded-lg px-3 py-2 text-xs ' + (msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {msg.texto}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button onClick={guardar} disabled={guardando || !par}
          className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {guardando ? 'Guardando y recalculando…' : 'Guardar parámetros'}
        </button>
      </div>
    </section>
  );
}

function SeccionMermas() {
  const [q, setQ] = useState('');
  const [insumos, setInsumos] = useState<InsumoLite[]>([]);
  const [editados, setEditados] = useState<Record<string, number>>({});
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Mensaje>(null);

  // v10.11: la lista de mermas viene de la carga única (solo id, articulo y
  // merma_std — antes se descargaban los 266 insumos completos).
  const { mermas } = useConfig();
  useEffect(() => { setInsumos(mermas); }, [mermas]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return insumos.filter((i) => String(i.articulo || '').toLowerCase().includes(t)).slice(0, 12);
  }, [q, insumos]);

  async function guardarMerma(ins: InsumoLite) {
    const valor = editados[ins.id];
    if (valor === undefined) return;
    if (valor < 0 || valor >= 95) { setMsg({ tipo: 'error', texto: 'La merma debe estar entre 0 y 94.9%.' }); return; }
    setGuardandoId(ins.id);
    setMsg(null);
    try {
      const r = await fetchEnCola('/api/insumos/actualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ins.id, merma_std: valor }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      setInsumos((prev) => prev.map((x) => (x.id === ins.id ? { ...x, merma_std: valor } : x)));
      setEditados((prev) => { const n = { ...prev }; delete n[ins.id]; return n; });
      setMsg({ tipo: 'ok', texto: 'Merma estándar de ' + ins.articulo + ': ' + valor + '%. Se precargará al usarlo en recetas.' });
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error inesperado' });
    } finally {
      setGuardandoId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <CabeceraSeccion icono="🔪" tono="bg-red-100 text-red-700"
        titulo="Mermas estándar por insumo"
        descripcion="El % de merma típico de limpieza o porcionado. Al agregar el insumo en el editor de recetas, la merma llega precargada (siempre ajustable en la línea). No recalcula recetas existentes." />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar insumo… (ej: cebolla, pescado, aguacate)"
        className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm" />
      {filtrados.length > 0 && (
        <div className="mt-2 divide-y divide-line rounded-lg border border-line">
          {filtrados.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{i.articulo}</p>
                <p className="text-[11px] text-salvia-500">{i.unidad ? i.unidad + ' · ' : ''}merma estándar actual: <b>{Number(i.merma_std) || 0}%</b></p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={94.9} step={0.5}
                  value={editados[i.id] ?? Number(i.merma_std) ?? 0}
                  onChange={(e) => setEditados((p) => ({ ...p, [i.id]: Number(e.target.value) }))}
                  className="w-20 rounded border border-line px-2 py-1 text-right text-sm" />
                <button onClick={() => guardarMerma(i)}
                  disabled={guardandoId === i.id || editados[i.id] === undefined}
                  className="rounded bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                  {guardandoId === i.id ? '…' : 'Guardar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && (
        <p className={'mt-3 rounded-lg px-3 py-2 text-xs ' + (msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {msg.texto}
        </p>
      )}
    </section>
  );
}

function SeccionRespaldo() {
  const [descargando, setDescargando] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);

  async function descargar() {
    setDescargando(true);
    setMsg(null);
    try {
      const r = await fetch('/api/config/respaldo');
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || 'No se pudo generar el respaldo');
      }
      const blob = await r.blob();
      const nombre = (r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'respaldo.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ tipo: 'ok', texto: 'Respaldo descargado: ' + nombre + '. Guárdalo fuera de Google (disco local, otra nube).' });
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error inesperado' });
    } finally {
      setDescargando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <CabeceraSeccion icono="💾" tono="bg-green-100 text-green-700"
        titulo="Respaldo de la base"
        descripcion="Copia Excel del Sheet completo. Recomendado una vez al mes, guardada fuera de Google." />
      {msg && (
        <p className={'mt-3 rounded-lg px-3 py-2 text-xs ' + (msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {msg.texto}
        </p>
      )}
      <div className="mt-3">
        <button onClick={descargar} disabled={descargando}
          className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {descargando ? 'Generando copia…' : '⬇ Descargar copia (Excel)'}
        </button>
      </div>
    </section>
  );
}

/* ══════════════ 4b. PONER COSTOS AL DÍA (v10.10.3) ══════════════ */
/**
 * El día a día NO necesita este botón: cambiar un precio POR LA APP ya
 * recalcula en cascada las subrecetas y recetas afectadas. Este barrido es
 * el remedio para el caso que la app no puede ver: alguien editó un Coste
 * DIRECTO en la celda del Sheet — eso no dispara nada y deja costeos viejos.
 * Ejecuta el mismo recalcularTodo del backend: primero las 68 calculadoras
 * (cabecera y líneas), luego todos los platos; escribe SOLO lo que cambió,
 * así que sobre una base al día cuesta segundos de puras lecturas.
 */
function SeccionRecalcular() {
  const [confirmando, setConfirmando] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);

  async function recalcular() {
    setConfirmando(false);
    setCorriendo(true);
    setMsg(null);
    try {
      const r = await fetch('/api/config/recalcular', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || 'No se pudo recalcular');
      setMsg({
        tipo: 'ok',
        texto: `Costos al día: ${j.subrecetas_barridas} subrecetas barridas y ${j.recetas_recalculadas} recetas recalculadas en ${j.segundos}s. Solo se reescribió lo que estaba desfasado.`,
      });
    } catch (e) {
      const texto = e instanceof Error ? e.message : 'Error inesperado';
      // Si Vercel cortó por tiempo, el backend TERMINA igual (Apps Script no
      // se detiene al desconectarse el cliente): avisar en vez de alarmar.
      setMsg(
        /tiempo|timeout|504|network|red/i.test(texto)
          ? { tipo: 'ok', texto: 'La respuesta tardó más que el límite de espera, pero el barrido SIGUE corriendo en Google y termina solo. Espera un minuto y recarga: los costos quedarán al día.' }
          : { tipo: 'error', texto }
      );
    } finally {
      setCorriendo(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <CabeceraSeccion icono="🧮" tono="bg-sky-100 text-sky-700"
        titulo="Poner costos al día"
        descripcion="Barrido completo del costeo: subrecetas primero, platos después. No lo necesitas en el día a día (cambiar un precio por la app ya recalcula solo); úsalo cuando alguien editó Costes directo en la hoja de Google, porque esos cambios no avisan y dejan costeos viejos." />
      {msg && (
        <p className={'mt-3 rounded-lg px-3 py-2 text-xs ' + (msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {msg.texto}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!confirmando ? (
          <button onClick={() => { setConfirmando(true); setMsg(null); }} disabled={corriendo}
            className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {corriendo ? 'Recalculando… puede tardar hasta un minuto' : '🧮 Recalcular todos los costos'}
          </button>
        ) : (
          <>
            <span className="text-xs text-slate-600">Recalcula las 68 subrecetas y todos los platos. ¿Seguro?</span>
            <button onClick={recalcular}
              className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white">
              Sí, poner al día
            </button>
            <button onClick={() => setConfirmando(false)}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-slate-600">
              Cancelar
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function SeccionCredenciales() {
  const [rotando, setRotando] = useState(false);
  const [tokenNuevo, setTokenNuevo] = useState<string | null>(null);
  const [secretNuevo, setSecretNuevo] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);

  async function rotarToken() {
    setRotando(true);
    setMsg(null);
    try {
      const r = await fetch('/api/config/token', { method: 'POST' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo rotar');
      setTokenNuevo(j.token);
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error inesperado' });
    } finally {
      setRotando(false);
    }
  }

  function generarSecret() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    setSecretNuevo(btoa(String.fromCharCode(...bytes)));
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <CabeceraSeccion icono="🔐" tono="bg-slate-200 text-slate-700"
        titulo="Rotación de credenciales"
        descripcion="Cambia periódicamente las llaves del sistema, o de inmediato si alguna quedó expuesta." />

      <div className="mt-4 rounded-lg border border-line p-3">
        <p className="text-xs font-semibold text-slate-700">A · Token de la API (Apps Script ↔ Vercel)</p>
        {!tokenNuevo ? (
          <>
            <p className="mt-1 text-[11px] text-amber-700">
              ⚠ Al rotar, la app queda <b>sin conexión al backend</b> hasta que actualices la variable en Vercel
              (≈2 minutos). Hazlo en un momento tranquilo.
            </p>
            <label className="mt-2 flex items-center gap-2 text-xs text-salvia-700">
              <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
              Entiendo el efecto y quiero rotar el token ahora
            </label>
            <button onClick={rotarToken} disabled={!confirmado || rotando}
              className="mt-2 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
              {rotando ? 'Rotando…' : 'Generar token nuevo'}
            </button>
          </>
        ) : (
          <div className="mt-2 space-y-2 text-xs">
            <p className="rounded bg-amber-50 px-2 py-1 text-amber-800">
              Este token se muestra <b>UNA sola vez</b>. Cópialo ya:
            </p>
            <code className="block break-all rounded bg-slate-100 p-2 font-mono text-[11px]">{tokenNuevo}</code>
            <ol className="list-decimal space-y-1 pl-4 text-salvia-700">
              <li>Cópialo completo.</li>
              <li>Vercel → Settings → Environment Variables → <b>GASTROCORE_API_TOKEN</b> → Edit → pegar → Save.</li>
              <li>Deployments → ⋯ del último deploy → <b>Redeploy</b>.</li>
              <li>Verifica que /insumos cargue. El token viejo ya no sirve.</li>
            </ol>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-line p-3">
        <p className="text-xs font-semibold text-slate-700">B · AUTH_SECRET (cookies de sesión)</p>
        <p className="mt-1 text-[11px] text-salvia-600">
          Se cambia solo en Vercel (el backend no participa). Al rotarlo, <b>todas las sesiones se cierran</b> y
          cada quien vuelve a iniciar sesión.
        </p>
        {!secretNuevo ? (
          <button onClick={generarSecret}
            className="mt-2 rounded-lg border border-line px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-neutral-50">
            Generar AUTH_SECRET nuevo
          </button>
        ) : (
          <div className="mt-2 space-y-2 text-xs">
            <code className="block break-all rounded bg-slate-100 p-2 font-mono text-[11px]">{secretNuevo}</code>
            <ol className="list-decimal space-y-1 pl-4 text-salvia-700">
              <li>Vercel → Settings → Environment Variables → <b>AUTH_SECRET</b> → Edit → pegar → Save.</li>
              <li>Redeploy. Todos vuelven a iniciar sesión.</li>
            </ol>
          </div>
        )}
      </div>
      {msg && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{msg.texto}</p>}
    </section>
  );
}

function SeccionCarpetaFotos() {
  const [carpeta, setCarpeta] = useState<Carpeta | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);

  useEffect(() => {
    fetch('/api/config/fotos', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.carpeta) {
          setCarpeta(j.carpeta);
          setNuevoNombre(j.carpeta.nombre);
        }
      })
      .catch(() => {});
  }, []);

  async function renombrar() {
    const nombre = nuevoNombre.trim();
    if (!nombre || !carpeta || nombre === carpeta.nombre) return;
    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetchEnCola('/api/config/fotos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo renombrar');
      setCarpeta(j.carpeta);
      setMsg({ tipo: 'ok', texto: 'Carpeta renombrada en Drive.' });
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error inesperado' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <CabeceraSeccion icono="📁" tono="bg-purple-100 text-purple-700"
        titulo="Carpeta de fotos"
        descripcion="Aquí se guardan las fotos de las fichas técnicas. Renombrarla no afecta las ya subidas." />
      {carpeta ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-salvia-700">
            Actual: <b>{carpeta.nombre}</b> ·{' '}
            <a href={carpeta.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">abrir en Drive</a>
          </p>
          <div className="flex gap-2">
            <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
            <button onClick={renombrar} disabled={guardando}
              className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {guardando ? '…' : 'Renombrar'}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-salvia-500">Cargando…</p>
      )}
      {msg && (
        <p className={'mt-3 rounded-lg px-3 py-2 text-xs ' + (msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {msg.texto}
        </p>
      )}
    </section>
  );
}

/* ═══ v9.13: 🎨 ESTILO DEL RECETARIO — un tema por proyecto/marca ═══ */
function SeccionEstiloRecetario() {
  const [temaSel, setTemaSel] = useState('rocoto');
  const [original, setOriginalTema] = useState('rocoto');
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // v10.11: el tema viene de la carga única de la pantalla.
  const { parametros, recargar } = useConfig();
  useEffect(() => {
    const t = String(parametros?.recetario_tema || 'rocoto');
    setTemaSel(t); setOriginalTema(t);
  }, [parametros]);

  async function guardarTema() {
    setGuardando(true); setMsg(null);
    try {
      const r = await fetchEnCola('/api/config/parametros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recetario_tema: temaSel }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error((j.error && j.error.message) || j.error || 'No se pudo guardar');
      setOriginalTema(temaSel);
      await recargar(); // v10.11
      setMsg({ tipo: 'ok', texto: '✓ Estilo aplicado. Abre el recetario y refresca para verlo.' });
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar.' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 font-display text-lg font-bold text-ink">🎨 Estilo del recetario</h2>
      <p className="mb-4 text-xs text-salvia-500">
        Cada proyecto puede tener su identidad: el estilo cambia el fondo, la banda superior y los
        colores de títulos del recetario público. Se guarda en la hoja Configuración.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMAS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTemaSel(t.id)}
            className={'rounded-xl border-2 p-3 text-left transition ' +
              (temaSel === t.id ? 'border-ambar-500 shadow-md' : 'border-salvia-100 hover:border-salvia-300')}
            style={{ background: t.fondo }}
          >
            <div className="mb-2 h-7 w-full rounded-md"
              style={{ background: `linear-gradient(135deg, ${t.acento}, ${t.acentoSuave})` }} />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold" style={{ color: t.acento }}>{t.nombre}</span>
              {temaSel === t.id && <span className="text-ambar-600">✓</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              {[t.acento, t.acentoSuave, t.titulo, t.borde].map((c, i) => (
                <span key={i} className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
              ))}
              <span className="ml-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: t.titulo }}>Categoría</span>
            </div>
          </button>
        ))}
      </div>
      {msg && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.texto}</p>
      )}
      <button onClick={guardarTema} disabled={guardando || temaSel === original}
        className="btn-primary mt-3 disabled:opacity-40">
        {guardando ? 'Guardando…' : temaSel === original ? 'Estilo aplicado' : 'Aplicar este estilo'}
      </button>
    </section>
  );
}

/* ═══ v10: ACERCA DEL SISTEMA — la versión, con dignidad ═══ */
function SeccionAcercaDe() {
  // v10.11: la versión del backend viene de la carga única de la pantalla.
  const { parametros } = useConfig();
  const backendVer = String(parametros?.backend_version || '');
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-salvia-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1E3A5F] font-display text-sm font-bold text-white">GC</span>
        <div>
          <p className="font-display text-sm font-bold text-ink">GastroCore <span className="text-salvia-500">·</span> Versión {APP_VERSION}</p>
          <p className="text-[11px] text-salvia-500">Sistema de costeo y recetario</p>
        </div>
      </div>
      <div className="text-right text-[11px] leading-relaxed text-salvia-500">
        <p>Motor de datos: {backendVer ? <b className="text-salvia-700">v{backendVer}</b> : '…'} {backendVer && backendVer !== APP_VERSION && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">≠ revisar despliegue</span>}</p>
        <p>Next.js + Apps Script sobre Google Sheets</p>
      </div>
    </section>
  );
}
