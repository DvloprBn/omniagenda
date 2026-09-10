import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandRecurrence, type RecurrenceRule } from './rrule.js';
import { wallPartsInZone, instantFromWall } from '../time/zoned.js';

const MX = 'America/Mexico_City';
const NY = 'America/New_York';
const DAY = 86_400_000;
const at = (y: number, mo: number, d: number, h = 9, mi = 0, tz = MX) =>
  instantFromWall({ year: y, month: mo, day: d, hour: h, minute: mi }, tz);

const base = (over: Partial<RecurrenceRule>): RecurrenceRule => ({
  dtStart: at(2026, 3, 2), // lunes 2 de marzo de 2026, 09:00
  durationMs: 60 * 60_000,
  timeZone: MX,
  freq: 'DAILY',
  ...over,
});

test('DAILY: una ocurrencia por dia dentro de la ventana', () => {
  const rule = base({ freq: 'DAILY' });
  const occ = expandRecurrence(rule, { start: at(2026, 3, 2), end: at(2026, 3, 9) });
  assert.equal(occ.length, 7);
  assert.equal(new Date(occ[0]!.start).toISOString(), new Date(at(2026, 3, 2)).toISOString());
  assert.equal(occ[0]!.end - occ[0]!.start, 60 * 60_000);
  assert.deepEqual(occ.map((o) => o.index), [0, 1, 2, 3, 4, 5, 6]);
});

test('DAILY INTERVAL=2: dia por medio', () => {
  const occ = expandRecurrence(base({ interval: 2 }), { start: at(2026, 3, 2), end: at(2026, 3, 12) });
  assert.deepEqual(occ.map((o) => wallPartsInZone(o.start, MX).day), [2, 4, 6, 8, 10]);
});

test('WEEKLY BYDAY lun/mie/vie', () => {
  const rule = base({ freq: 'WEEKLY', byWeekday: [1, 3, 5] });
  const occ = expandRecurrence(rule, { start: at(2026, 3, 2), end: at(2026, 3, 16) });
  // semana 1: L2 X4 V6 ; semana 2: L9 X11 V13
  assert.deepEqual(occ.map((o) => wallPartsInZone(o.start, MX).day), [2, 4, 6, 9, 11, 13]);
  for (const o of occ) assert.equal(wallPartsInZone(o.start, MX).hour, 9);
});

test('WEEKLY INTERVAL=2: cada dos semanas', () => {
  const rule = base({ freq: 'WEEKLY', interval: 2, byWeekday: [1] });
  const occ = expandRecurrence(rule, { start: at(2026, 3, 2), end: at(2026, 4, 1) });
  assert.deepEqual(occ.map((o) => [wallPartsInZone(o.start, MX).month, wallPartsInZone(o.start, MX).day]),
    [[3, 2], [3, 16], [3, 30]]);
});

test('MONTHLY BYMONTHDAY=31 se recorta al ultimo dia real (feb)', () => {
  const rule = base({ dtStart: at(2026, 1, 31), freq: 'MONTHLY', byMonthDay: [31] });
  const occ = expandRecurrence(rule, { start: at(2026, 1, 1), end: at(2026, 5, 1) });
  // ene 31, feb 28 (2026 no bisiesto), mar 31, abr 30
  assert.deepEqual(occ.map((o) => [wallPartsInZone(o.start, MX).month, wallPartsInZone(o.start, MX).day]),
    [[1, 31], [2, 28], [3, 31], [4, 30]]);
});

test('MONTHLY BYMONTHDAY=[30,31] no duplica en un mes de 30 dias', () => {
  const rule = base({ dtStart: at(2026, 4, 1), freq: 'MONTHLY', byMonthDay: [30, 31] });
  const occ = expandRecurrence(rule, { start: at(2026, 4, 1), end: at(2026, 5, 1) });
  assert.deepEqual(occ.map((o) => wallPartsInZone(o.start, MX).day), [30]);
});

test('COUNT limita el total de la serie', () => {
  const occ = expandRecurrence(base({ count: 3 }), { start: at(2026, 1, 1), end: at(2027, 1, 1) });
  assert.equal(occ.length, 3);
});

test('UNTIL es inclusivo en el inicio', () => {
  const occ = expandRecurrence(base({ until: at(2026, 3, 4) }), { start: at(2026, 1, 1), end: at(2027, 1, 1) });
  assert.deepEqual(occ.map((o) => wallPartsInZone(o.start, MX).day), [2, 3, 4]);
});

test('EXDATE quita exactamente la ocurrencia indicada, sin recorrer el indice', () => {
  const skip = at(2026, 3, 3);
  const occ = expandRecurrence(base({ exDates: [skip] }), { start: at(2026, 3, 2), end: at(2026, 3, 6) });
  assert.deepEqual(occ.map((o) => wallPartsInZone(o.start, MX).day), [2, 4, 5]);
  assert.deepEqual(occ.map((o) => o.index), [0, 2, 3], 'el indice de serie se conserva');
});

test('ventana entera antes de dtStart -> vacio', () => {
  const occ = expandRecurrence(base({}), { start: at(2025, 1, 1), end: at(2025, 2, 1) });
  assert.deepEqual(occ, []);
});

test('ventana entera despues de UNTIL -> vacio', () => {
  const occ = expandRecurrence(base({ until: at(2026, 3, 10) }), { start: at(2026, 6, 1), end: at(2026, 7, 1) });
  assert.deepEqual(occ, []);
});

test('recurrencia en zona CON DST mantiene la hora de pared (09:00) al cruzar la transicion', () => {
  // EEUU adelanta el reloj el 8 de marzo de 2026.
  const rule = base({ dtStart: at(2026, 3, 6, 9, 0, NY), timeZone: NY });
  const occ = expandRecurrence(rule, { start: at(2026, 3, 6, 0, 0, NY), end: at(2026, 3, 11, 0, 0, NY) });
  assert.deepEqual(occ.map((o) => wallPartsInZone(o.start, NY).hour), [9, 9, 9, 9, 9]);
  // ...pero el salto entre el 7 y el 8 dura 23 h, no 24.
  const d7to8 = occ[2]!.start - occ[1]!.start;
  assert.equal(d7to8, 23 * 3_600_000);
});

test('interval invalido lanza', () => {
  assert.throws(() => expandRecurrence(base({ interval: 0 }), { start: 0, end: DAY }), RangeError);
});
