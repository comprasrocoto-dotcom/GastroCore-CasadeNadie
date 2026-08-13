'use client';
import { useEffect, useState } from 'react';

export type Rol = 'Admin' | 'Chef' | 'Lector' | string;

/** Rol de la sesión actual para condicionar la UI (la seguridad real vive en el proxy). */
export function useRol(): { rol: Rol | null; esAdmin: boolean; puedeEditarRecetas: boolean; cargando: boolean } {
  const [rol, setRol] = useState<Rol | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setRol(d?.rol || null))
      .catch(() => setRol(null))
      .finally(() => setCargando(false));
  }, []);
  return { rol, esAdmin: rol === 'Admin', puedeEditarRecetas: rol === 'Admin' || rol === 'Chef', cargando };
}
