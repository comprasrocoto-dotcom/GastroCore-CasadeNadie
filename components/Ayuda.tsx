'use client';
import { useState } from 'react';

/**
 * Ayuda contextual para los jefes (v9.2): un "?" discreto junto al título
 * de cada sección que abre una explicación en lenguaje de negocio, con
 * ejemplo numérico. Cierra al tocar fuera.
 */
export function Ayuda({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setAbierta((v) => !v); }}
        aria-label={'Ayuda: ' + titulo}
        title="¿Qué significa esto?"
        className="ml-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-salvia-300 bg-white text-[10px] font-bold text-salvia-500 transition hover:border-ambar-400 hover:text-ambar-600"
      >?</button>
      {abierta && (
        <>
          <div className="fixed inset-0 z-[90] cursor-default" onClick={() => setAbierta(false)} />
          <div className="absolute left-1/2 top-full z-[95] mt-2 w-[19rem] max-w-[85vw] -translate-x-1/2 rounded-xl border border-line bg-white p-3.5 text-left shadow-xl">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-800">{titulo}</p>
            <div className="mt-1.5 space-y-1.5 text-[11.5px] font-normal normal-case leading-relaxed tracking-normal text-slate-600">
              {children}
            </div>
          </div>
        </>
      )}
    </span>
  );
}
