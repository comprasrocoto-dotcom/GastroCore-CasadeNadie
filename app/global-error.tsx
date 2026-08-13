'use client';

/**
 * GastroCore — Último recurso (Next 16).
 *
 * app/error.tsx atrapa los fallos de las PÁGINAS, pero si el que revienta es el
 * propio layout raíz (por ejemplo `getSession()` con AUTH_SECRET ausente o mal
 * pegado en Vercel), esa frontera nunca llega a montarse y Vercel vuelve a su
 * pantalla genérica. Este archivo reemplaza ESA pantalla.
 *
 * OJO: global-error DEBE renderizar sus propios <html> y <body> — sustituye al
 * layout raíz por completo. Por eso va con estilos EN LÍNEA: no puede depender
 * de globals.css ni de Tailwind, que podrían ser justamente lo que falló.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', background: '#F8FAFC' }}>
        <main style={{ maxWidth: 640, margin: '0 auto', padding: '80px 24px', color: '#0F172A' }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#DC2626', fontWeight: 600 }}>
            GastroCore · Error crítico
          </p>
          <h1 style={{ margin: '6px 0 8px', fontSize: 26 }}>La aplicación no pudo arrancar</h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 15, lineHeight: 1.6 }}>
            Falló el armazón de la aplicación, no una pantalla puntual. La causa más común es una
            variable de entorno ausente o mal pegada en Vercel (AUTH_SECRET, GASTROCORE_API_URL,
            GASTROCORE_API_TOKEN). Recuerda que cambiar una variable exige <b>Redeploy</b>.
          </p>

          <div style={{ marginTop: 20, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94A3B8', fontWeight: 600 }}>
              Detalle técnico
            </div>
            <div style={{ marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, wordBreak: 'break-word' }}>
              {error?.message || 'Sin mensaje'}
            </div>
            {error?.digest && (
              <div style={{ marginTop: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, color: '#64748B' }}>
                Digest: {error.digest}
              </div>
            )}
          </div>

          <button
            onClick={() => reset()}
            style={{ marginTop: 24, background: '#1E3A5F', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
