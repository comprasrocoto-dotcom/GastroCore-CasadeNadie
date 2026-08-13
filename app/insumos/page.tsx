import { getInsumos, getSubfamilias, getFamilias, getUnidades } from '@/lib/api/gastrocore';
import { esAdmin } from '@/lib/session';
import { InsumosTabla } from './InsumosTabla';

export const dynamic = 'force-dynamic';

export default async function InsumosPage() {
  let insumos: any[] = [];
  let subfamilias: any[] = [];
  let familias: any[] = [];
  let unidades: any[] = [];
  let admin = false;
  let error: string | null = null;
  try {
    [insumos, subfamilias, familias, unidades, admin] = await Promise.all([getInsumos(), getSubfamilias().catch(() => []), getFamilias().catch(() => []), getUnidades().catch(() => []), esAdmin()]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error desconocido';
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ambar-700">Insumos</h1>
          <p className="text-sm text-salvia-700">
            Catalogo maestro conectado en vivo con la base de datos.
          </p>
        </div>
        <span className="rounded-full bg-salvia-100 px-3 py-1 text-sm font-medium text-salvia-700">
          {insumos.length} insumos
        </span>
      </header>

      {error ? (
        <div className="rounded-md border border-dashed border-ambar-300 bg-ambar-50 p-6 text-sm text-ambar-800">
          <p className="font-semibold">No se pudo cargar la informacion.</p>
          <p className="mt-1">{error}</p>
          <p className="mt-3 text-salvia-700">
            Verifica que las variables GASTROCORE_API_URL y GASTROCORE_API_TOKEN
            esten configuradas en Vercel.
          </p>
        </div>
      ) : (
        <InsumosTabla insumos={insumos} subfamilias={subfamilias} familias={familias} unidades={unidades} esAdmin={admin} />
      )}
    </main>
  );
}
