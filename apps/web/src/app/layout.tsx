import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import '@study-os/design-system/tokens.css';

import { ServiceWorkerRegistrar } from './_components/service-worker-registrar';

/**
 * Layout raíz.
 *
 * Phase 0 no construye pantallas de producto ni navegación primaria: los cinco
 * espacios de EC-015 existen como constante congelada en `@study-os/design-system`
 * y se montarán en Phase 5. Poner aquí una barra de navegación sería adelantar
 * alcance (Execution Plan §9).
 */

export const metadata: Metadata = {
  title: 'Study OS',
  description: 'Sistema de estudio adaptativo.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Study OS',
  appleWebApp: {
    capable: true,
    title: 'Study OS',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Design System §2 · una sola paleta: Canvas / Warm Ivory. El documento no
  // especifica tema oscuro, así que no se declara uno.
  themeColor: '#f7f3ea',
};

/**
 * **IBM Plex Sans** · VIS-D2 y VIS-D3, ratificadas el 2026-09-20.
 *
 * **Una sola familia en todo el producto.** No se añade una serif para LEER en Phase 4B: la
 * diferencia entre voz de sistema y voz de aprendizaje se consigue **dentro** de la familia, con
 * peso, tracking, caja, escala, ritmo y medida (§S.11). Tampoco se usa monoespaciada para
 * comunicar computación, que §S.11 prohíbe explícitamente.
 *
 * `next/font` la **autoaloja en el build**: ninguna petición a un tercero al cargar la página,
 * ninguna dependencia nueva en `package.json` y ninguna infraestructura de pago. `display: swap`
 * evita el texto invisible mientras carga.
 */
const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--so-font-product',
});

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="es" className={plex.variable}>
      <body>
        <a href="#contenido" className="so-skip-link">
          Saltar al contenido
        </a>
        <main id="contenido">{children}</main>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
