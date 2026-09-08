/**
 * Configuración de Next.js.
 *
 * REQ-A02 · Next.js + TypeScript, App Router, PWA responsive
 * REQ-A05 · sin secretos de servicio/proveedor en el bundle
 *
 * `transpilePackages` incorpora los paquetes internos del monorepo, que se
 * publican como TypeScript sin compilar.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  transpilePackages: ['@study-os/design-system', '@study-os/config', '@study-os/domain'],

  typescript: {
    // Un error de tipos rompe el build. `npm run typecheck` es el mismo control,
    // ejecutado antes y más rápido.
    ignoreBuildErrors: false,
  },

  // Cabeceras de seguridad mínimas. No sustituyen a RLS ni a INV-116; reducen
  // superficie (Manifest §14).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // El service worker no debe quedar cacheado: si lo hace, una versión
        // antigua sobrevive a los despliegues.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
