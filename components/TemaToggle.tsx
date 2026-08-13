'use client';
/** v10.1: modo claro/oscuro. El claro es EXACTAMENTE el de siempre; el
 *  oscuro se activa con la clase `dark` en <html> y persiste por navegador. */
import { useEffect, useState } from 'react';

export function TemaToggle() {
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    const guardado = window.localStorage.getItem('gc_tema') === 'oscuro';
    setOscuro(guardado);
    document.documentElement.classList.toggle('dark', guardado);
  }, []);
  function alternar() {
    const nuevo = !oscuro;
    setOscuro(nuevo);
    document.documentElement.classList.toggle('dark', nuevo);
    window.localStorage.setItem('gc_tema', nuevo ? 'oscuro' : 'claro');
  }
  return (
    <button onClick={alternar} title={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700">
      {oscuro ? '☀️' : '🌙'}
    </button>
  );
}
