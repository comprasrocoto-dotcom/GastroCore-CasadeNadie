import Link from 'next/link';

/**
 * MANUAL DE GASTROCORE — v11.2 (exportación, referencias ERP y seguridad)
 * Esta es también la PORTADA de la aplicación: la raíz (/) redirige aquí.
 */

export const metadata = { title: 'Manual · GastroCore' };

function S({ n, titulo, children }: { n?: string; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-salvia-100 bg-white p-6 shadow-sm">
      <h2 className="mb-3 font-display text-xl font-bold text-ink">
        {n && <span className="mr-2 text-ambar-600">{n}.</span>}
        {titulo}
      </h2>
      <div className="space-y-2 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function K({ children }: { children: React.ReactNode }) {
  return <b className="text-slate-900">{children}</b>;
}

export default function ManualPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 border-b border-salvia-100 pb-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-salvia-400">GastroCore · Manual</p>
        <h1 className="font-display text-3xl font-bold text-ink">Cómo funciona GastroCore</h1>
        <p className="mt-1 text-sm text-salvia-500">
          El sistema de costeo y recetario de la operación. Esta página es la portada: aquí está todo lo que hace cada vista.
        </p>
      </header>

      <div className="space-y-5">
        <S titulo="El flujo, en una frase">
          <p>
            <K>INSUMOS</K> es el único maestro de compras (cada uno con su <K>referencia única</K> y su costo) →
            las <K>SUBRECETAS</K> son la calculadora de tus preparaciones y proponen el costo del insumo &quot;SUB.&quot; →
            las <K>RECETAS</K> (los platos de la carta, clasificados por <K>FAMILIA</K>) se costean leyendo SOLO insumos →
            y el <K>RECETARIO</K>, el <K>PANEL</K> y <K>ANÁLISIS</K> muestran el resultado a cocina y a los jefes.
          </p>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm">
            💡 La merma se costea por <K>rendimiento</K> (gross-up ÷): 100 g con 10% de merma
            cuestan como 111 g — porque para servir 100 g hay que comprar 111. El desvío de mercancía es un recargo (×).
          </p>
        </S>

        <S n="1" titulo="Insumos — el maestro">
          <p><K>➕ Nuevo insumo:</K> referencia (código único — el sistema avisa EN VIVO si ya existe), artículo, unidad, subfamilia, costo inicial y merma estándar. Si nace con costo, queda el primer punto en su historial.</p>
          <p><K>✏️ Editar</K> cambia los datos del maestro. <K>💲 El costo se cambia aparte</K>: pide motivo, queda en el historial de precios y <K>recalcula en cascada</K> todas las recetas y calculadoras que lo usan.</p>
          <p><K>⇪ Carga por plano:</K> sube un CSV (descarga la plantilla con los costos actuales) y actualiza cientos de costos de un golpe — solo cambia lo que trae el archivo.</p>
          <p><K>Filtros:</K> por subfamilia y por 🏷 centro de costo. La <K>unidad</K> de cada insumo se define aquí y las recetas la heredan (no es editable en la línea).</p>
          <p><K>🥣 Crear subreceta:</K> en las filas &quot;SUB.&quot; sin calculadora aparece el botón 🥣 — te lleva al editor con el maestro ya preseleccionado (✓ verde = ya la tiene). <K>Donde se usa:</K> muestra en qué recetas <K>y subrecetas</K> participa el insumo, con su tipo (🍽️/🥣).</p>
        </S>

        <S n="2" titulo="Subrecetas — la calculadora de preparaciones">
          <p>Toda preparación vive en INSUMOS como un artículo &quot;SUB.&quot; — la subreceta es su <K>calculadora</K>: ingredientes + rendimiento → costo por unidad.</p>
          <p><K>Al crear:</K> enlaza un insumo &quot;SUB.&quot; existente (el buscador excluye los ya enlazados) o crea el maestro nuevo con referencia única y subfamilia.</p>
          <p><K>Al entrar</K> a una subreceta se ve en <K>modo lectura</K> (nada se toca por accidente); el botón <K>✏️ Editar</K> desbloquea. La lista muestra al final <K>💲 Insumos vs Subreceta</K>: los dos costos lado a lado (✓ si coinciden, ≠ si no) — toda la fila es clicable.</p>
          <p><K>EL PUENTE:</K> guardar ya no pregunta nada. La decisión vive dentro de la subreceta: la tarjeta del maestro muestra el costo actual y el calculado, y el botón <K>⇪ Actualizar el costo del insumo</K> lo empuja con historial y recálculo en cascada de las recetas que lo usan.</p>
          <p>Cada subreceta tiene su <K>📝 Ficha técnica</K> (sin foto): preparación, uso/montaje, notas, tiempo y rinde — y aparece en el Recetario en la sección <K>SUB. RECETAS</K>.</p>
          <p>Cuando cambia el precio de un ingrediente, la calculadora <K>se refresca sola</K> (sin tocar el maestro) — el estado siempre dice la verdad.</p>
          <p><K>Referencia ERP:</K> cada subreceta hereda la referencia de su maestro (el sistema <K>sugiere la siguiente libre</K>, tipo SUB059 — editable). Las unidades del selector salen de la tabla <K>UnidadesMedida</K> del Sheet: agregas una fila allá y aparece acá. Y si al editar cambias la <K>unidad de rendimiento</K>, el insumo maestro se actualiza solo.</p>
        </S>

        <S n="3" titulo="Recetas — los platos de la carta">
          <p>Cada receta pertenece a <K>UNA familia</K> (la categoría de la carta: ENTRADAS, CEVICHES…). La lista se agrupa por familia — y si digitaste centros de costo, en bloques 🏷 por centro.</p>
          <p><K>El buscador de ingredientes:</K> escribe nombre o referencia (ignora tildes y mayúsculas), navega con ↑↓ y elige con Enter. Cada resultado muestra la referencia, la subfamilia y el costo <K>por su unidad</K>. Los repetidos se marcan &quot;ya en la receta&quot;.</p>
          <p><K>Costeo en vivo:</K> cantidad + % de merma por línea → cantidad real y costo; desvío global; el <K>precio sugerido</K> sale del Food Cost objetivo vigente (el global de Configuración, o la excepción de la familia si existe) más el impuesto.</p>
          <p><K>Referencia ERP:</K> cada receta lleva su código para el ERP — el sistema sugiere el siguiente de la familia (COC001, COC002…) y rechaza duplicados.</p>
          <p>Cada guardado crea una <K>versión con snapshot</K> — desde Trazabilidad puedes comparar y restaurar. El botón <K>📖 Ver recetario completo</K> abre la vista de cocina.</p>
        </S>

        <S n="4" titulo="Ficha técnica y Recetario">
          <p>La ficha lleva preparación, emplatado, notas, tiempo, gramaje y la <K>foto</K>. El editor de foto tiene dos modos: <K>📐 Encuadrar</K> (marcos 4:3, cuadrada, vertical o panorámica; aleja el zoom para que quepa completa) e <K>🖼 Imagen completa</K> (se sube tal cual es).</p>
          <p>El <K>Recetario</K> es la vista pública de cocina: galería por categorías, secciones 🏷 por centro de costo (con su filtro), la sección <K>SUB. RECETAS</K> con las preparaciones (misma tarjeta y detalle, sin foto ni precios), buscador por plato o ingrediente, y <K>🔍 lupa</K> en la foto. Guardar una ficha, foto o estilo se refleja <K>al instante</K>.</p>
        </S>

        <S n="5" titulo="Familias — las clasificaciones">
          <p>Dos mundos: <K>🍽 Familias de recetas</K> (las categorías de la carta, con su conteo de platos) y <K>📦 Clasificaciones de insumos</K> (FRUVER, ABARROTES…, con su conteo de insumos).</p>
          <p><K>🏷 Centro de costo:</K> se digita en la familia (y en las clasificaciones de insumos, que si están vacías heredan). Agrupa y filtra Recetas, Insumos y el Recetario. Crear y editar es en línea (nombre + CC juntos); desactivar avisa cuántos elementos quedan sin clasificar.</p>
          <p><K>🔎 Ver usos:</K> cada familia y clasificación tiene su lupa — un modal con la lista real de platos (🍽️) o insumos (📦) que la usan. Los <K>nombres son únicos</K>: el sistema rechaza repetidos, sin importar mayúsculas.</p>
        </S>

        <S n="6" titulo="Panel ejecutivo y Análisis">
          <p><K>Panel:</K> KPIs (activas, Food Cost promedio, utilidad potencial, fuera de precio), semáforo de críticas, y la tabla con <K>precio editable</K> que simula el FC al instante antes de guardar. Exporta a CSV.</p>
          <p><K>Análisis:</K> simulador de impacto (&quot;¿y si el aguacate sube 15%?&quot;), alertas automáticas (subidas sobre el umbral, FC vencido, insumos en $0), tops de aumentos y bajadas, variación por familia de insumos, evolución semanal (foto de cada lunes 6 AM) e impacto en el menú.</p>
          <p><K>🔬 Lectura de experto</K> (Panel): 5 ángulos que los promedios esconden — dinero en la mesa, platos a un paso del rojo, concentración del margen, Food Cost &quot;demasiado bueno&quot; (ficha incompleta) y la familia despareja. <K>📣 Lectura del período</K> (Análisis): los indicadores traducidos a decisiones con nombre propio.</p>
          <p>Cada sección tiene un <K>?</K> con la explicación y un ejemplo — para que cualquier jefe lea los números sin traductor.</p>
        </S>

        <S n="7" titulo="⬇️ Exportar — Excel y PDF">
          <p><K>Excel completo</K> (el ⬇️ de la barra): la relación entera — cada receta y subreceta como bloque con sus ingredientes, costos y food cost, con portada y hojas separadas. Dos chulitos: <K>incluir fichas técnicas</K> (solo texto) y <K>solo activas</K>.</p>
          <p><K>PDF por preparación:</K> en el detalle de una receta (o al abrir una subreceta) el botón <K>⬇️ PDF</K> descarga su hoja de obra: banda de color, tabla de ingredientes, ficha técnica y paginación. Azul = receta, ámbar = subreceta.</p>
        </S>

        <S n="8" titulo="Configuración (solo Admin)">
          <p><K>Parámetros de costeo:</K> Food Cost objetivo (con excepciones por familia), impuesto y umbral de alertas. Guardarlos con cambios de precio <K>recalcula todo el menú automáticamente</K> y sincroniza la columna de margen.</p>
          <p><K>Identidad</K> (nombre del negocio en recetario y PDF), <K>🎨 Estilo del recetario</K> (6 paletas — Rocoto clásico, Malanga tropical, Pacífico, Ají amarillo, Carbón, Vino tinto — cada proyecto con su piel; cambia fondo, banda y títulos), <K>respaldo</K> del Sheet a Excel con un clic, y <K>rotación del token</K> de la API (se muestra una sola vez).</p>
        </S>

        <S n="9" titulo="Roles — quién puede qué">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-salvia-200 text-left text-[11px] uppercase tracking-wide text-salvia-500">
                  <th className="py-2 pr-3">Vista / función</th>
                  <th className="px-2 py-2 text-center">Admin</th>
                  <th className="px-2 py-2 text-center">Chef</th>
                  <th className="px-2 py-2 text-center">Lector</th>
                </tr>
              </thead>
              <tbody className="[&_td]:py-1.5 [&_tr]:border-b [&_tr]:border-salvia-50">
                <tr><td>Ver recetas, subrecetas, insumos, panel, análisis y recetario</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                <tr><td>Crear y editar recetas, fichas y fotos · activar/desactivar</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center">—</td></tr>
                <tr><td>Crear y editar subrecetas · el puente al insumo maestro</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center">—</td></tr>
                <tr><td>Crear/editar insumos, cambiar costos, carga por plano</td><td className="text-center">✓</td><td className="text-center">—</td><td className="text-center">—</td></tr>
                <tr><td>Familias, clasificaciones y centros de costo</td><td className="text-center">✓</td><td className="text-center">—</td><td className="text-center">—</td></tr>
                <tr><td>Usuarios (la vista completa)</td><td className="text-center">✓</td><td className="text-center">—</td><td className="text-center">—</td></tr>
                <tr><td>Configuración: parámetros, respaldo, credenciales</td><td className="text-center">✓</td><td className="text-center">—</td><td className="text-center">—</td></tr>
                <tr><td>Exportar a Excel · PDF por preparación</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
                <tr><td>🔑 Cambiar SU propia clave · 🌙 modo oscuro · salir</td><td className="text-center">✓</td><td className="text-center">✓</td><td className="text-center">✓</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">🔐 Las claves se guardan <K>cifradas</K> (hash): nadie — ni el Admin — puede leerlas; solo cambiarlas. Cada quien renueva la suya con el 🔑 de la barra.</p>
        </S>

        <S titulo="Glosario exprés">
          <p><K>Referencia:</K> el código único de cada insumo — es la llave de la carga por plano y de todo el sistema. · <K>Food Cost:</K> % del precio (sin impuesto) que se va en materia prima. · <K>Merma:</K> lo que se pierde al procesar; se costea por rendimiento (÷). · <K>Desvío:</K> recargo por pérdidas operativas (×). · <K>El puente:</K> confirmar el costo calculado de una subreceta hacia su insumo maestro. · <K>🏷 Centro de costo:</K> a qué área contable pertenece cada familia (COCINA, BAR…).</p>
        </S>

        <p className="pt-2 text-center text-sm text-salvia-500">
          ¿Listo? Empieza por <Link href="/insumos" className="font-medium text-ambar-600 hover:underline">Insumos</Link> o ve directo a <Link href="/recetas" className="font-medium text-ambar-600 hover:underline">Recetas</Link>.
        </p>
      </div>
    </main>
  );
}
