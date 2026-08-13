'use client';
import { fetchEnCola } from '@/lib/colaGuardado';

/**
 * Usuarios (ADMIN) — /usuarios
 * Gestión de los usuarios del panel contra la hoja 'Usuarios' del backend.
 * La clave NUNCA viaja del backend al navegador (sanitización server-side);
 * aquí solo se ESCRIBE una clave nueva. Nadie se elimina: se desactiva.
 */
import { useEffect, useState } from 'react';

type Usuario = { id: string; email: string; nombre: string; rol: string; activo: boolean | string };

const ROLES = ['Admin', 'Chef', 'Lector'];
const VACIO = { email: '', nombre: '', rol: 'Lector', clave: '' };

function esActivo(v: Usuario['activo']): boolean {
  return v === true || v === 'TRUE' || v === 'VERDADERO' || v === '';
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nuevo, setNuevo] = useState({ ...VACIO });
  const [editando, setEditando] = useState<string | null>(null);
  const [formEdit, setFormEdit] = useState({ nombre: '', rol: 'Lector', clave: '' });
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const r = await fetch('/api/usuarios');
      const j = await r.json();
      if (j.ok) setUsuarios(j.usuarios || []);
      else setMensaje({ tipo: 'error', texto: j.error || 'No se pudo cargar' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red' });
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  async function accion(payload: object, exito: string) {
    setOcupado(true);
    setMensaje(null);
    try {
      const r = await fetchEnCola('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (j.ok) { setMensaje({ tipo: 'ok', texto: exito }); await cargar(); return true; }
      setMensaje({ tipo: 'error', texto: j.error || 'No se pudo completar' });
      return false;
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red' });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function crear() {
    if (await accion({ accion: 'crear', data: nuevo }, 'Usuario creado.')) setNuevo({ ...VACIO });
  }
  async function guardarEdicion(id: string) {
    if (await accion({ accion: 'editar', data: { id, ...formEdit } }, 'Usuario actualizado.')) setEditando(null);
  }
  async function cambiarEstado(u: Usuario) {
    const activar = !esActivo(u.activo);
    await accion(
      { accion: 'estado', data: { id: u.id, activo: activar } },
      activar ? 'Usuario reactivado.' : 'Usuario desactivado: ya no puede iniciar sesión.',
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-xl font-bold text-[#1E3A5F]">Usuarios</h1>
      <p className="mt-1 text-sm text-slate-500">
        Quién puede entrar al panel y con qué rol. <b>Admin</b>: acceso total. <b>Chef</b>: puede crear y
        editar recetas, subrecetas y fichas técnicas; el resto solo lectura. <b>Lector</b>: solo consulta,
        sin editar ni crear nada.
      </p>

      {mensaje && (
        <p className={'mt-4 rounded-lg px-3 py-2 text-sm ' + (mensaje.tipo === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')}>
          {mensaje.texto}
        </p>
      )}

      {/* Crear */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">➕ Nuevo usuario</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="email" placeholder="Email" value={nuevo.email}
            onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]" />
          <input type="text" placeholder="Nombre completo" value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]" />
          <select value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="password" placeholder="Clave (mín. 10 caracteres)" value={nuevo.clave}
            onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]" />
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={crear} disabled={ocupado}
            className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16304e] disabled:opacity-60">
            Crear usuario
          </button>
        </div>
      </section>

      {/* Lista */}
      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {cargando ? (
          <p className="p-6 text-sm text-slate-400">Cargando usuarios…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Usuario</th>
                <th className="px-4 py-2.5 font-semibold">Rol</th>
                <th className="px-4 py-2.5 font-semibold">Estado</th>
                <th className="px-4 py-2.5 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  {editando === u.id ? (
                    <>
                      <td className="px-4 py-2.5">
                        <p className="text-xs text-slate-400">{u.email}</p>
                        <input value={formEdit.nombre} onChange={(e) => setFormEdit({ ...formEdit, nombre: e.target.value })}
                          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                        <input type="password" placeholder="Nueva clave (vacío = no cambiar)" value={formEdit.clave}
                          onChange={(e) => setFormEdit({ ...formEdit, clave: e.target.value })}
                          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                      </td>
                      <td className="px-4 py-2.5">
                        <select value={formEdit.rol} onChange={(e) => setFormEdit({ ...formEdit, rol: e.target.value })}
                          className="rounded border border-slate-300 px-2 py-1 text-sm">
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => guardarEdicion(u.id)} disabled={ocupado}
                          className="mr-2 rounded bg-[#1E3A5F] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Guardar</button>
                        <button onClick={() => setEditando(null)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancelar</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{u.nombre || '—'}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={'rounded-full px-2 py-0.5 text-[11px] font-semibold ' +
                          (u.rol === 'Admin' ? 'bg-[#1E3A5F]/10 text-[#1E3A5F]' : 'bg-slate-100 text-slate-600')}>
                          {u.rol || 'Usuario'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={'text-xs font-semibold ' + (esActivo(u.activo) ? 'text-green-700' : 'text-red-600')}>
                          {esActivo(u.activo) ? '● Activo' : '○ Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => { setEditando(u.id); setFormEdit({ nombre: u.nombre || '', rol: u.rol || 'Usuario', clave: '' }); }}
                          className="mr-2 rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50">Editar</button>
                        <button onClick={() => cambiarEstado(u)} disabled={ocupado}
                          className={'rounded px-3 py-1 text-xs font-semibold disabled:opacity-60 ' +
                            (esActivo(u.activo) ? 'border border-red-200 text-red-600 hover:bg-red-50' : 'border border-green-200 text-green-700 hover:bg-green-50')}>
                          {esActivo(u.activo) ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-3 text-xs text-slate-400">
        Los usuarios nunca se eliminan (auditoría): se desactivan y pueden reactivarse. La clave se
        escribe pero jamás se muestra.
      </p>
      {/* ═══ v9.8: qué puede hacer cada rol ═══ */}
      <section className="mt-8 rounded-xl border border-salvia-100 bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-display text-lg font-bold text-ink">¿Qué puede hacer cada rol?</h2>
        <p className="mb-3 text-xs text-salvia-500">
          Los permisos los aplica el servidor en cada petición (no son solo botones ocultos). El rol se asigna en la columna de cada usuario.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-salvia-200 text-left text-[11px] uppercase tracking-wide text-salvia-500">
                <th className="py-2 pr-3">Vista / función</th>
                <th className="px-2 py-2 text-center">👑 Admin</th>
                <th className="px-2 py-2 text-center">👨‍🍳 Chef</th>
                <th className="px-2 py-2 text-center">👁 Lector</th>
              </tr>
            </thead>
            <tbody className="[&_td]:py-2 [&_tr]:border-b [&_tr]:border-salvia-50">
              {[
                ['Ver recetas, subrecetas, insumos, panel, análisis y recetario', true, true, true],
                ['Crear y editar recetas, fichas y fotos · activar/desactivar', true, true, false],
                ['Crear y editar subrecetas · actualizar el insumo maestro (el puente)', true, true, false],
                ['Crear/editar insumos · cambiar costos · carga por plano', true, false, false],
                ['Familias, clasificaciones y centros de costo', true, false, false],
                ['Usuarios (esta vista)', true, false, false],
                ['Configuración: parámetros de costeo, respaldo, credenciales', true, false, false],
              ].map(([txt, a, c, l], i) => (
                <tr key={i}>
                  <td className="pr-3 text-slate-700">{txt as string}</td>
                  {[a, c, l].map((v, j) => (
                    <td key={j} className="text-center">
                      {v ? <span className="font-semibold text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] text-slate-500">
          👨‍🍳 <b>Chef</b> es el rol de cocina: dueño de recetas, preparaciones y fichas — sin acceso a costos del maestro ni a la administración.
          👁 <b>Lector</b> consulta todo sin tocar nada (ideal para socios o auditoría).
        </p>
      </section>

    </main>
  );
}
