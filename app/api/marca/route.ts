import { NextResponse } from 'next/server';
import { getParametros } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

/** v11.5: el nombre de la marca (Configuración → NOMBRE_NEGOCIO) para el
 *  login y la barra. Público a propósito: es el letrero del local. */
export async function GET() {
  try {
    const p = await getParametros();
    const marca = (p && (p as { nombre_negocio?: string }).nombre_negocio) || '';
    return NextResponse.json({ ok: true, marca });
  } catch {
    return NextResponse.json({ ok: true, marca: '' });
  }
}
