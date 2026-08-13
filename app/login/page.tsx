'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * v10.14.2 — SANEA EL PARÁMETRO ?next= DEL LOGIN.
 *
 * ANTES: `next.startsWith('/')` — parecía suficiente, pero NO lo es.
 * "//otro-dominio.com" empieza por '/', y el navegador lo interpreta como una
 * URL absoluta con el protocolo actual: https://otro-dominio.com. Es decir, un
 * enlace como
 *     https://gastro-core-sin-par.vercel.app/login?next=//sitio-falso.com
 * llevaba al usuario a un sitio ajeno JUSTO DESPUÉS de escribir su clave, con
 * la confianza de venir de tu dominio. Se llama redirección abierta y es el
 * andamio clásico de un phishing.
 *
 * AHORA: se exige una sola barra inicial, sin barra ni contrabarra detrás, y
 * sin esquema (javascript:, data:, http:). Cualquier otra cosa cae al Manual,
 * que es la vista que todos los roles pueden ver.
 */
export function rutaInternaSegura(destino: string | null | undefined): string {
  const RESPALDO = '/manual';
  if (!destino) return RESPALDO;
  const d = String(destino).trim();
  if (d === '' || d === '/') return RESPALDO;                       // '/' normalizado
  if (!d.startsWith('/')) return RESPALDO;                          // relativa o absoluta ajena
  if (d.startsWith('//') || d.startsWith('/\\')) return RESPALDO;    // //dominio.com y /\dominio.com
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(d)) return RESPALDO;            // /javascript:, /data:
  if (/[\x00-\x1f]/.test(d)) return RESPALDO;                      // control chars
  return d;
}


function LoginInner() {
  const [marca, setMarca] = useState('');
  useEffect(() => {
    fetch('/api/marca').then((r) => r.json()).then((j) => setMarca(j?.marca || '')).catch(() => {});
  }, []);
  const router = useRouter();
  const params = useSearchParams();
  // v11.6: la app SIEMPRE arranca en el Manual — la única vista que todos
  // los roles pueden ver (los deep-links con ?next= se respetan).
  const nextCrudo = params.get('next') || '/manual';
  const next = rutaInternaSegura(nextCrudo);

  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, clave }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j.error || 'No se pudo iniciar sesión');
        return;
      }
      // Ruta segura: solo permitimos rutas internas.
      router.replace(next); // v10.14.2: ya viene saneado por rutaInternaSegura()
      router.refresh();
    } catch {
      setError('Error de red al iniciar sesión');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm rounded-2xl border border-black/5 bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white">
            GC
          </span>
          <div>
            <h1 className="font-display text-lg font-bold text-[#1E3A5F]">GastroCore</h1>
            {marca && <p className="mt-0.5 font-display text-2xl font-bold tracking-tight text-ink">{marca}</p>}
            <p className="text-xs text-slate-500">Ingreso al panel de costeo</p>
          </div>
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
          autoComplete="username"
          required
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Clave</label>
        <input
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
          autoComplete="current-password"
          required
        />

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-lg bg-[#1E3A5F] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#16304e] disabled:opacity-60"
        >
          {cargando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
