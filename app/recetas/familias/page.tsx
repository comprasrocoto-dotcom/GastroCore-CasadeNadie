import { getPantallaFamilias } from '@/lib/api/gastrocore';
import FamiliasClient from './FamiliasClient';

// PUNTO 2 — RENDER EN EL SERVIDOR (ver app/recetas/page.tsx).
// El servidor trae familias + subfamilias + listas de uso (del Data Cache del
// punto 1) y se las pasa ya cargadas al cliente. Sin spinner, sin viaje extra.
export const dynamic = 'force-dynamic';

export default async function FamiliasPage() {
  let initial = null;
  try {
    initial = await getPantallaFamilias();
  } catch {
    initial = null;
  }
  return <FamiliasClient initial={initial} />;
}
