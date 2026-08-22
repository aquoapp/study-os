import type { MetadataRoute } from 'next';

/**
 * Manifest de PWA.
 *
 * REQ-A02 · «Next.js + TypeScript, App Router, PWA responsive» ·
 * criterio de aceptación: «Arranca; manifest PWA válido e instalable».
 * Gate P0-G1 · `pwa.manifest.spec`.
 *
 * `display: standalone`, `start_url`, `name`, `short_name` y dos iconos (192 y 512)
 * son los mínimos que exigen los navegadores para ofrecer la instalación. El icono
 * `maskable` evita que Android recorte el logotipo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Study OS',
    short_name: 'Study OS',
    description: 'Sistema de estudio adaptativo.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#fbfbfd',
    theme_color: '#fbfbfd',
    lang: 'es',
    dir: 'ltr',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
