'use client';

import { useEffect } from 'react';

/**
 * Registro del service worker.
 *
 * Solo en producción: en desarrollo un service worker activo sirve versiones
 * antiguas y convierte cada cambio en una sesión de depuración innecesaria.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
