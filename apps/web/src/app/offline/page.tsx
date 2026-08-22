export const metadata = { title: 'Sin conexión · Study OS' };

/**
 * Respaldo sin conexión.
 *
 * EC-012 / INV-107 · el texto describe un estado de red, no un fallo de la persona.
 * No promete sincronización ni sugiere que se haya perdido nada.
 */
export default function OfflinePage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }} data-testid="offline-page">
      <h1>Sin conexión</h1>
      <p>Esta pantalla necesita conexión y ahora mismo no la hay.</p>
      <p style={{ color: 'var(--so-color-text-secondary)' }}>
        Vuelve a intentarlo cuando se restablezca. Nada de lo que estabas haciendo se ha perdido por
        este motivo.
      </p>
    </div>
  );
}
