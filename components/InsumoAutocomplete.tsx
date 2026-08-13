'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type InsumoOpt = {
  id: string;
  referencia: string;
  articulo: string;
  unidad: string;
  coste: number;
  subfamilia?: string;
  tipo_item?: 'insumo' | 'subreceta';
};

/** Normaliza texto: minusculas, sin tildes, sin caracteres especiales. */
function norm(s: string): string {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function money(n: number): string {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

/**
 * InsumoAutocomplete — buscador inteligente tipo ERP (Odoo/Select2/React-Select).
 * Reemplaza el <select> tradicional. Filtra en tiempo real por nombre, referencia
 * y codigo, insensible a mayusculas/minusculas/tildes/caracteres especiales.
 * Navegacion por teclado (flechas, Enter, Escape, Tab). Panel flotante con
 * nombre + unidad base + costo actual. No consulta la base por cada tecla:
 * usa un indice normalizado precomputado en memoria.
 */
export default function InsumoAutocomplete({
  value,
  insumos,
  onSelect,
  existingIds = [],
  onCommit,
  placeholder = 'Buscar insumo...',
}: {
  value: string;
  insumos: InsumoOpt[];
  onSelect: (ins: InsumoOpt) => void;
  existingIds?: string[];
  onCommit?: () => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [dupWarn, setDupWarn] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // v9.7: el panel se posiciona FIJO desde el input — así nunca lo recorta
  // el overflow de la tabla de ingredientes (el bug del panel aplastado).
  useEffect(() => {
    if (!open) { setPos(null); return; }
    const calcular = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(420, Math.max(340, r.width + 140));
      const left = Math.min(r.left, window.innerWidth - width - 12);
      const abajo = window.innerHeight - r.bottom;
      setPos({ top: abajo > 300 ? r.bottom + 4 : Math.max(8, r.top - 304), left: Math.max(8, left), width });
    };
    calcular();
    window.addEventListener('resize', calcular);
    window.addEventListener('scroll', calcular, true);
    return () => { window.removeEventListener('resize', calcular); window.removeEventListener('scroll', calcular, true); };
  }, [open]);

  // Indice normalizado precomputado (solo cambia si cambia la lista de insumos).
  const index = useMemo(
    () =>
      insumos.map((i) => ({
        ins: i,
        hay: norm(i.articulo) + ' ' + norm(i.referencia) + ' ' + norm(i.id),
      })),
    [insumos]
  );

  const seleccionado = useMemo(
    () => insumos.find((i) => i.id === value) || null,
    [insumos, value]
  );

  // Filtrado en tiempo real. Cada termino (separado por espacios) debe estar
  // presente en algun lugar del texto normalizado (inicio, medio o fin).
  const resultados = useMemo(() => {
    const nq = norm(q);
    if (!nq) return index.slice(0, 50).map((x) => x.ins);
    const terms = nq.split(' ').filter(Boolean);
    const out: InsumoOpt[] = [];
    for (const x of index) {
      let ok = true;
      for (const t of terms) {
        if (x.hay.indexOf(t) === -1) {
          ok = false;
          break;
        }
      }
      if (ok) {
        out.push(x.ins);
        if (out.length >= 50) break;
      }
    }
    return out;
  }, [q, index]);

  useEffect(() => {
    setActive(0);
  }, [q, open]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setDupWarn('');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Mantener el item activo visible.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active, open, resultados.length]);

  function abrir() {
    setOpen(true);
    setDupWarn('');
    setQ('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function elegir(ins: InsumoOpt) {
    if (existingIds.includes(ins.id) && ins.id !== value) {
      setDupWarn('Este ingrediente ya hace parte de la receta.');
      return;
    }
    onSelect(ins);
    setOpen(false);
    setQ('');
    setDupWarn('');
    // Mover el foco al campo Cantidad.
    if (onCommit) setTimeout(() => onCommit(), 0);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (resultados[active]) elegir(resultados[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setDupWarn('');
    } else if (e.key === 'Tab') {
      if (resultados[active] && open) {
        e.preventDefault();
        elegir(resultados[active]);
      }
    }
  }

  return (
    <div ref={boxRef} className="relative w-full min-w-[200px]">
      {open ? (
        <input
          ref={inputRef}
          type="text"
          value={q}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          className="w-full rounded-md border border-ambar-400 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ambar-200"
        />
      ) : (
        <button
          type="button"
          onClick={abrir}
          className={
            'flex w-full items-center justify-between gap-2 rounded-md border border-salvia-200 px-2 py-1.5 text-left text-sm hover:border-ambar-400 focus:border-ambar-400 focus:outline-none ' +
            (seleccionado ? 'text-salvia-900' : 'text-salvia-400')
          }
        >
          <span className="truncate">
            {seleccionado ? seleccionado.articulo : 'Selecciona insumo...'}
          </span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="shrink-0 text-salvia-400">
            <path d="M7 8l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {dupWarn ? (
        <div className="absolute z-[9999] mt-1 w-full rounded-md border border-red-300 bg-red-50 px-2 py-1.5 text-xs text-red-700 shadow">
          {dupWarn}
        </div>
      ) : null}

      {open && !dupWarn && pos ? (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="overflow-hidden rounded-xl border border-salvia-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="border-b border-salvia-100 bg-[#F8FAFC] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-salvia-400">
            {resultados.length} insumo{resultados.length === 1 ? '' : 's'} · ↑↓ para navegar · Enter para elegir
          </div>
          <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {resultados.length === 0 ? (
              <div className="px-4 py-5 text-center text-sm text-salvia-400">Sin resultados para &quot;{q}&quot;<br /><span className="text-xs">Prueba con menos letras o la referencia.</span></div>
            ) : (
              resultados.map((ins, idx) => {
                const dup = existingIds.includes(ins.id) && ins.id !== value;
                return (
                  <div
                    key={ins.id}
                    data-active={idx === active}
                    onMouseEnter={() => setActive(idx)}
                    onMouseDown={(e) => { e.preventDefault(); elegir(ins); }}
                    className={
                      'flex cursor-pointer items-center justify-between gap-3 border-l-2 px-3 py-2 transition-colors ' +
                      (idx === active ? 'border-ambar-400 bg-ambar-50' : 'border-transparent hover:bg-salvia-50') +
                      (dup ? ' opacity-45' : '')
                    }
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{ins.articulo}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-salvia-500">
                        {ins.referencia && <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[10px] text-slate-500">{ins.referencia}</span>}
                        {ins.subfamilia && <span>{ins.subfamilia}</span>}
                        {dup && <span className="font-medium text-amber-600">· ya en la receta</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm font-semibold text-[#1E3A5F]">{money(ins.coste)}</div>
                      <div className="text-[10px] uppercase text-salvia-400">por {ins.unidad || 'unidad'}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
