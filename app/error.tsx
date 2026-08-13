'use client';

/**
 * GastroCore — Frontera de error de la aplicación (App Router, Next 16).
 *
 * POR QUÉ EXISTE
 * ─────────────
 * Sin este archivo, cualquier excepción durante el render hace que el usuario
 * vea la pantalla genérica de Vercel:
 *
 *     "Application error: a server-side exception has occurred
 *      (see the server logs for more information). Digest: 75247084"
 *
 * ...sin nav, sin mensaje útil, sin forma de recuperarse. Ese Digest es un HASH
 * del error: Vercel lo esconde EN PRODUCCIÓN a propósito. Con esta frontera la
 * página sigue viva, se puede REINTENTAR sin recargar, y el digest queda a la
 * vista para cruzarlo con los Runtime Logs de Vercel.
 *
 * Cubre esta ruta y TODAS sus hijas. Un fallo del propio layout raíz lo atrapa
 * app/global-error.tsx.
 *
 * NOTA: los estilos van con clases Tailwind de valor fijo (bg-[#...]) que
 * siempre existen — no dependen de configuración que quizá sea justo lo que
 * falló.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Queda en los Runtime Logs de Vercel junto al digest: el puente entre lo
    // que ve el usuario y lo que ve quien depura.
    console.error('[GastroCore] Error no controlado:', error?.message, error?.digest);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-8 shadow-sm">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DC2626]">
          GastroCore · Error
        </p>
        <h1 className="text-2xl font-bold text-[#7F1D1D]">Algo se rompió en esta pantalla</h1>
        <p className="mt-2 text-[15px] text-[#7F1D1D]/80">
          Tus datos están a salvo: el error ocurrió al DIBUJAR la página, no al guardar. Puedes
          reintentar sin perder nada.
        </p>

        <div className="mt-5 rounded-lg border border-[#FECACA] bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Detalle técnico
          </p>
          <p className="mt-1 break-words font-mono text-[13px] text-slate-700">
            {error?.message || 'Sin mensaje'}
          </p>
          {error?.digest && (
            <p className="mt-2 font-mono text-[12px] text-slate-500">
              Digest: {error.digest}
              <span className="ml-2 font-sans text-[11px] text-slate-400">
                (búscalo en Vercel → Deployment → Logs)
              </span>
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Reintentar
          </button>
          <Link
            href="/recetas"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Ir a Recetas
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
