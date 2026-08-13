'use client';

/**
 * FICHA TÉCNICA DE SUBRECETA — v9.12
 * Igual que la ficha de un plato (descripción, preparación, emplatado, notas,
 * tiempo y gramaje) pero SIN foto, por diseño: las preparaciones van al
 * recetario en su sección "SUB. PREPARACIONES" solo con su contenido.
 * Guarda en la misma hoja FichaTecnica (receta_id = SUBR-xxx).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchEnCola } from '@/lib/colaGuardado';
import { useRol } from '@/lib/useRol';

type Campos = {
  descripcion: string;
  preparacion: string;
  emplatado: string;
  notas: string;
  tiempo_min: string;
  gramaje_porcion: string;
};

const VACIA: Campos = { descripcion: '', preparacion: '', emplatado: '', notas: '', tiempo_min: '', gramaje_porcion: '' };

export default function FichaSubrecetaPage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id || '');
  const { puedeEditarRecetas } = useRol();

  const [nombre, setNombre] = useState('');
  const [campos, setCampos] = useState<Campos>(VACIA);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [rf, rs] = await Promise.all([
        fetch(`/api/fichas?receta_id=${encodeURIComponent(id)}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/subrecetas?id=${encodeURIComponent(id)}`, { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (rs?.ok && rs.data) setNombre(String(rs.data.nombre || ''));
      if (rf?.ok && rf.ficha) {
        setCampos({
          descripcion: String(rf.ficha.descripcion ?? ''),
          preparacion: String(rf.ficha.preparacion ?? ''),
          emplatado: String(rf.ficha.emplatado ?? ''),
          notas: String(rf.ficha.notas ?? ''),
          tiempo_min: String(rf.ficha.tiempo_min ?? ''),
          gramaje_porcion: String(rf.ficha.gramaje_porcion ?? ''),
        });
      }
    } catch {
      setMsg({ tipo: 'error', texto: 'No se pudo cargar la ficha.' });
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardar() {
    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetchEnCola('/api/fichas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receta_id: id, ...campos }),
      }).then((x) => x.json());
      if (r.ok) setMsg({ tipo: 'ok', texto: '✓ Ficha guardada. Ya está visible en el recetario (sección SUB. PREPARACIONES).' });
      else setMsg({ tipo: 'error', texto: (r.error && r.error.message) || r.error || 'No se pudo guardar.' });
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de red al guardar.' });
    } finally {
      setGuardando(false);
    }
  }

  const campo = (k: keyof Campos) => ({
    value: campos[k],
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setCampos((p) => ({ ...p, [k]: e.target.value })),
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-salvia-100 pb-4">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-salvia-400">Ficha técnica · Subreceta</p>
          <h1 className="font-display text-2xl font-bold text-ink">🥣 {nombre || id}</h1>
          <p className="mt-0.5 text-xs text-salvia-500">Sin foto, por diseño: en el recetario esta preparación se muestra solo con su contenido.</p>
        </div>
        <Link href={`/subrecetas/nueva?edit=${id}`} className="text-sm text-salvia-700 hover:underline">← Volver a la subreceta</Link>
      </header>

      {cargando ? (
        <p className="text-sm text-salvia-500">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <div className="card space-y-4 p-5">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-salvia-600">Descripción corta</span>
              <input {...campo('descripcion')} placeholder="Ej: Base cítrica para ceviches y tiraditos"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-salvia-600">Preparación (paso a paso)</span>
              <textarea {...campo('preparacion')} rows={7} placeholder={'1. Licuar los insumos...\n2. Colar fino...\n3. Reservar en frío.'}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm leading-relaxed focus:border-[#2563EB] focus:outline-none" />
              <span className="mt-1 block text-[11px] text-salvia-400">Un paso por línea: el recetario los numera automáticamente.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-salvia-600">Uso / montaje</span>
              <textarea {...campo('emplatado')} rows={3} placeholder="Cómo se usa esta preparación en los platos…"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-salvia-600">Notas de cocina</span>
              <textarea {...campo('notas')} rows={3} placeholder="Vida útil, conservación, puntos críticos…"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-salvia-600">Tiempo (minutos)</span>
                <input {...campo('tiempo_min')} inputMode="numeric" placeholder="15"
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-salvia-600">Rinde / gramaje</span>
                <input {...campo('gramaje_porcion')} placeholder="Ej: 1000 g por tanda"
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-[#2563EB] focus:outline-none" />
              </label>
            </div>
          </div>

          {msg && (
            <p className={`rounded-lg px-3 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.texto}</p>
          )}

          {puedeEditarRecetas ? (
            <button onClick={guardar} disabled={guardando} className="btn-primary w-full disabled:opacity-50">
              {guardando ? 'Guardando…' : 'Guardar ficha'}
            </button>
          ) : (
            <p className="text-center text-xs text-salvia-500">Modo lectura: tu rol no permite editar fichas.</p>
          )}
        </div>
      )}
    </main>
  );
}
