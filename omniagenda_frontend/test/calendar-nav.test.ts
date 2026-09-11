import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startOfDayInZone,
  startOfWeekInZone,
  startOfMonthInZone,
  viewRange,
  addDays,
  addMonthsInZone,
  daysBetween,
  hourLabel,
  minutesSinceDayStart,
  parseDateInZone,
} from '../src/lib/calendar-nav';

const MX = 'America/Mexico_City'; // UTC-6 todo el año en las fechas usadas aquí

test('startOfDayInZone: medianoche local de Ciudad de México', () => {
  // 2026-06-15T15:30:00Z = 2026-06-15T09:30:00 en CDMX (UTC-6)
  const instant = new Date('2026-06-15T15:30:00.000Z');
  const start = startOfDayInZone(instant, MX);
  assert.equal(start.toISOString(), '2026-06-15T06:00:00.000Z'); // medianoche CDMX = 06:00 UTC
});

test('startOfWeekInZone: siempre cae en lunes', () => {
  // 2026-06-18 es jueves
  const thursday = new Date('2026-06-18T12:00:00.000Z');
  const monday = startOfWeekInZone(thursday, MX);
  assert.equal(monday.toISOString(), '2026-06-15T06:00:00.000Z');
});

test('startOfWeekInZone: un lunes se queda igual (medianoche)', () => {
  const alreadyMonday = new Date('2026-06-15T06:00:00.000Z');
  const monday = startOfWeekInZone(alreadyMonday, MX);
  assert.equal(monday.toISOString(), alreadyMonday.toISOString());
});

test('startOfMonthInZone: primer día del mes, medianoche local', () => {
  const midMonth = new Date('2026-06-18T12:00:00.000Z');
  const start = startOfMonthInZone(midMonth, MX);
  assert.equal(start.toISOString(), '2026-06-01T06:00:00.000Z');
});

test('viewRange día: exactamente 24h', () => {
  const { from, to } = viewRange('day', new Date('2026-06-18T12:00:00.000Z'), MX);
  assert.equal(to.getTime() - from.getTime(), 86_400_000);
});

test('viewRange semana: exactamente 7 días, empieza en lunes', () => {
  const { from, to } = viewRange('week', new Date('2026-06-18T12:00:00.000Z'), MX);
  assert.equal(to.getTime() - from.getTime(), 7 * 86_400_000);
  assert.equal(from.toISOString(), '2026-06-15T06:00:00.000Z');
});

test('viewRange mes: cubre semanas completas sin huecos (múltiplo de 7 días)', () => {
  const { from, to } = viewRange('month', new Date('2026-06-18T12:00:00.000Z'), MX);
  assert.equal(daysBetween(from, to) % 7, 0);
  // El 1 de junio 2026 (lunes) está dentro del rango.
  assert.ok(from.getTime() <= new Date('2026-06-01T06:00:00.000Z').getTime());
  assert.ok(to.getTime() > new Date('2026-06-30T06:00:00.000Z').getTime());
});

test('addDays / daysBetween son inversas', () => {
  const start = new Date('2026-06-01T00:00:00.000Z');
  const shifted = addDays(start, 10);
  assert.equal(daysBetween(start, shifted), 10);
});

test('minutesSinceDayStart: mediodía es 720 minutos después de medianoche', () => {
  const dayStart = new Date('2026-06-15T06:00:00.000Z'); // medianoche CDMX
  const noon = new Date('2026-06-15T18:00:00.000Z'); // mediodía CDMX
  assert.equal(minutesSinceDayStart(noon, dayStart), 720);
});

test('hourLabel: formato de 12 horas en español', () => {
  assert.equal(hourLabel(9), '9 a.m.');
  assert.equal(hourLabel(13), '1 p.m.');
  assert.equal(hourLabel(0), '12 a.m.');
});

test('parseDateInZone: "2026-09-11" en CDMX NUNCA resuelve a otro día (bug real: medianoche UTC caía en el día anterior)', () => {
  const parsed = parseDateInZone('2026-09-11', MX);
  assert.equal(parsed.toISOString(), '2026-09-11T06:00:00.000Z'); // medianoche CDMX del día 11, no del 10
});

test('parseDateInZone: fin de mes/año no se corre', () => {
  assert.equal(parseDateInZone('2026-12-31', MX).toISOString(), '2026-12-31T06:00:00.000Z');
  assert.equal(parseDateInZone('2026-01-01', MX).toISOString(), '2026-01-01T06:00:00.000Z');
});

test('addMonthsInZone: avanza y retrocede un mes preservando el día', () => {
  const start = parseDateInZone('2026-06-15', MX);
  assert.equal(addMonthsInZone(start, 1, MX).toISOString(), '2026-07-15T06:00:00.000Z');
  assert.equal(addMonthsInZone(start, -1, MX).toISOString(), '2026-05-15T06:00:00.000Z');
});

test('addMonthsInZone: cruza el año correctamente', () => {
  const dec = parseDateInZone('2026-12-15', MX);
  assert.equal(addMonthsInZone(dec, 1, MX).toISOString(), '2027-01-15T06:00:00.000Z');
});
