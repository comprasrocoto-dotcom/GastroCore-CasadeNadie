'use client';
import { fetchEnCola } from '@/lib/colaGuardado';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Hist = {
  id: string; receta_id: string; accion: string; usuario: string; fecha: string;
  nombre: string; costo_total: number; costo_porcion: number; food_cost: number; precio_real: number;
  cambios: string; version?: number; origen?: string; campo?: string;
  valor_anterior?: string | number; valor_nuevo?: string | number; observaciones?: string; snapshot?: string;
};

function fdate(s: string) {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}
function money(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0);
}

export default function TrazabilidadPage() {
  const params = useParams();
  const id = String((params && params.id) || '');
  const [receta, setReceta] = useState<{ nombre?: string } | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);
  const [cargando, setCargando] = useState(true);
  const [qUsuario, setQUsuario] = useState('');
  const [fAccion, setFAccion] = useState('');
  const [fDesde, setFDesde] = useState('');
  const [fHasta, setFHasta] = useState('');
  const [restaurando, setRestaurando] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const r = await fetch('/api/recetas?id=' + encodeURIComponent(id) + '&_=' + Date.now(), { cache: 'no-store' });
      const j = await r.json();
      if (j.ok && j.data) {
        setReceta(j.data);
        const h: Hist[] = (j.data.historial || []).slice().sort((a: Hist, b: Hist) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        setHist(h);
      }
    } finally { setCargando(false); }
  }
  useEffect(() => { if (id) cargar(); }, [id]);

  const acciones = useMemo(() => Array.from(new Set(hist.map((h) => h.accion).filter(Boolean))), [hist]);

  const filtrado = useMemo(() => {
    return hist.filter((h) => {
      if (qUsuario && !String(h.usuario || '').toLowerCase().includes(qUsuario.toLowerCase())) return false;
      if (fAccion && h.accion !== fAccion) return false;
      const t = new Date(h.fecha).getTime();
      if (fDesde && t < new Date(fDesde).getTime()) return false;
      if (fHasta && t > new Date(fHasta).getTime() + 86400000) return false;
      return true;
    });
  }, [hist, qUsuario, fAccion, fDesde, fHasta]);

  const versiones = useMemo(() => hist.filter((h) => h.snapshot && h.version).sort((a, b) => (Number(b.version) || 0) - (Number(a.version) || 0)), [hist]);

  function exportCSV() {
    const cols = ['Fecha y hora', 'Usuario', 'Accion', 'Campo modificado', 'Valor anterior', 'Valor nuevo', 'Origen', 'Version', 'Observaciones'];
    const rows = filtrado.map((h) => [fdate(h.fecha), h.usuario || '', h.accion || '', h.campo || '', h.valor_anterior ?? '', h.valor_nuevo ?? '', h.origen || '', h.version ?? '', h.observaciones || '']);
    const esc = (v: unknown) => '"' + String(v).replace(/"/g, '""') + '"';
    const csv = [cols.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'trazabilidad_' + id + '.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() { window.print(); }

  async function restaurar(version?: number) {
    if (!version) return;
    if (!confirm('Restaurar la receta a la version ' + version + '? Se creara una nueva entrada de historial (no se pierde nada).')) return;
    setRestaurando(version); setMsg(null);
    try {
      const r = await fetchEnCola('/api/recetas/restaurar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, version, usuario: 'Web' }) });
      const j = await r.json();
      if (j.ok) { setMsg('Version ' + version + ' restaurada correctamente.'); await cargar(); }
      else setMsg((j.error && (j.error.message || j.error)) || 'No se pudo restaurar.');
    } catch { setMsg('Error al restaurar.'); }
    finally { setRestaurando(null); }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 print:max-w-none">
      <div className="mb-5 flex items-center justify-between print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold text-ambar-700">Trazabilidad completa</h1>
          <p className="text-xs text-salvia-500">Auditoria permanente de cambios &mdash; {receta?.nombre || id}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary !px-3 !py-1.5 !text-xs">Exportar Excel (CSV)</button>
          <button onClick={exportPDF} className="btn-secondary !px-3 !py-1.5 !text-xs">Exportar PDF</button>
          <Link href={'/recetas/' + id} className="rounded-md bg-ambar-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-ambar-700">Volver a la receta</Link>
        </div>
      </div>

      {msg && <div className="mb-3 rounded-md border border-ambar-200 bg-ambar-50 px-3 py-2 text-sm text-ambar-700 print:hidden">{msg}</div>}

      <div className="mb-4 grid gap-3 card p-4 sm:grid-cols-4 print:hidden">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Buscar usuario</span>
          <input value={qUsuario} onChange={(e) => setQUsuario(e.target.value)} placeholder="Usuario..."
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Tipo de cambio</span>
          <select value={fAccion} onChange={(e) => setFAccion(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]">
            <option value="">Todos</option>
            {acciones.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Desde</span>
          <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Hasta</span>
          <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]" />
        </label>
      </div>

      <div className="mb-6 overflow-x-auto card">
        <table className="erp-table text-xs">
          <thead>
            <tr>
              <th className="px-3 py-2">Fecha y hora</th>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Accion</th>
              <th className="px-3 py-2">Campo modificado</th>
              <th className="px-3 py-2">Valor anterior</th>
              <th className="px-3 py-2">Valor nuevo</th>
              <th className="px-3 py-2">Origen</th>
              <th className="px-3 py-2">Ver.</th>
              <th className="px-3 py-2">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={9} className="px-3 py-6 text-center text-salvia-400">Cargando trazabilidad...</td></tr>}
            {!cargando && filtrado.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-salvia-400">Sin registros para los filtros seleccionados.</td></tr>}
            {filtrado.map((h) => (
              <tr key={h.id} className="border-t border-salvia-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 font-mono text-salvia-700">{fdate(h.fecha)}</td>
                <td className="px-3 py-2">{h.usuario || 'Sistema'}</td>
                <td className="px-3 py-2 capitalize">{h.accion}</td>
                <td className="px-3 py-2">{h.campo || (h.snapshot ? 'Snapshot de version ' + h.version : '-')}</td>
                <td className="px-3 py-2 font-mono">{h.valor_anterior === undefined || h.valor_anterior === '' ? '-' : String(h.valor_anterior)}</td>
                <td className="px-3 py-2 font-mono">{h.valor_nuevo === undefined || h.valor_nuevo === '' ? '-' : String(h.valor_nuevo)}</td>
                <td className="px-3 py-2">{h.origen || '-'}</td>
                <td className="px-3 py-2 text-center">{h.version ?? '-'}</td>
                <td className="px-3 py-2 text-salvia-500">{h.observaciones || (h.cambios && h.snapshot ? h.cambios : '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-salvia-500">Versiones de la receta</h2>
        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Accion</th>
                <th className="px-3 py-2 text-right">Costo porcion</th>
                <th className="px-3 py-2 text-right">Precio venta</th>
                <th className="px-3 py-2 text-right">Food cost</th>
                <th className="px-3 py-2 text-right print:hidden">Accion</th>
              </tr>
            </thead>
            <tbody>
              {versiones.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-salvia-400">Aun no hay versiones con snapshot.</td></tr>}
              {versiones.map((v, i) => (
                <tr key={v.id} className="border-t border-salvia-100">
                  <td className="px-3 py-2 font-semibold text-ambar-700">v{v.version}{i === 0 ? ' (actual)' : ''}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-salvia-700">{fdate(v.fecha)}</td>
                  <td className="px-3 py-2">{v.usuario || 'Sistema'}</td>
                  <td className="px-3 py-2 capitalize">{v.accion}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(v.costo_porcion)}</td>
                  <td className="px-3 py-2 text-right font-mono">{money(v.precio_real)}</td>
                  <td className="px-3 py-2 text-right font-mono">{((Number(v.food_cost) || 0) * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right print:hidden">
                    {i === 0 ? <span className="text-xs text-salvia-400">&mdash;</span> : (
                      <button onClick={() => restaurar(v.version)} disabled={restaurando !== null}
                        className="rounded-md border border-ambar-300 px-2 py-1 text-xs font-medium text-ambar-700 hover:bg-ambar-50 disabled:opacity-50">
                        {restaurando === v.version ? 'Restaurando...' : 'Restaurar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-salvia-400">El historial es permanente y nunca se sobrescribe. Restaurar una version crea una nueva entrada de auditoria.</p>
      </div>
    </main>
  );
}
