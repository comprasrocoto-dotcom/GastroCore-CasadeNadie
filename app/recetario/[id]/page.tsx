import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRecetaPublica, getTemaRecetarioId } from '@/lib/recetario';
import { temaPorId } from '@/lib/temasRecetario';
import { DetalleReceta } from '@/components/RecetarioGaleria';

// v9.13.1: render por petición — los datos siguen cacheados 5 min por etiquetas,
// pero al purgarse (guardar foto/ficha/estilo) el cambio se ve en el PRIMER refresco.
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const { getNombreNegocio } = await import('@/lib/recetario');
  return { title: 'Receta · ' + (await getNombreNegocio()) };
}

/**
 * Detalle público por URL directa (/recetario/REC-000011).
 * En la galería el detalle se abre como MODAL; esta página existe para los
 * enlaces directos — en especial el botón "👁 Ver como cocina" del admin — y
 * reutiliza EXACTAMENTE el mismo componente del modal con el tema Rocoto.
 */
export default async function RecetaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  // v10.14.2 — EN NEXT 16 `params` ES UNA PROMESA.
  // Esta página seguía declarándola como objeto plano y leyendo params.id de
  // forma síncrona: en Next 16 eso devuelve undefined, el backend recibe una
  // lectura SIN id y contesta la LISTA COMPLETA del recetario en vez de una
  // receta. Ni tsc ni next build lo detectan — solo se ve en producción.
  const { id } = await params;

  // v10.14.2 — "NO EXISTE" Y "NO PUDE LEERLA" NO SON LO MISMO.
  // El `.catch(() => null)` de antes mandaba las dos cosas a notFound(): un
  // cocinero en servicio veía "esta página no existe" para una receta que
  // estaba perfectamente ahí, y asumía que la habían borrado.
  let receta: Awaited<ReturnType<typeof getRecetaPublica>> = null;
  let errorLectura: string | null = null;
  try {
    receta = await getRecetaPublica(id);
  } catch (e) {
    errorLectura = e instanceof Error ? e.message : 'No se pudo leer la receta.';
  }
  const tema = temaPorId(await getTemaRecetarioId().catch(() => 'rocoto'));

  if (errorLectura) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center" style={{ background: '#F6F1E6' }}>
        <div>
          <div className="mb-3 text-4xl">⏳</div>
          <h1 className="mb-2 text-xl font-bold" style={{ color: '#1E3B2C' }}>
            No se pudo cargar la receta
          </h1>
          <p className="mx-auto max-w-sm text-sm text-neutral-600">
            La receta no fue borrada: lo que falló fue la conexión. Refresca en unos segundos.
          </p>
          <p className="mt-3 text-xs text-neutral-400">{errorLectura}</p>
          <Link href="/recetario" className="mt-6 inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: '#1E3B2C' }}>
            Volver al recetario
          </Link>
        </div>
      </main>
    );
  }
  if (!receta) notFound(); // el backend contestó y dijo que no está

  return (
    <main className="min-h-screen px-3 py-6 sm:px-6" style={{ background: '#F6F1E6' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,500&display=swap"
      />
      <div className="mx-auto max-w-2xl">
        <Link
          href="/recetario"
          className="mb-3 inline-block rounded-full border bg-white px-4 py-1.5 text-xs font-semibold shadow-sm hover:bg-neutral-50"
          style={{ color: '#1E3B2C', borderColor: '#DDD4C0' }}
        >
          ← Volver al recetario
        </Link>
        <DetalleReceta tema={tema} r={receta} />
      </div>
    </main>
  );
}
