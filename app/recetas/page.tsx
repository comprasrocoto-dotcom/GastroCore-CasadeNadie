import { getPantallaRecetas } from '@/lib/api/gastrocore';
import RecetasClient from './RecetasClient';

// PUNTO 2 — RENDER EN EL SERVIDOR.
// Antes esta vista era 'use client': el servidor mandaba una cáscara vacía y el
// navegador, ya hidratado, iba a buscar los datos (spinner + un viaje extra).
// Ahora el SERVIDOR trae recetas + familias + parámetros en el mismo render
// (esa lectura sale del Data Cache del punto 1, no golpea Apps Script) y se los
// entrega ya puestos al cliente. El HTML llega con la tabla dentro: sin spinner.
// La interacción (filtros, activar/desactivar) sigue viviendo en el cliente.
export const dynamic = 'force-dynamic';

export default async function RecetasPage() {
  let initial = null;
  try {
    initial = await getPantallaRecetas();
  } catch {
    initial = null; // el cliente reintenta y muestra el error si hace falta
  }
  return <RecetasClient initial={initial} />;
}
