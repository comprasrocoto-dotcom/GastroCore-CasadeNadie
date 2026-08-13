'use client';

/**
 * Recetario público — réplica visual del Recetario Malanga original:
 *  - Tarjetas con foto (recorte) o placeholder rosado con hojita 🌿 y categoría.
 *  - Pie de tarjeta: "N ingredientes" / "N pasos".
 *  - Toggle cuadrícula / lista (esquina superior derecha).
 *  - Al hacer clic se abre un MODAL con cabecera verde: ingredientes
 *    (Artículo / Unidad de Medida / Cantidad), PREPARACIÓN y EMPLATADO con
 *    pasos numerados en círculos verdes. SIN costos ni precios.
 */
import { useEffect, useMemo, useState } from 'react';
import type { RecetaPublica } from '@/lib/recetario';
import { fotoConAncho } from '@/lib/recetario';

/* ══ TOKENS DE MARCA ROCOTO ══════════════════════════════════════════════
   Paleta tomada de rocotorestaurante.com: verde botella del header (logo
   blanco sobre verde), crema natural de fondo, y rojo rocoto como acento.
   Si algún hex difiere del manual de marca oficial, se ajusta SOLO aquí. */
import { TEMA_BASE, type TemaRecetario } from '@/lib/temasRecetario';

// v9.13: el tema activo del recetario (se fija con aplicarTema desde las props).
const T = { ...TEMA_BASE };
function aplicarTema(t?: TemaRecetario) { if (t) Object.assign(T, t); }
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"; // display del sitio

/** Divide un texto multilínea en pasos no vacíos. */
function pasos(texto: string): string[] {
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function RecetarioGaleria({ recetas, nombreNegocio = 'Rocoto', tema }: { recetas: RecetaPublica[]; nombreNegocio?: string; tema?: TemaRecetario }) {
  aplicarTema(tema);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string>('TODAS');
  const [centro, setCentro] = useState<string>('TODOS'); // v9.5: filtro por centro de costo
  const [modo, setModo] = useState<'grid' | 'list'>('grid');
  const [abierta, setAbierta] = useState<RecetaPublica | null>(null);

  const categorias = useMemo(() => {
    const m = new Map<string, number>();
    recetas.forEach((r) => m.set(r.categoria, (m.get(r.categoria) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [recetas]);

  // v9.8.4: sidebar por CC — categorías sin centro primero, las demás bajo su 🏷.
  const seccionesSidebar = useMemo(() => {
    const ccDeCat = new Map<string, string>();
    recetas.forEach((r) => {
      const c = String(r.centro_costo || '').trim();
      if (c && !ccDeCat.has(r.categoria)) ccDeCat.set(r.categoria, c);
    });
    const sin: [string, number][] = [];
    const por = new Map<string, [string, number][]>();
    categorias.forEach(([cat, n]) => {
      const cc = ccDeCat.get(cat) || '';
      if (!cc) { sin.push([cat, n]); return; }
      if (!por.has(cc)) por.set(cc, []);
      por.get(cc)!.push([cat, n]);
    });
    return { sin, grupos: Array.from(por.entries()).sort((a, b) => a[0].localeCompare(b[0])) };
  }, [recetas, categorias]);

  // v9.5: centros de costo presentes (si nadie los digitó, la vista no cambia)
  const centros = useMemo(() => {
    const m = new Map<string, number>();
    recetas.forEach((r) => { const c = String(r.centro_costo || '').trim(); if (c) m.set(c, (m.get(c) || 0) + 1); });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [recetas]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return recetas.filter((r) => {
      if (categoria !== 'TODAS' && r.categoria !== categoria) return false;
      if (centro !== 'TODOS' && String(r.centro_costo || '') !== centro) return false;
      if (!q) return true;
      return (
        r.nombre.toLowerCase().includes(q) ||
        r.ingredientes.some((i) => i.nombre.toLowerCase().includes(q))
      );
    });
  }, [recetas, busqueda, categoria, centro]);

  // v9.5: el grid se SECCIONA por centro de costo; lo que no tiene CC va
  // plano y de primero, tal como se veía antes (cero secciones vacías).
  const seccionesCC = useMemo(() => {
    const sin: RecetaPublica[] = [];
    const por = new Map<string, RecetaPublica[]>();
    visibles.forEach((r) => {
      const c = String(r.centro_costo || '').trim();
      if (!c) { sin.push(r); return; }
      if (!por.has(c)) por.set(c, []);
      por.get(c)!.push(r);
    });
    return { sin, grupos: Array.from(por.entries()).sort((a, b) => a[0].localeCompare(b[0])) };
  }, [visibles]);

  // Cerrar el modal con Escape.
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && setAbierta(null);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // Bloquear el scroll del fondo mientras el modal está abierto.
  useEffect(() => {
    document.body.style.overflow = abierta ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [abierta]);

  const titulo =
    categoria === 'TODAS' ? 'Recetario' : categoria.charAt(0) + categoria.slice(1).toLowerCase();

  return (
    <main className="min-h-screen" style={{ background: T.fondo, color: '#26291F' }}>
      {/* Barra de marca: verde botella con el nombre en blanco, eco del header del sitio */}
      <div className="w-full px-4 py-3 text-center" style={{ background: `linear-gradient(135deg, ${T.acento}, ${T.acentoSuave})` }}>
        <p className="text-lg font-bold tracking-wide text-white" style={{ fontFamily: SERIF }}>
          {nombreNegocio} <span className="mx-1.5 font-normal text-white/50">·</span>
          <span className="font-normal italic text-white/90">Recetario de Cocina</span>
        </p>
      </div>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        {/* Sidebar de categorías */}
        <nav className="hidden w-52 min-w-52 md:block">
          <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: T.titulo }}>
            Secciones
          </p>
          <CategoriaBtn activa={categoria === 'TODAS'} onClick={() => setCategoria('TODAS')} nombre="Todas" n={recetas.length} />
          {seccionesSidebar.sin.map(([cat, n]) => (
            <CategoriaBtn key={cat} activa={categoria === cat} onClick={() => setCategoria(cat)} nombre={cat} n={n} />
          ))}
          {seccionesSidebar.grupos.map(([cc, cats]) => (
            <div key={cc} className="mt-3">
              <button onClick={() => setCentro(centro === cc ? 'TODOS' : cc)}
                title="Filtrar por este centro de costo"
                className={'mb-0.5 flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[10px] font-bold uppercase tracking-widest transition ' + (centro === cc ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:bg-neutral-100')}
                style={centro === cc ? {} : { color: T.titulo }}>
                <span>🏷 {cc}</span>
                <span className="font-normal text-neutral-400">{cats.reduce((a, [, n]) => a + n, 0)}</span>
              </button>
              <div className="pl-2">
                {cats.map(([cat, n]) => (
                  <CategoriaBtn key={cat} activa={categoria === cat} onClick={() => setCategoria(cat)} nombre={cat} n={n} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Contenido */}
        <section className="min-w-0 flex-1">
          {/* Cabecera: título + contador + toggle */}
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: SERIF, color: T.acento }}>
                {titulo}
              </h1>
              <p className="mt-0.5 text-sm text-neutral-500">{visibles.length} recetas</p>
            </div>
            <div className="flex gap-1.5 pt-1">
              <ToggleBtn activo={modo === 'grid'} onClick={() => setModo('grid')} title="Cuadrícula">▦</ToggleBtn>
              <ToggleBtn activo={modo === 'list'} onClick={() => setModo('list')} title="Lista">☰</ToggleBtn>
            </div>
          </div>

          {/* v9.5: filtro por centro de costo (solo si hay alguno digitado) */}
          {centros.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">🏷 Centro de costo:</span>
              <ChipCat activa={centro === 'TODOS'} onClick={() => setCentro('TODOS')} nombre="Todos" />
              {centros.map(([c, n]) => (
                <ChipCat key={c} activa={centro === c} onClick={() => setCentro(c)} nombre={c + ' (' + n + ')'} />
              ))}
            </div>
          )}

          {/* Selector de categoría en móvil */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
            <ChipCat activa={categoria === 'TODAS'} onClick={() => setCategoria('TODAS')} nombre="Todas" />
            {categorias.map(([cat]) => (
              <ChipCat key={cat} activa={categoria === cat} onClick={() => setCategoria(cat)} nombre={cat} />
            ))}
          </div>

          {/* Buscador */}
          <div className="mb-5 flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 shadow-sm" style={{ borderColor: T.borde }}>
            <span>🔍</span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar receta o ingrediente..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
          </div>

          {/* Tarjetas */}
          {visibles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm text-neutral-400">
              No hay recetas que coincidan con la búsqueda.
            </div>
          ) : (
            <div className="space-y-6">
              {seccionesCC.sin.length > 0 && (
                <div className={modo === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5' : 'flex flex-col gap-3'}>
                  {seccionesCC.sin.map((r) => (
                    <Tarjeta key={r.id} r={r} modo={modo} onOpen={() => setAbierta(r)} />
                  ))}
                </div>
              )}
              {seccionesCC.grupos.map(([cc, items]) => (
                <div key={cc}>
                  <h2 className="mb-2 flex items-center gap-2 border-b pb-1 text-sm font-bold uppercase tracking-wide" style={{ color: T.acento, borderColor: T.borde }}>
                    🏷 {cc} <span className="rounded-full bg-neutral-100 px-2 text-xs font-medium text-neutral-500">{items.length}</span>
                  </h2>
                  <div className={modo === 'grid' ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5' : 'flex flex-col gap-3'}>
                    {items.map((r) => (
                      <Tarjeta key={r.id} r={r} modo={modo} onOpen={() => setAbierta(r)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {abierta && <ModalReceta r={abierta} onClose={() => setAbierta(null)} />}
    </main>
  );
}

/* ============================ TARJETA ==================================== */
function Tarjeta({ r, modo, onOpen }: { r: RecetaPublica; modo: 'grid' | 'list'; onOpen: () => void }) {
  const nIng = r.ingredientes.length;
  const nPasos = pasos(r.ficha.preparacion).length + pasos(r.ficha.emplatado).length;
  const horizontal = modo === 'list';

  return (
    <button
      onClick={onOpen}
      className={
        'group overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ' +
        (horizontal ? 'flex items-stretch' : '')
      }
    >
      {/* Miniatura: recorte a propósito (object-cover) para uniformar la galería */}
      <div
        className={
          'flex items-center justify-center overflow-hidden ' +
          (horizontal ? 'h-24 w-28 min-w-28' : 'h-40 w-full')
        }
        style={{ background: T.borde }}
      >
        {r.ficha.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoConAncho(r.ficha.foto_url, 600)}
            alt={r.nombre}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-neutral-500">
            <span className="text-3xl">🌿</span>
            {!horizontal && (
              <span className="text-[10px] font-medium uppercase tracking-wide">{r.categoria}</span>
            )}
          </div>
        )}
      </div>

      <div className={'flex min-w-0 flex-1 flex-col ' + (horizontal ? 'px-4 py-2.5' : 'p-3.5')}>
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.titulo }}>
          {r.categoria}
        </p>
        <h2 className="mt-0.5 line-clamp-2 text-sm font-semibold uppercase leading-snug">{r.nombre}</h2>
        <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-2 text-[11px] text-neutral-500">
          <span>{nIng} ingredientes</span>
          {nPasos > 0 && <span className="font-semibold">{nPasos} pasos</span>}
        </div>
      </div>
    </button>
  );
}

/* ============================ MODAL ====================================== */
export function DetalleReceta({ r, onClose, tema }: { r: RecetaPublica; onClose?: () => void; tema?: TemaRecetario }) {
  aplicarTema(tema);
  const [lupa, setLupa] = useState(false);   // v9.6: visor de foto en grande
  const [ampliada, setAmpliada] = useState(false);
  const prep = pasos(r.ficha.preparacion);
  const empl = pasos(r.ficha.emplatado);

  return (
    <div
      className="flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      // En modal (onClose presente) la altura se limita contra el VIEWPORT
      // (88vh) — max-h-full en cadena no aplica cuando el padre no tiene
      // altura fija, que era el bug que dejaba el panel sin scroll.
      style={onClose ? { maxHeight: '88vh' } : undefined}
    >
      {/* Cabecera verde */}
      <div className="flex shrink-0 items-start justify-between gap-4 px-6 py-4" style={{ background: T.acento }}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">{r.categoria}</p>
          <h2 className="mt-0.5 text-2xl font-bold leading-tight text-white" style={{ fontFamily: SERIF }}>
            {r.nombre}
          </h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            ✕
          </button>
        )}
      </div>

      {/* Cuerpo */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto bg-white px-6 py-5">
        {/* FOTO: se ve COMPLETA en su proporción natural, adaptándose a
            cualquier resolución (tope ~60% de pantalla / 560px). */}
        {r.ficha.foto_url && (
          <div className="group relative flex w-full items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fotoConAncho(r.ficha.foto_url, 1200)}
              alt={r.nombre}
              onClick={() => setLupa(true)}
              title="Ver en grande"
              className="block h-auto w-auto cursor-zoom-in rounded-lg"
              style={{ maxWidth: '100%', maxHeight: 'min(60vh, 560px)' }}
            />
            <button onClick={() => setLupa(true)}
              className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1.5 text-sm text-white opacity-80 transition group-hover:opacity-100"
              title="Ver en grande">🔍</button>
            {lupa && (
              <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-3"
                onClick={() => { setLupa(false); setAmpliada(false); }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoConAncho(r.ficha.foto_url, 1600)}
                  alt={r.nombre}
                  onClick={(e) => { e.stopPropagation(); setAmpliada((v) => !v); }}
                  className={'rounded-lg transition-transform duration-200 ' + (ampliada ? 'cursor-zoom-out' : 'cursor-zoom-in')}
                  style={{ maxWidth: '95vw', maxHeight: '92vh', transform: ampliada ? 'scale(1.8)' : 'scale(1)' }}
                />
                <button onClick={() => { setLupa(false); setAmpliada(false); }}
                  className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1.5 text-lg text-white hover:bg-white/30">✕</button>
                <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-white">
                  Toca la imagen para {ampliada ? 'reducir' : 'ampliar'} · toca afuera para cerrar
                </p>
              </div>
            )}
          </div>
        )}

        {/* v10.2 (restaurada): rendimiento de la SUB. — solo el valor, sin costos */}
        {r.es_subreceta && Number(r.rendimiento) > 0 && (
          <div className="mb-5 rounded-xl border-2 p-4 text-center" style={{ borderColor: T.acento, background: T.fondo }}>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: T.acentoSuave }}>Rendimiento producido</p>
            <p className="mt-1 text-3xl font-extrabold" style={{ color: T.acento, fontFamily: SERIF }}>
              {Number(r.rendimiento).toLocaleString('es-CO')} <span className="text-lg font-semibold">{r.unidad_rendimiento || ''}</span>
            </p>
            <p className="mt-1 text-[11.5px]" style={{ color: T.acentoSuave }}>
              Esta preparación rinde {Number(r.rendimiento).toLocaleString('es-CO')} {r.unidad_rendimiento || 'unidades'} por tanda.
            </p>
          </div>
        )}
        {/* Ingredientes: Artículo / Unidad de Medida / Cantidad (sin costos) */}
        <section>
          <TituloSeccion>Ingredientes</TituloSeccion>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="py-2 pr-2 font-semibold">Artículo</th>
                <th className="py-2 pr-2 font-semibold">Unidad de Medida</th>
                <th className="py-2 text-right font-semibold">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {r.ingredientes.map((ing, i) => (
                <tr key={i} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pr-2 font-medium uppercase">{ing.nombre}</td>
                  <td className="py-2 pr-2 text-neutral-500">{abreviarUnidad(ing.unidad)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums" style={{ color: T.acentoSuave }}>
                    {ing.cantidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {prep.length > 0 && <Pasos titulo="Preparación" items={prep} />}
        {empl.length > 0 && <Pasos titulo="Emplatado" items={empl} />}

        {/* Datos operativos: solo aparecen cuando tienen información registrada */}
        {(r.ficha.tiempo_min || r.ficha.gramaje_porcion) && (
          <section className="flex flex-wrap gap-3">
            {r.ficha.tiempo_min ? (
              <DatoOperativo etiqueta="Tiempo de preparación" valor={`${r.ficha.tiempo_min} min`} />
            ) : null}
            {r.ficha.gramaje_porcion ? (
              <DatoOperativo etiqueta="Gramaje por porción" valor={String(r.ficha.gramaje_porcion)} />
            ) : null}
          </section>
        )}

        {r.ficha.notas && (
          <section>
            <TituloSeccion>Notas</TituloSeccion>
            <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-600">{r.ficha.notas}</p>
          </section>
        )}
      </div>
    </div>
  );
}

function ModalReceta({ r, onClose }: { r: RecetaPublica; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <DetalleReceta r={r} onClose={onClose} />
      </div>
    </div>
  );
}

/* ============================ PIEZAS ===================================== */
function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: T.titulo }}>
      {children}
    </h3>
  );
}

function Pasos({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <section>
      <TituloSeccion>{titulo}</TituloSeccion>
      <ol className="space-y-2.5">
        {items.map((paso, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: T.acento }}
            >
              {i + 1}
            </span>
            <span style={{ color: '#3B4034' }}>{paso}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DatoOperativo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: T.acento }}>
        {etiqueta}
      </p>
      <p className="mt-0.5 text-sm font-semibold">{valor}</p>
    </div>
  );
}

function abreviarUnidad(u: string): string {
  const s = String(u || '').toUpperCase();
  if (s === 'GRAMOS') return 'g';
  if (s === 'UNIDADES') return 'uds';
  if (s === 'ONZA') return 'oz';
  if (s === 'COPA') return 'copa';
  return u || '';
}

function CategoriaBtn({ activa, onClick, nombre, n }: { activa: boolean; onClick: () => void; nombre: string; n: number }) {
  return (
    <button
      onClick={onClick}
      className={
        'mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition ' +
        (activa ? 'text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50 border border-neutral-200')
      }
      style={activa ? { background: T.acento } : undefined}
    >
      <span className="truncate uppercase">{nombre}</span>
      <span className={activa ? 'text-white/70' : 'text-neutral-400'}>{n}</span>
    </button>
  );
}

function ChipCat({ activa, onClick, nombre }: { activa: boolean; onClick: () => void; nombre: string }) {
  return (
    <button
      onClick={onClick}
      className={
        'shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase transition ' +
        (activa ? 'text-white' : 'bg-white text-neutral-600 border border-neutral-200')
      }
      style={activa ? { background: T.acento } : undefined}
    >
      {nombre}
    </button>
  );
}

function ToggleBtn({ activo, onClick, title, children }: { activo: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        'flex h-9 w-9 items-center justify-center rounded-lg border text-base transition ' +
        (activo ? 'border-transparent text-white' : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50')
      }
      style={activo ? { background: T.acento } : undefined}
    >
      {children}
    </button>
  );
}
