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
  /** `server_sequence` consumido — pendiente de SD-015 (ver nota abajo). */
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
 * NOTA · SD-015 · PROPOSED, no aplicado.
 *
 * `watermark` está tipado como número porque la decisión de SD-015 lo define como
 * `learning_events.server_sequence`. **SD-015 sigue en PROPOSED** y debe revisarse
 * antes del checkpoint de Phase 0 y antes de crear cualquier migración de eventos:
 * posición monotónica transaccional por usuario/stream, `unique(user_id, stream_position)`,
 * asignación bajo bloqueo transaccional, watermark por usuario y proyección,
 * `event_id` como clave de idempotencia, `client_created_at` para semántica temporal,
 * y ninguna inferencia de ausencia definitiva mediante timeout.
 *
 * En Phase 0 no existe ninguna tabla de eventos y este tipo no se usa todavía en
 * ninguna ruta. Es andamiaje del contrato, no una implementación de SD-015.
 */
