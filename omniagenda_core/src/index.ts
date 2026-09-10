/**
 * @omniagenda/core — motor de agenda replicable.
 *
 * TypeScript puro: sin Nest, sin Prisma, sin React. Recibe datos ya
 * cargados y devuelve decisiones sobre tiempo, recurrencia,
 * disponibilidad y conflicto. Todo lo demas (persistencia, el `EXCLUDE`
 * de PostgreSQL, permisos, cron, correo, Stripe) vive en la capa de
 * aplicacion — ver ../PLAN_DESARROLLO.md §6.
 */

/** Version del contrato publico. Sube cuando cambie una firma exportada. */
export const OMNIAGENDA_CORE_VERSION = '0.1.0' as const;

// ── Algebra de tiempo ──────────────────────────────────────────────────
export type { Interval } from './time/interval.js';
export {
  isValidInterval,
  durationMs,
  overlaps,
  contains,
  containsInstant,
  intersection,
  gapMs,
  expand,
} from './time/interval.js';
export {
  normalize,
  union,
  subtract,
  intersect,
  freeWithin,
  totalDurationMs,
  expandEach,
  dropShorterThan,
} from './time/interval-set.js';

// ── Zona horaria ───────────────────────────────────────────────────────
export type { WallTime, WallParts } from './time/zoned.js';
export {
  wallPartsInZone,
  zoneOffsetMinutes,
  instantFromWall,
  startOfDayInZone,
  addDaysInZone,
} from './time/zoned.js';

// ── Recurrencia (RFC 5545, subconjunto) ────────────────────────────────
export type { RecurrenceRule, Occurrence } from './recurrence/rrule.js';
export { expandRecurrence } from './recurrence/rrule.js';
export {
  MATERIALIZATION_HORIZON_DAYS,
  MATERIALIZATION_HORIZON_MS,
  materializationWindow,
} from './recurrence/horizon.js';

// ── Disponibilidad ─────────────────────────────────────────────────────
export type { DayHours, DayKey, WeeklyHours } from './availability/weekly-hours.js';
export { expandWeeklyHours } from './availability/weekly-hours.js';
export type { AvailabilityQuery } from './availability/availability.js';
export { computeAvailability } from './availability/availability.js';

// ── Conflicto ──────────────────────────────────────────────────────────
export { NON_BLOCKING_STATUSES, isBlockingStatus } from './conflict/status.js';
export type { NonBlockingStatus } from './conflict/status.js';
export type { ResourceBooking, ConflictCandidate, ConflictReport } from './conflict/conflict.js';
export { evaluateConflict } from './conflict/conflict.js';
