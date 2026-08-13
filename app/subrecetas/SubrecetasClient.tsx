'use client';
import { fetchEnCola } from '@/lib/colaGuardado';
import { useRol } from '@/lib/useRol';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Sub = {
  id: string;
  nombre: string;
  subfamilia_id?: string;
  rendimiento?: number;
  unidad_rendimiento_id?: string;
  costo_total?: number;
  costo_unitario?: number;
  activo?: boolean | string;
  actualizado_en?: string;
};

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const num = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n || 0);
const esActivo = (v: unknown) => v === true || v === 'TRUE' || v === 'true';

export default function SubrecetasClient({ initial }: { initial: Sub[] | null }) {
  const { puedeEditarRecetas } = useRol();
  const router = useRouter();
  const [subs, setSubs] = useState<Sub[]>(initial ?? []);
  const [loading, setLoading] = useState(!initial); // con datos del servidor no hay spinner
  const [q, setQ] = useState('');
  const [verInactivas, setVerInactivas] = useState(false);

  useEffect(() => {
    if (initial) return; // el servidor ya trajo los datos; no repetir al montar
    setLoading(true);
    fetch('/api/subrecetas?all=true', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSubs(Array.isArray(d.data) ? d.data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtradas = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return subs.filter((s) => {
      if (!verInactivas && !esActivo(s.activo)) return false;
      if (nq && !(s.nombre || '').toLowerCase().includes(nq)) return false;
      return true;
    });
  }, [subs, q, verInactivas]);


  const totalActivas = subs.filter((s) => esActivo(s.activo)).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ambar-700">Subrecetas · Preparaciones base</h1>
          <p className="text-xs text-salvia-500">Preparaciones que se costean como una receta y se usan como insumo en otras recetas.</p>
        </div>
        {puedeEditarRecetas && <Link href="/subrecetas/nueva" className="rounded-lg bg-ambar-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ambar-700">+ Nueva subreceta</Link>}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-salvia-500">Total subrecetas</p>
          <p className="mt-1 text-2xl font-bold text-ink">{totalActivas}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-salvia-500">Costo prom. por unidad</p>
          <p className="mt-1 text-2xl font-bold text-ink">{money(filtradas.length ? filtradas.reduce((a, s) => a + (Number(s.costo_unitario) || 0), 0) / filtradas.length : 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-salvia-500">Mostrando</p>
          <p className="mt-1 text-2xl font-bold text-ink">{filtradas.length}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar subreceta…"
          className="w-64 rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-[#2563EB] focus:outline-none" />
        <label className="flex items-center gap-2 text-sm text-salvia-600">
          <input type="checkbox" checked={verInactivas} onChange={(e) => setVerInactivas(e.target.checked)} />
          Ver inactivas
        </label>
      </div>

      {loading ? (
        <p className="py-10 text-center text-salvia-500">Cargando…</p>
      ) : filtradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-12 text-center text-salvia-500">
          No hay subrecetas todavía. Crea la primera con “+ Nueva subreceta”.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-left text-[11px] uppercase tracking-wide text-salvia-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Referencia</th>
                <th className="px-4 py-2 text-right">Rendimiento</th>
                <th className="px-4 py-2 text-right">Costo total</th>
                <th className="px-4 py-2 text-center">Estado</th>
                <th className="px-4 py-2 text-right">💲 Insumos vs Subreceta</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s) => {
                const cIns = Number((s as any).insumo_coste) || 0;
                const cSub = Number(s.costo_unitario) || 0;
                const igual = Math.abs(cIns - cSub) <= 0.01;
                return (
                <tr key={s.id}
                  onClick={() => router.push(`/subrecetas/nueva?edit=${s.id}`)}
                  title="Entrar a la subreceta"
                  className="cursor-pointer border-t border-line transition hover:bg-blue-50/40">
                  <td className="px-4 py-2 font-medium text-ink">🥣 <span className="text-[#2563EB]">{s.nombre}</span><span className="ml-2 text-[11px] text-salvia-400">{s.id}</span></td>
                  <td className="px-4 py-2"><span className="font-mono text-[11px] text-salvia-600">{(s as any).insumo_referencia || '—'}</span></td>
                  <td className="px-4 py-2 text-right">{num(Number(s.rendimiento) || 0)} {s.unidad_rendimiento_id || ''}</td>
                  <td className="px-4 py-2 text-right">{money(Number(s.costo_total) || 0)}</td>
                  <td className="px-4 py-2 text-center">
                    {esActivo(s.activo)
                      ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Activa</span>
                      : <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">Inactiva</span>}
                  </td>
                  {/* v9.11: los DOS costos, lado a lado — verde si coinciden, ámbar si no */}
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex flex-col items-end gap-0.5">
                      <span className="font-mono text-xs text-salvia-600">Insumos: <b className="text-[#1E3A5F]">{money(cIns)}</b></span>
                      <span className={'font-mono text-xs ' + (igual ? 'text-emerald-600' : 'text-amber-700')}>
                        Subreceta: <b>{money(cSub)}</b> {igual ? '✓' : '≠'}
                      </span>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
