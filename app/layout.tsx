import type { Metadata } from 'next';
import { MarcaEnBarra } from '@/components/MarcaEnBarra';
import { TemaToggle } from '@/components/TemaToggle';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'GastroCore \u2014 ERP de Costeo de Recetas',
  description:
    'Plataforma de costeo de recetas para restaurantes. Insumos, recetas, food cost y precios sugeridos.',
};

const NAV = [
  { href: '/insumos', label: 'Insumos', icon: '\uD83D\uDCE6' },
  { href: '/subrecetas', label: 'Subrecetas', icon: '\uD83E\uDD63' },
  { href: '/recetas', label: 'Recetas', icon: '\uD83D\uDCD8' },
  { href: '/recetas/familias', label: 'Familias', icon: '\uD83D\uDDC2\uFE0F' },
  { href: '/recetas/resumen', label: 'Panel', icon: '\uD83D\uDCCA' },
  { href: '/analisis', label: 'An\u00e1lisis', icon: '\uD83D\uDCC8' },
  { href: '/usuarios', label: 'Usuarios', icon: '\uD83D\uDC65' },
  { href: '/manual', label: 'Manual', icon: '❓' },
  { href: '/configuracion', label: 'Configuraci\u00f3n', icon: '\u2699\uFE0F' },
];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* v10.14.1: fuentes por <link> en vez de next/font/google. Next 16
            HACE FALLAR el build si no puede descargar la fuente en tiempo de
            compilacion, y Google Fonts a veces responde 403 a las IPs de build
            de Vercel. Cargarlas en el navegador (como ya se hace con Playfair)
            desacopla el build de Google: el deploy ya no depende de que
            fonts.googleapis.com responda. Los var(--font-*) de tailwind.config
            resuelven contra las variables definidas en globals.css. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:wght@100..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* v10.1.1: script de tema DENTRO de <body> (primer hijo). Antes vivía
            entre <html> y <body> — HTML inválido: el navegador lo reubicaba,
            React fallaba la hidratación en la raíz y re-renderizaba TODA la app
            en el cliente (carga lenta/intermitente). Aquí es válido y se ejecuta
            antes de pintar el contenido: el modo oscuro aplica sin destello. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('gc_tema')==='oscuro')document.documentElement.classList.add('dark')}catch(e){}" }} />
        {session && (
          <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
            <nav className="app-shell flex items-center gap-1 py-2 overflow-x-auto">
              <Link href="/" className="mr-2 flex items-center gap-2 font-display text-lg font-bold text-[#1E3A5F]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white">GC</span>
                GastroCore<MarcaEnBarra />
              </Link>
              <div className="mx-2 h-6 w-px bg-black/10" />
              {NAV.filter((n) => session?.r === 'Admin' || (n.href !== '/usuarios' && n.href !== '/configuracion')).map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-[#1E3A5F] hover:bg-[#EFF6FF]"
                >
                  <span>{n.icon}</span>
                  {n.label}
                </Link>
              ))}
              <div className="ml-auto flex items-center gap-3 pl-3">
                <TemaToggle />
                <a href="/clave" title="Cambiar mi clave" className="rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700">🔑</a>
                <a href="/exportar" title="Exportar recetario a Excel" className="rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700">⬇️</a>
                <span className="hidden whitespace-nowrap text-sm text-slate-500 sm:inline">
                  {session.u}
                </span>
                <a
                  href="/api/auth/logout"
                  className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Salir
                </a>
              </div>
            </nav>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
