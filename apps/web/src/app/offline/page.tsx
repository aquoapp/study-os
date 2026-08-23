export const metadata = { title: 'Sin conexión · Study OS' };

/**
 * Respaldo sin conexión.
 *
 * EC-012 · «Offline acotado; la UI no afirma sincronización sin confirmación».
 * INV-107 · el copy no atribuye fracaso a la interrupción.
 *
 * ---------------------------------------------------------------------------
 * Por qué este texto y no otro
 *
 * La versión anterior decía «Nada de lo que estabas haciendo se ha perdido por
 * este motivo». Era una promesa de persistencia, y en Phase 0 **no hay ninguna
 * persistencia local**: no existe cola de eventos, ni IndexedDB, ni reintentos.
 * Eso llega en Phase 9. Afirmarlo ahora es exactamente lo que EC-012 prohíbe —
 * «la UI nunca debe afirmar sincronización antes de la confirmación»— y, peor, es
 * la clase de mentira tranquilizadora que se descubre cuando alguien ya ha perdido
 * media sesión de estudio.
 *
 * El texto actual describe el estado de la red y qué hacer, sin prometer nada
 * sobre lo que se conserva. Cuando Phase 9 implemente la cola y haya confirmación
 * real del servidor, el mensaje podrá decir algo más, y podrá demostrarlo.
 *
 * `tests/unit/offline.copy.spec.ts` impide reintroducir cualquier garantía de
 * persistencia o sincronización mientras no exista.
 * ---------------------------------------------------------------------------
 */
export default function OfflinePage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }} data-testid="offline-page">
      <h1>Sin conexión</h1>
      <p>Esta pantalla necesita conexión y ahora mismo no la hay.</p>
      <p style={{ color: 'var(--so-color-slate)' }}>Vuelve a intentarlo cuando se restablezca.</p>
    </div>
  );
}
