import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAvailability } from './availability.js';
import type { WeeklyHours } from './weekly-hours.js';
import { instantFromWall, wallPartsInZone } from '../time/zoned.js';

const MX = 'America/Mexico_City';
const wall = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  instantFromWall({ year: y, month: mo, day: d, hour: h, minute: mi }, MX);
const hhmm = (t: number) => {
  const p = wallPartsInZone(t, MX);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
};
const asHHMM = (arr: { start: number; end: number }[]) => arr.map((i) => [hhmm(i.start), hhmm(i.end)]);

const openAllWeek: WeeklyHours = {
  mon: { open: '09:00', close: '17:00' }, tue: { open: '09:00', close: '17:00' },
  wed: { open: '09:00', close: '17:00' }, thu: { open: '09:00', close: '17:00' },
  fri: { open: '09:00', close: '17:00' }, sat: null, sun: null,
};

// martes 2026-03-03, un solo dia de ventana
const dayWindow = { start: wall(2026, 3, 3), end: wall(2026, 3, 4) };

test('sin reservas: el hueco libre es toda la jornada', () => {
  const free = computeAvailability({ window: dayWindow, timeZone: MX, weeklyHours: openAllWeek });
  assert.deepEqual(asHHMM(free), [['09:00', '17:00']]);
});

test('una reserva a mediodia parte el dia en dos', () => {
  const free = computeAvailability({
    window: dayWindow, timeZone: MX, weeklyHours: openAllWeek,
    busy: [{ start: wall(2026, 3, 3, 12, 0), end: wall(2026, 3, 3, 13, 0) }],
  });
  assert.deepEqual(asHHMM(free), [['09:00', '12:00'], ['13:00', '17:00']]);
});

test('colchon de 30 min ensancha lo ocupado a ambos lados', () => {
  const free = computeAvailability({
    window: dayWindow, timeZone: MX, weeklyHours: openAllWeek,
    busy: [{ start: wall(2026, 3, 3, 12, 0), end: wall(2026, 3, 3, 13, 0) }],
    bufferMinutes: 30,
  });
  assert.deepEqual(asHHMM(free), [['09:00', '11:30'], ['13:30', '17:00']]);
});

test('ausencia de dia completo -> sin disponibilidad', () => {
  const free = computeAvailability({
    window: dayWindow, timeZone: MX, weeklyHours: openAllWeek,
    timeOff: [{ start: wall(2026, 3, 3), end: wall(2026, 3, 4) }],
  });
  assert.deepEqual(free, []);
});

test('minSlotMinutes descarta los fragmentos chicos', () => {
  const free = computeAvailability({
    window: dayWindow, timeZone: MX, weeklyHours: openAllWeek,
    busy: [
      { start: wall(2026, 3, 3, 9, 20), end: wall(2026, 3, 3, 12, 0) },  // deja 09:00-09:20 (20 min)
      { start: wall(2026, 3, 3, 13, 0), end: wall(2026, 3, 3, 16, 0) },
    ],
    minSlotMinutes: 30,
  });
  // 09:00-09:20 se descarta; quedan 12:00-13:00 y 16:00-17:00
  assert.deepEqual(asHHMM(free), [['12:00', '13:00'], ['16:00', '17:00']]);
});
