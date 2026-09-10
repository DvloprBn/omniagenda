import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandWeeklyHours, type WeeklyHours } from './weekly-hours.js';
import { instantFromWall, wallPartsInZone } from '../time/zoned.js';

const MX = 'America/Mexico_City';
const wall = (y: number, mo: number, d: number, h = 0, mi = 0) =>
  instantFromWall({ year: y, month: mo, day: d, hour: h, minute: mi }, MX);

const MonToFri: WeeklyHours = {
  mon: { open: '09:00', close: '14:00' },
  tue: { open: '09:00', close: '14:00' },
  wed: { open: '09:00', close: '14:00' },
  thu: { open: '09:00', close: '14:00' },
  fri: { open: '09:00', close: '14:00' },
  sat: null,
  sun: null,
};

test('expande L-V en una ventana de 7 dias; fin de semana cerrado', () => {
  // 2026-03-02 lunes .. 2026-03-09 lunes
  const out = expandWeeklyHours(MonToFri, { start: wall(2026, 3, 2), end: wall(2026, 3, 9) }, MX);
  assert.equal(out.length, 5);
  const first = wallPartsInZone(out[0]!.start, MX);
  assert.deepEqual([first.month, first.day, first.hour, first.minute], [3, 2, 9, 0]);
  const firstEnd = wallPartsInZone(out[0]!.end, MX);
  assert.deepEqual([firstEnd.hour, firstEnd.minute], [14, 0]);
});

test('recorta a la ventana: si la ventana empieza a mediodia, el martes arranca a esa hora', () => {
  const out = expandWeeklyHours(MonToFri, { start: wall(2026, 3, 3, 12, 0), end: wall(2026, 3, 4) }, MX);
  assert.equal(out.length, 1);
  const p = wallPartsInZone(out[0]!.start, MX);
  assert.deepEqual([p.day, p.hour], [3, 12], 'recortado por el inicio de la ventana');
});

test('dia sin entrada en el patron = cerrado', () => {
  const onlyMon: WeeklyHours = { mon: { open: '08:00', close: '10:00' } };
  const out = expandWeeklyHours(onlyMon, { start: wall(2026, 3, 2), end: wall(2026, 3, 9) }, MX);
  assert.equal(out.length, 1);
});

test('rango que cruza medianoche es un error en Fase 1', () => {
  const overnight: WeeklyHours = { mon: { open: '20:00', close: '02:00' } };
  assert.throws(
    () => expandWeeklyHours(overnight, { start: wall(2026, 3, 2), end: wall(2026, 3, 3) }, MX),
    RangeError,
  );
});

test('"HH:MM" mal formado es un error', () => {
  const bad: WeeklyHours = { mon: { open: '9:00', close: '14:00' } };
  assert.throws(() => expandWeeklyHours(bad, { start: wall(2026, 3, 2), end: wall(2026, 3, 3) }, MX), RangeError);
});
