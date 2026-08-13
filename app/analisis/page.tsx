import { getAnalytics, getInsumos } from '@/lib/api/gastrocore';
import { AnalisisDashboard } from './AnalisisDashboard';

export const dynamic = 'force-dynamic';

export default async function AnalisisPage() {
  let analytics = null;
  let insumos: { id: string; articulo: string; coste: number }[] = [];
  let error: string | null = null;
  try {
    const [a, ins] = await Promise.all([getAnalytics(), getInsumos()]);
    analytics = a;
    insumos = ins.map((i) => ({ id: i.id, articulo: i.articulo, coste: i.coste }));
  } catch (e) {
    error = e instanceof Error ? e.message : 'Error desconocido';
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ambar-700">
          📈 Análisis de Variación de Costos
        </h1>
        <p className="text-sm text-salvia-700">
          Inteligencia de negocios: cómo cambian los costos de los insumos y su impacto en la rentabilidad del menú.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          No se pudo cargar el análisis: {error}
        </div>
      ) : !analytics ? (
        <div className="rounded-md border border-line bg-white px-4 py-8 text-center text-sm text-muted">
          Aún no hay datos de variación. Registra cambios de precio en los insumos para generar el análisis.
        </div>
      ) : (
        <AnalisisDashboard analytics={analytics} insumos={insumos} />
      )}
    </main>
  );
}
