import { getSubrecetas } from '@/lib/api/gastrocore';
import SubrecetasClient from './SubrecetasClient';

// PUNTO 2 — RENDER EN EL SERVIDOR (ver app/recetas/page.tsx).
// El servidor trae la lista (del Data Cache del punto 1) y se la pasa ya
// cargada al cliente. Sin spinner, sin viaje extra tras hidratar.
export const dynamic = 'force-dynamic';

export default async function SubrecetasPage() {
  let initial = null;
  try {
    initial = await getSubrecetas(true);
  } catch {
    initial = null;
  }
  return <SubrecetasClient initial={initial} />;
}
