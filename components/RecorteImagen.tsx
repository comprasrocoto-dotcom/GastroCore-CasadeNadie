'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * EDITOR DE FOTO v9.6 — canvas puro, 0 librerías.
 *
 * Dos modos:
 *  · 📐 ENCUADRAR: marco con aspecto elegible (4:3, 1:1, vertical 3:4,
 *    panorámica 16:9). La foto se arrastra, se rota, y el zoom permite
 *    ACERCAR o ALEJAR — al alejar, la imagen completa cabe en el marco
 *    con bandas blancas (nada se corta si no quieres).
 *  · 🖼 IMAGEN COMPLETA: sin recorte. Se sube tal cual es (larga o
 *    ancha), solo con la rotación aplicada. Máx 1600 px por lado.
 */
const ASPECTOS = [
  { id: '4:3', nombre: '4:3 galería', w: 4, h: 3 },
  { id: '1:1', nombre: 'Cuadrada', w: 1, h: 1 },
  { id: '3:4', nombre: 'Vertical', w: 3, h: 4 },
  { id: '16:9', nombre: 'Panorámica', w: 16, h: 9 },
] as const;

export function RecorteImagen({ src, onListo, onCancelar }:
  { src: string; onListo: (base64: string, mime: string) => void; onCancelar: () => void }) {
  const lienzoRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [modo, setModo] = useState<'encuadrar' | 'completa'>('encuadrar');
  const [aspecto, setAspecto] = useState<(typeof ASPECTOS)[number]>(ASPECTOS[0]);
  const [rot, setRot] = useState(0);          // 0 | 90 | 180 | 270
  const [zoom, setZoom] = useState(1);        // 0.4 (alejar, se ve completa) .. 3
  const [off, setOff] = useState({ x: 0, y: 0 });
  const arrastre = useRef<{ x: number; y: number } | null>(null);
  const [listo, setListo] = useState(false);

  const BASE = 640;
  const ANCHO = BASE;
  const ALTO = Math.round((BASE * aspecto.h) / aspecto.w);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setOff({ x: 0, y: 0 }); setListo(true); };
    img.src = src;
  }, [src]);

  function dimsRotadas() {
    const img = imgRef.current!;
    const rotada = rot % 180 !== 0;
    return { iw: rotada ? img.height : img.width, ih: rotada ? img.width : img.height };
  }

  // Misma matemática para vista previa y exportación (lo que ves es lo que sale).
  function dibujar(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const img = imgRef.current;
    if (!img) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    const { iw, ih } = dimsRotadas();
    if (modo === 'completa') {
      const escala = Math.min(w / iw, h / ih);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(escala, escala);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    } else {
      const fx = (off.x * w) / ANCHO, fy = (off.y * h) / ALTO;
      ctx.translate(fx, fy);
      ctx.rotate((rot * Math.PI) / 180);
      const escala = Math.max(w / iw, h / ih) * zoom;
      ctx.scale(escala, escala);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    }
    ctx.restore();
  }

  useEffect(() => {
    const c = lienzoRef.current;
    const ctx = c?.getContext('2d');
    if (c && ctx && listo) dibujar(ctx, c.width, c.height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rot, zoom, off, listo, modo, aspecto]);

  function empezar(e: React.PointerEvent) {
    if (modo === 'completa') return;
    (e.target as Element).setPointerCapture(e.pointerId);
    arrastre.current = { x: e.clientX - off.x, y: e.clientY - off.y };
  }
  function mover(e: React.PointerEvent) {
    if (!arrastre.current) return;
    setOff({ x: e.clientX - arrastre.current.x, y: e.clientY - arrastre.current.y });
  }
  function soltar() { arrastre.current = null; }

  function exportar() {
    const c = document.createElement('canvas');
    if (modo === 'completa') {
      const { iw, ih } = dimsRotadas();
      const escala = Math.min(1, 1600 / Math.max(iw, ih));
      c.width = Math.round(iw * escala);
      c.height = Math.round(ih * escala);
    } else {
      const LADO = 1600;
      if (aspecto.w >= aspecto.h) { c.width = LADO; c.height = Math.round((LADO * aspecto.h) / aspecto.w); }
      else { c.height = LADO; c.width = Math.round((LADO * aspecto.w) / aspecto.h); }
    }
    const ctx = c.getContext('2d');
    if (!ctx) return;
    dibujar(ctx, c.width, c.height);
    onListo(c.toDataURL('image/jpeg', 0.88).split(',')[1], 'image/jpeg');
  }

  const botonModo = (m: 'encuadrar' | 'completa', txt: string) => (
    <button onClick={() => setModo(m)}
      className={'rounded-lg px-3 py-1.5 text-xs font-semibold transition ' +
        (modo === m ? 'bg-[#1E3A5F] text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50')}>
      {txt}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={onCancelar}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-800">Editar la foto</h3>
          <div className="flex gap-1.5">
            {botonModo('encuadrar', '📐 Encuadrar')}
            {botonModo('completa', '🖼 Imagen completa')}
          </div>
        </div>

        {modo === 'encuadrar' && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Marco:</span>
            {ASPECTOS.map((a) => (
              <button key={a.id} onClick={() => { setAspecto(a); setOff({ x: 0, y: 0 }); }}
                className={'rounded-full px-2.5 py-1 text-[11px] transition ' +
                  (aspecto.id === a.id ? 'bg-amber-100 font-semibold text-amber-800' : 'border border-slate-200 text-slate-500 hover:border-slate-300')}>
                {a.nombre}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-center rounded-lg border border-slate-300 bg-slate-100 p-2">
          <canvas
            ref={lienzoRef}
            width={ANCHO}
            height={ALTO}
            onPointerDown={empezar}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerLeave={soltar}
            className={'max-h-[52vh] w-auto max-w-full touch-none rounded ' + (modo === 'encuadrar' ? 'cursor-move' : '')}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={() => setRot((r) => (r + 270) % 360)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">⟲ Rotar</button>
          <button onClick={() => setRot((r) => (r + 90) % 360)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">⟳ Rotar</button>
          {modo === 'encuadrar' && (
            <label className="flex flex-1 items-center gap-2 text-xs text-slate-600">
              <span className="whitespace-nowrap">Alejar / Acercar</span>
              <input type="range" min={0.4} max={3} step={0.02} value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
            </label>
          )}
          <button onClick={() => { setRot(0); setZoom(1); setOff({ x: 0, y: 0 }); }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-500">Reiniciar</button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          {modo === 'encuadrar'
            ? 'Arrastra para encuadrar · ALEJA el zoom para que la foto quepa COMPLETA en el marco (bandas blancas).'
            : 'La imagen se sube COMPLETA, tal cual es (solo se aplica la rotación).'}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onCancelar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancelar</button>
          <button onClick={exportar} className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white">Usar esta foto</button>
        </div>
      </div>
    </div>
  );
}
