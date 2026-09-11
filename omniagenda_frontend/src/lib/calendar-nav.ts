/**
 * Aritmética de calendario consciente de zona horaria — FASE 5b.
 *
 * No se reimporta `@omniagenda/core` aquí (su `zoned.ts` ya resuelve esto
 * mismo para el backend): traer el núcleo al frontend obligaría a mover el
 * build de Docker a la raíz del repo, igual que se hizo para el backend en
 * la Fase 4, solo para un puñado de funciones. En vez de eso, se usa la
 * MISMA primitiva de plataforma que el núcleo envuelve — `Intl` — escrita
 * de nuevo aquí porque el frontend necesita etiquetas legibles (nombre de
 * día, hora), no la aritmética exacta de recurrencia que sí justifica el
 * núcleo. Nunca de terceros: es un envoltorio delgado sobre `Intl`.
 */

export type CalendarView = 'day' | 'week' | 'month' | 'agenda' | 'timeline';

export const VIEW_LABELS: Record<CalendarView, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  agenda: 'Agenda',
  timeline: 'Línea de tiempo',
};

export const VIEWS: CalendarView[] = ['day', 'week', 'month', 'agenda', 'timeline'];

/** Las partes de una fecha vistas en una zona IANA — sin componente de hora. */
function datePartsInZone(instant: Date, timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function zoneOffsetMinutesAt(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Medianoche (00:00 local de `timeZone`) del día que contiene `instant`, como instante UTC real. */
export function startOfDayInZone(instant: Date, timeZone: string): Date {
  const { year, month, day } = datePartsInZone(instant, timeZone);
  // Se arma la fecha como si fuera UTC y se corrige por el offset real de
  // esa zona en esa fecha — suficiente para fronteras de día; ninguna de
  // las zonas de referencia de este proyecto cruza DST a medianoche.
  const naiveUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offsetMinutes = zoneOffsetMinutesAt(new Date(naiveUtc), timeZone);
  return new Date(naiveUtc - offsetMinutes * 60_000);
}

export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 86_400_000);
}

/**
 * Interpreta una fecha "YYYY-MM-DD" (sin hora, ej. `?date=` en la URL)
 * como medianoche de ESE día en `timeZone` — NUNCA `new Date('2026-09-11')`
 * a secas: eso lo interpreta como medianoche UTC, que en una zona detrás
 * de UTC (América) cae la TARDE del día ANTERIOR — un `date=2026-09-11`
 * con Ciudad de México (UTC-6) resolvía a "10 de septiembre" en vez de
 * "11", moviendo la Vista de Día un día completo y dejándola sin las
 * reservas reales de "hoy". Se ancla con mediodía UTC (nunca cae fuera
 * del día calendario correcto en las zonas de referencia de este
 * proyecto, todas América, sin DST) antes de buscar la medianoche real.
 */
export function parseDateInZone(dateStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return startOfDayInZone(noonUtc, timeZone);
}

/**
 * Suma (o resta) meses a un instante, preservando la zona — para "mes
 * siguiente"/"mes anterior" en `DateNav`. Igual que `parseDateInZone`, se
 * ancla a mediodía UTC antes de normalizar, para no cruzar el borde del
 * día por el offset de la zona.
 */
export function addMonthsInZone(instant: Date, months: number, timeZone: string): Date {
  const { year, month, day } = datePartsInZone(instant, timeZone);
  const noonUtc = new Date(Date.UTC(year, month - 1 + months, day, 12, 0, 0));
  return startOfDayInZone(noonUtc, timeZone);
}

/** Lunes de la semana (ISO) que contiene `instant`, medianoche local de `timeZone`. */
export function startOfWeekInZone(instant: Date, timeZone: string): Date {
  const startOfDay = startOfDayInZone(instant, timeZone);
  const { year, month, day } = datePartsInZone(startOfDay, timeZone);
  const jsDow = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0=domingo
  const isoDow = jsDow === 0 ? 7 : jsDow; // 1=lunes .. 7=domingo
  return addDays(startOfDay, -(isoDow - 1));
}

export function startOfMonthInZone(instant: Date, timeZone: string): Date {
  const { year, month } = datePartsInZone(instant, timeZone);
  const naiveUtc = Date.UTC(year, month - 1, 1, 0, 0, 0);
  const offsetMinutes = zoneOffsetMinutesAt(new Date(naiveUtc), timeZone);
  return new Date(naiveUtc - offsetMinutes * 60_000);
}

/** Ventana [from, to) que una vista necesita cargar del backend para `date`. */
export function viewRange(view: CalendarView, date: Date, timeZone: string): { from: Date; to: Date } {
  switch (view) {
    case 'day': {
      const from = startOfDayInZone(date, timeZone);
      return { from, to: addDays(from, 1) };
    }
    case 'week': {
      const from = startOfWeekInZone(date, timeZone);
      return { from, to: addDays(from, 7) };
    }
    case 'month': {
      // Semanas completas: del lunes de la 1a semana visible al domingo de
      // la última, para que la cuadrícula del mes no tenga huecos.
      const monthStart = startOfMonthInZone(date, timeZone);
      const from = startOfWeekInZone(monthStart, timeZone);
      const { year, month } = datePartsInZone(date, timeZone);
      const nextMonthStart = new Date(Date.UTC(year, month, 1));
      const to = addDays(startOfWeekInZone(nextMonthStart, timeZone), 7);
      return { from, to };
    }
    case 'agenda': {
      const from = startOfDayInZone(date, timeZone);
      return { from, to: addDays(from, 14) };
    }
    case 'timeline': {
      const from = startOfDayInZone(date, timeZone);
      return { from, to: addDays(from, 1) };
    }
  }
}

/** Cuántos días caben entre from y to (para la cuadrícula de mes). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function dayLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone, weekday: 'short', day: 'numeric' }).format(instant);
}

export function weekdayLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone, weekday: 'short' }).format(instant);
}

export function monthLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone, month: 'long', year: 'numeric' }).format(instant);
}

export function dayNumberLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone, day: 'numeric' }).format(instant);
}

const HOUR_LABEL = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', hour12: true });

/** Etiqueta de una hora del día (0–24), sin depender de una fecha real ni de zona. */
export function hourLabel(hour24: number): string {
  const ref = new Date(Date.UTC(2000, 0, 1, hour24 % 24));
  return HOUR_LABEL.format(ref);
}

/** Minutos desde `dayStart` (un instante real, ya alineado a medianoche local) hasta `instant`. */
export function minutesSinceDayStart(instant: Date, dayStart: Date): number {
  return (instant.getTime() - dayStart.getTime()) / 60_000;
}
