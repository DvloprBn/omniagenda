/**
 * Aritmética PURA de la cuadrícula de tiempo (Fase 5b) — sin DOM, sin
 * React. Separado a propósito de `week-view.tsx`: la lógica de "¿a qué
 * horario corresponde este arrastre?" se puede probar con `node:test` sin
 * un navegador; el componente solo la usa.
 */

/** Ventana visible de horas en las vistas de rejilla (día/semana). 07:00–21:00. */
export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 21;
export const GRID_TOTAL_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;

/** Redondea `minutes` (desde medianoche) al múltiplo de `stepMinutes` más cercano. */
export function snapMinutes(minutes: number, stepMinutes: number): number {
  return Math.round(minutes / stepMinutes) * stepMinutes;
}

/** Minutos desde medianoche -> posición vertical (px) dentro de la rejilla. */
export function minutesToTopPx(minutesSinceMidnight: number, pxPerMinute: number): number {
  return (minutesSinceMidnight - GRID_START_HOUR * 60) * pxPerMinute;
}

export function durationToHeightPx(durationMinutes: number, pxPerMinute: number): number {
  return durationMinutes * pxPerMinute;
}

/** Recorta minutos-desde-medianoche a la ventana visible de la rejilla. */
export function clampToGrid(minutesSinceMidnight: number): number {
  return Math.min(Math.max(minutesSinceMidnight, GRID_START_HOUR * 60), GRID_END_HOUR * 60);
}

/**
 * Dado un desplazamiento vertical en px durante un arrastre, cuántos
 * minutos representa — ya redondeado al escalón de 15 min (el mismo
 * criterio de Fantastical/Notion Calendar: se arrastra "suelto" pero se
 * suelta en un horario limpio).
 */
export function pxDeltaToSnappedMinutes(deltaPx: number, pxPerMinute: number, stepMinutes = 15): number {
  const rawMinutes = deltaPx / pxPerMinute;
  return snapMinutes(rawMinutes, stepMinutes);
}

/** ¿A qué columna de día (0-based) cae un desplazamiento horizontal? */
export function pxDeltaToColumnShift(deltaPx: number, columnWidthPx: number): number {
  return Math.round(deltaPx / columnWidthPx);
}
