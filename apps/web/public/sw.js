/* Entorno: service worker. Los globales se declaran en eslint.config.mjs. */

/**
 * Service worker de Study OS · Phase 0.
 *
 * Alcance deliberadamente mínimo. EC-012: «Offline acotado; la UI no afirma
 * sincronización sin confirmación». Un service worker generoso es la forma más
 * rápida de romper ese invariante sin darse cuenta.
 *
 * Lo que hace:
 *   - precachea los iconos y la página de respaldo sin conexión;
 *   - sirve la página de respaldo cuando una navegación falla por red.
 *
 * Lo que NO hace, y no debe hacer hasta Phase 9:
 *   - cachear HTML de páginas autenticadas (el caché no distingue usuarios y
 *     serviría la página de una persona a otra en el mismo dispositivo);
 *   - cachear respuestas de `/auth`, de la API de Supabase o de cualquier dato de
 *     usuario;
 *   - encolar mutaciones ni reintentarlas;
 *   - mostrar estado de «sincronizado» de ningún tipo.
 */

const CACHE_VERSION = 'study-os-v0-phase0';
const PRECACHE_URLS = [
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca tocar autenticación ni datos.
  if (url.pathname.startsWith('/auth') || url.pathname.startsWith('/api')) return;

  // Estáticos precacheados: cache-first, son inmutables por versión.
  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
    return;
  }

  // Navegación: siempre red. Si falla, respaldo explícito sin conexión.
  // No se guarda la respuesta: ver nota sobre caché compartido entre usuarios.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match('/offline')
          .then((hit) => hit ?? new Response('Sin conexión', { status: 503 })),
      ),
    );
  }
});
