/**
 * Frontera de autoridad de las proyecciones.
 *
 * INV-113 · «El servidor es la autoridad exclusiva para persistir Mastery, Exam
 * Readiness y estado del Planner. Ninguna ruta de cliente escribe esas proyecciones.
 * Se permiten helpers y proyecciones locales explícitamente **no autoritativas**
 * siempre que estén marcadas como tales y sean sustituidas por la proyección del
 * servidor al sincronizar.»
 *
 * ADR-001 v1.1 punto 2 · REQ-A08 · EC-002 · EC-003 · EC-012
 *
 * El tipo obliga a que la distinción sea explícita: no existe forma de construir
 * una proyección sin declarar de qué lado de la frontera está.
 */

import registry from './authority-registry.json';

/**
 * Proyecciones y RPC cuya escritura es competencia exclusiva del servidor.
 *
 * Se leen de `authority-registry.json` en lugar de escribirse aquí porque
 * `tools/guards/client-authority-guard.mjs` necesita la misma lista y es un script
 * de Node sin resolutor de TypeScript. Con dos listas, la del código y la de la
 * guarda se separan a la primera incorporación y la guarda deja de proteger lo que
 * cree proteger.
 */
export const SERVER_AUTHORITATIVE_PROJECTIONS: readonly string[] = registry.projections.tables;

/**
 * RPC reservadas como autoritativas. Ninguna existe todavía —Phase 0 no crea
 * funciones de dominio—; se declaran para que la primera llamada desde el
 * navegador falle en CI y no en revisión. Cada nombre lleva su anclaje a un
 * invariante congelado en el propio registro.
 */
export const SERVER_AUTHORITATIVE_RPCS: readonly string[] = registry.rpcs.names;

export type ServerAuthoritativeProjection = string;

export function isServerAuthoritativeProjection(value: string): boolean {
  return SERVER_AUTHORITATIVE_PROJECTIONS.includes(value);
}

export function isServerAuthoritativeRpc(value: string): boolean {
  return SERVER_AUTHORITATIVE_RPCS.includes(value);
}

/** Proyección confirmada por el servidor. Es la que manda, siempre. */
export interface AuthoritativeProjection<T> {
  readonly authoritative: true;
  readonly value: T;
  /** Versión del motor que la produjo (EC-002, EC-003, EC-006). */
  readonly engineVersion: string;
  /** `stream_position` del usuario consumida — pendiente de SD-018 (ver nota abajo). */
  readonly watermark: number;
}

/**
 * Proyección local provisional. Existe para dar continuidad visual sin mentir
 * (EC-012: «la UI no afirma sincronización sin confirmación»).
 *
 * Nunca se persiste. Se sustituye por la del servidor al sincronizar, y toda
 * divergencia se resuelve **siempre** a favor del servidor, sin fusión
 * (ADR-001 v1.1 punto 2).
 */
export interface LocalProjection<T> {
  readonly authoritative: false;
  readonly value: T;
  /** Motivo por el que existe esta estimación local. Obliga a justificarla. */
  readonly reason: 'optimistic-feedback' | 'offline-estimate' | 'session-progress';
}

export type Projection<T> = AuthoritativeProjection<T> | LocalProjection<T>;

export function isAuthoritative<T>(
  projection: Projection<T>,
): projection is AuthoritativeProjection<T> {
  return projection.authoritative;
}

/**
 * Constructor único de proyecciones locales. Que exista un único punto de creación
 * permite auditarlas y hace imposible «olvidar» la marca.
 */
export function localProjection<T>(
  value: T,
  reason: LocalProjection<T>['reason'],
): LocalProjection<T> {
  return { authoritative: false, value, reason };
}

/*
 * NOTA · SD-018 · PROPOSED, no implementado. Sustituye a SD-015.
 *
 * `watermark` está tipado como número porque SD-018 lo define como la posición del
 * stream del usuario consumida por la proyección. **SD-018 sigue en PROPOSED** y
 * debe aprobarse antes de crear cualquier migración de eventos: posición monotónica
 * por usuario/stream, contador bloqueado en la misma transacción que inserta,
 * `unique(user_id, stream_position)`, `event_id` como única clave de idempotencia
 * —comprobada **después** del bloqueo—, watermark por usuario y proyección,
 * `client_created_at` para la semántica temporal, y ninguna inferencia de ausencia
 * definitiva mediante timeout.
 *
 * SD-015 queda superseded: proponía una secuencia global de PostgreSQL, que no es
 * transaccional y deja huecos que después hay que gestionar.
 *
 * En Phase 0 no existe ninguna tabla de eventos y este tipo no se usa todavía en
 * ninguna ruta. Es andamiaje del contrato, no una implementación.
 */
