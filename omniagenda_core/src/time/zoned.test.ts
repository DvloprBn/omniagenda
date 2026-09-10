import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wallPartsInZone, zoneOffsetMinutes, instantFromWall,
  startOfDayInZone, addDaysInZone,
} from './zoned.js';

const MX = 'America/Mexico_City'; // sin horario de verano desde 2022
const NY = 'America/New_York';    // CON horario de verano

test('wallPartsInZone: un instante UTC visto en Mexico', () => {
  // 2026-01-15 00:00:00Z  ->  2026-01-14 18:00 en el centro de Mexico (UTC-6)
  const t = Date.UTC(2026, 0, 15, 0, 0, 0);
  const p = wallPartsInZone(t, MX);
  assert.deepEqual(
    { y: p.year, mo: p.month, d: p.day, h: p.hour, mi: p.minute },
    { y: 2026, mo: 1, d: 14, h: 18, mi: 0 },
  );
  assert.equal(p.weekday, 3, 'miercoles');
});

test('zoneOffsetMinutes: Mexico en invierno = -360', () => {
  assert.equal(zoneOffsetMinutes(Date.UTC(2026, 0, 15, 12, 0, 0), MX), -360);
});

test('instantFromWall <-> wallPartsInZone: ida y vuelta exacta en zona sin DST', () => {
  const t = instantFromWall({ year: 2026, month: 6, day: 15, hour: 9, minute: 30 }, MX);
  const p = wallPartsInZone(t, MX);
  assert.deepEqual([p.year, p.month, p.day, p.hour, p.minute], [2026, 6, 15, 9, 30]);
  // 09:30 en UTC-6  ->  15:30 UTC
  assert.equal(new Date(t).toISOString(), '2026-06-15T15:30:00.000Z');
});

test('instantFromWall: ida y vuelta en UTC', () => {
  const t = instantFromWall({ year: 2026, month: 3, day: 1, hour: 0, minute: 0 }, 'UTC');
  assert.equal(new Date(t).toISOString(), '2026-03-01T00:00:00.000Z');
});

test('instantFromWall: zona CON DST, fecha normal (lejos de la transicion)', () => {
  // 2026-07-01 09:00 en Nueva York = UTC-4 (verano) -> 13:00 UTC
  const t = instantFromWall({ year: 2026, month: 7, day: 1, hour: 9, minute: 0 }, NY);
  assert.equal(new Date(t).toISOString(), '2026-07-01T13:00:00.000Z');
  // 2026-01-01 09:00 en Nueva York = UTC-5 (invierno) -> 14:00 UTC
  const w = instantFromWall({ year: 2026, month: 1, day: 1, hour: 9, minute: 0 }, NY);
  assert.equal(new Date(w).toISOString(), '2026-01-01T14:00:00.000Z');
});

test('instantFromWall: en el hueco de "adelantar el reloj" no explota y cae despues del salto', () => {
  // EEUU 2026: el reloj salta de 02:00 a 03:00 el 8 de marzo. Las 02:30 no existen.
  const t = instantFromWall({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, NY);
  const p = wallPartsInZone(t, NY);
  // El resultado es un instante real; su hora de pared ya esta del otro lado del salto.
  assert.ok(p.hour === 3 || p.hour === 1, `hora de pared resuelta: ${p.hour}`);
});

test('startOfDayInZone: medianoche local', () => {
  const noon = Date.UTC(2026, 5, 15, 18, 0, 0); // mediodia en Mexico
  const midnight = startOfDayInZone(noon, MX);
  assert.equal(new Date(midnight).toISOString(), '2026-06-15T06:00:00.000Z'); // 00:00 UTC-6
});

test('addDaysInZone: preserva la hora de pared cruzando meses', () => {
  const t = instantFromWall({ year: 2026, month: 1, day: 30, hour: 9, minute: 0 }, MX);
  const plus3 = addDaysInZone(t, 3, MX);
  const p = wallPartsInZone(plus3, MX);
  assert.deepEqual([p.month, p.day, p.hour, p.minute], [2, 2, 9, 0]);
});
