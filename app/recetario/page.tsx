import { getRecetario, getNombreNegocio, getTemaRecetarioId } from '@/lib/recetario';
import { temaPorId } from '@/lib/temasRecetario';
import RecetarioGaleria from '@/components/RecetarioGaleria';

// v9.13.1: render por petición — los datos siguen cacheados 5 min por etiquetas,
// pero al purgarse (guardar foto/ficha/estilo) el cambio se ve en el PRIMER refresco.
export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const nombre = await getNombreNegocio();
  return { title: 'Recetario · ' + nombre, description: 'Recetario de cocina de ' + nombre };
}

// Página PÚBLICA (ver proxy). Los datos llegan cacheados 5 min desde el
// servidor; el navegador de cocina nunca toca la API con token.
export default async function RecetarioPage() {
  let recetas;
  const nombreNegocio = await getNombreNegocio();
  const tema = temaPorId(await getTemaRecetarioId());
  try {
    recetas = await getRecetario();
  } catch (e) {
    // v10.10.7: se muestra el motivo real. Antes el `catch` mudo dejaba esta
    // pantalla sin ninguna pista de qué había fallado.
    const motivo = e instanceof Error ? e.message : String(e);
    return (
      <main
        className="flex min-h-screen items-center justify-center px-6 text-center"
        style={{ background: '#F6F1E6' }}
      >
        <div>
          <div className="mb-3 text-4xl">🌿</div>
          <h1 className="mb-2 text-xl font-bold" style={{ color: '#1E3B2C' }}>
            El recetario no está disponible
          </h1>
          <p className="text-sm text-neutral-500">
            No se pudo cargar la información. Intenta de nuevo en unos minutos.
          </p>
          <p className="mt-3 text-xs text-neutral-400">{motivo}</p>
        </div>
      </main>
    );
  }
  return (
    <>
      {/* Tipografía display del sitio de Rocoto (serif elegante para títulos) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,500&display=swap"
      />
      <RecetarioGaleria tema={tema} recetas={recetas} nombreNegocio={nombreNegocio} />
    </>
  );
}
