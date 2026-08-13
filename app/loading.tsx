/**
 * Skeleton global (v7): se muestra al instante durante las transiciones de
 * ruta mientras los Server Components esperan al backend. Cambia la
 * percepción de "pantalla en blanco" por "la app ya respondió".
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl animate-pulse px-4 py-8">
      <div className="h-7 w-52 rounded-lg bg-slate-200" />
      <div className="mt-2 h-4 w-80 rounded bg-slate-100" />
      <div className="mt-6 space-y-3">
        <div className="h-11 rounded-xl bg-slate-100" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-slate-100" style={{ opacity: 1 - i * 0.09 }} />
        ))}
      </div>
    </main>
  );
}
