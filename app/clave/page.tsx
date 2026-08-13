'use client';
/** v10.1: cambio de clave self-service — cualquier usuario con sesión. */
import { useState } from 'react';

export default function CambiarClavePage() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirma, setConfirma] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setMsg(null);
    if (nueva.length < 10) return setMsg({ tipo: 'error', texto: 'La clave nueva debe tener al menos 10 caracteres.' });
    if (nueva !== confirma) return setMsg({ tipo: 'error', texto: 'La confirmación no coincide.' });
    setEnviando(true);
    try {
      const r = await fetch('/api/usuarios/clave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave_actual: actual, clave_nueva: nueva }),
      }).then((x) => x.json());
      if (r.ok) { setMsg({ tipo: 'ok', texto: '✓ Clave actualizada. Queda encriptada; úsala en tu próximo ingreso.' }); setActual(''); setNueva(''); setConfirma(''); }
      else setMsg({ tipo: 'error', texto: String(r.error || 'No se pudo cambiar la clave.') });
    } catch { setMsg({ tipo: 'error', texto: 'Error de red.' }); }
    finally { setEnviando(false); }
  }

  const cls = 'mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-[#2563EB] focus:outline-none';
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="font-display text-2xl font-bold text-ink">🔑 Cambiar mi clave</h1>
      <p className="mt-1 text-xs text-salvia-500">Tu clave se guarda encriptada (hash SHA-256 con sal): nadie puede leerla, ni siquiera el administrador.</p>
      <div className="card mt-5 space-y-4 p-5">
        <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Clave actual</span>
          <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} className={cls} autoComplete="current-password" /></label>
        <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Clave nueva</span>
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} className={cls} autoComplete="new-password" /></label>
        <label className="block"><span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Confirmar clave nueva</span>
          <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} className={cls} autoComplete="new-password" /></label>
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.texto}</p>}
        <button onClick={enviar} disabled={enviando} className="btn-primary w-full disabled:opacity-50">{enviando ? 'Guardando…' : 'Cambiar clave'}</button>
      </div>
    </main>
  );
}
