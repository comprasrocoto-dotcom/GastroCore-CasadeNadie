'use client';
/** v11.5: la marca de Configuración junto al nombre de la app. */
import { useEffect, useState } from 'react';

export function MarcaEnBarra() {
  const [marca, setMarca] = useState('');
  useEffect(() => {
    fetch('/api/marca').then((r) => r.json()).then((j) => setMarca(j?.marca || '')).catch(() => {});
  }, []);
  if (!marca) return null;
  return <span className="font-normal text-salvia-500"> · {marca}</span>;
}
