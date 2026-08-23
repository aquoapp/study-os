import type { Metadata, Viewport } from 'next';
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

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="es">
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
