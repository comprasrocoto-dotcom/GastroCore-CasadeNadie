'use client';
import { fetchEnCola } from '@/lib/colaGuardado';
import { RecorteImagen } from '@/components/RecorteImagen';

/**
 * Ficha técnica (ADMIN) — /recetas/[id]/ficha
 * Edita descripción, preparación, emplatado, notas, tiempo y gramaje, y sube
 * la foto del plato. La foto se COMPRIME en el navegador (máx 1600px, JPEG)
 * antes de enviarse, para no ahogar Apps Script con fotos de cámara.
 * "Ver como cocina" abre la vista pública real de esta receta.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Ficha = {
  preparacion: string;
  emplatado: string;
  notas: string;
  foto_url: string;
  tiempo_min: string;
  gramaje_porcion: string;
};

const FICHA_VACIA: Ficha = {
  preparacion: '',
  emplatado: '',
  notas: '',
  foto_url: '',
  tiempo_min: '',
  gramaje_porcion: '',
};

/** Comprime una imagen en el navegador: máx `maxLado` px, JPEG calidad 0.85. */
async function comprimirImagen(file: File, maxLado = 1600): Promise<{ base64: string; mime: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('No se pudo leer la imagen'));
      i.src = url;
    });
    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const w = Math.round(img.width * escala);
    const h = Math.round(img.height * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { base64: dataUrl.split(',')[1], mime: 'image/jpeg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function FichaTecnicaPage() {
  const params = useParams<{ id: string }>();
  const recetaId = params.id;

  const [ficha, setFicha] = useState<Ficha>(FICHA_VACIA);
  const [nombreReceta, setNombreReceta] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [recortando, setRecortando] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`/api/fichas?receta_id=${encodeURIComponent(recetaId)}`);
      const j = await r.json();
      if (j.ok) {
        setNombreReceta(j.receta?.nombre || recetaId);
        if (j.ficha) {
          setFicha({
            preparacion: j.ficha.preparacion || '',
            emplatado: j.ficha.emplatado || '',
            notas: j.ficha.notas || '',
            foto_url: j.ficha.foto_url || '',
            tiempo_min: String(j.ficha.tiempo_min ?? ''),
            gramaje_porcion: String(j.ficha.gramaje_porcion ?? ''),
          });
        }
      } else {
        setMensaje({ tipo: 'error', texto: j.error || 'No se pudo cargar la ficha' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red al cargar la ficha' });
    } finally {
      setCargando(false);
    }
  }, [recetaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function campo<K extends keyof Ficha>(k: K, v: Ficha[K]) {
    setFicha((f) => ({ ...f, [k]: v }));
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    try {
      const r = await fetchEnCola('/api/fichas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receta_id: recetaId, ...ficha }),
      });
      const j = await r.json();
      if (j.ok) setMensaje({ tipo: 'ok', texto: 'Ficha guardada. Cocina la verá en máximo 5 minutos.' });
      else setMensaje({ tipo: 'error', texto: j.error || 'No se pudo guardar' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red al guardar' });
    } finally {
      setGuardando(false);
    }
  }

  async function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMensaje({ tipo: 'error', texto: 'El archivo debe ser una imagen (JPG, PNG…)' });
      return;
    }
    // v7.9: abrir el recortador (rotar + encuadrar) antes de subir.
    const lector = new FileReader();
    lector.onload = () => setRecortando(String(lector.result));
    lector.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = '';
    return;
  }

  async function subirRecortada(base64: string, mime: string) {
    setRecortando(null);
    setSubiendoFoto(true);
    setMensaje(null);
    try {
      const r = await fetchEnCola('/api/fichas/foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receta_id: recetaId, base64, mime }),
      });
      const j = await r.json();
      if (j.ok && j.foto_url) {
        campo('foto_url', j.foto_url);
        setMensaje({ tipo: 'ok', texto: 'Foto subida a Drive y asignada a la receta.' });
      } else {
        setMensaje({ tipo: 'error', texto: j.error || 'No se pudo subir la foto' });
      }
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error al procesar la imagen' });
    } finally {
      setSubiendoFoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (cargando) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500">Cargando ficha técnica…</main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/recetas/${recetaId}`}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Receta
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Ficha técnica</p>
          <h1 className="truncate font-display text-lg font-bold text-[#1E3A5F]">{nombreReceta}</h1>
        </div>
        <a
          href={`/recetario/${recetaId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-[#2B4D2E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#223d24]"
        >
          👁 Ver como cocina
        </a>
      </div>

      {mensaje && (
        <p
          className={
            'mb-4 rounded-lg px-3 py-2 text-sm ' +
            (mensaje.tipo === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')
          }
        >
          {mensaje.texto}
        </p>
      )}

      {/* Foto */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Foto del plato</h2>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-36 w-52 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
            {ficha.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${ficha.foto_url}=w600`} alt="Foto actual" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-slate-400">Sin foto</span>
            )}
          </div>
          <div className="text-sm">
            <input ref={fileRef} type="file" accept="image/*" onChange={onFoto} className="hidden" id="foto-input" />
            {recortando && (
              <RecorteImagen src={recortando} onListo={subirRecortada} onCancelar={() => setRecortando(null)} />
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={subiendoFoto}
              className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16304e] disabled:opacity-60"
            >
              {subiendoFoto ? 'Subiendo…' : ficha.foto_url ? 'Cambiar foto' : 'Subir foto'}
            </button>
            <p className="mt-2 max-w-xs text-xs text-slate-500">
              La imagen se comprime automáticamente y se guarda en la carpeta de Drive configurada. La
              anterior va a la papelera.
            </p>
          </div>
        </div>
      </section>

      {/* Campos de la ficha */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <Campo etiqueta="Preparación (un paso por línea)">
          <textarea
            value={ficha.preparacion}
            onChange={(e) => campo('preparacion', e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
            placeholder={'1. Llevar a fritura profunda (160°) los palmitos apanados.\n2. Cortar cada palmito en forma diagonal.\n3. …'}
          />
        </Campo>

        <Campo etiqueta="Emplatado (un paso por línea)">
          <textarea
            value={ficha.emplatado}
            onChange={(e) => campo('emplatado', e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
            placeholder={'1. Trazar la salsa melcocha en la base del plato.\n2. Montar los palmitos en abanico.\n3. …'}
          />
        </Campo>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tiempo de preparación (min)">
            <input
              type="number"
              min={0}
              value={ficha.tiempo_min}
              onChange={(e) => campo('tiempo_min', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
            />
          </Campo>
          <Campo etiqueta="Gramaje por porción (ej: 350 g)">
            <input
              type="text"
              value={ficha.gramaje_porcion}
              onChange={(e) => campo('gramaje_porcion', e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
            />
          </Campo>
        </div>

        <Campo etiqueta="Notas para cocina (opcional)">
          <textarea
            value={ficha.notas}
            onChange={(e) => campo('notas', e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
            placeholder="Alergenos, puntos críticos, temperatura de servicio…"
          />
        </Campo>

        <div className="flex justify-end pt-1">
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-lg bg-[#1E3A5F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16304e] disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar ficha'}
          </button>
        </div>
      </section>
    </main>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{etiqueta}</label>
      {children}
    </div>
  );
}
