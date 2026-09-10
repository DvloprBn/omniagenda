import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidInterval, durationMs, overlaps, contains, containsInstant,
  intersection, gapMs, expand,
} from './interval.js';

const H = 3_600_000; // 1 hora en ms
const iv = (startH: number, endH: number) => ({ start: startH * H, end: endH * H });

test('isValidInterval: rango positivo ok, cero/negativo/infinito no', () => {
  assert.equal(isValidInterval(iv(9, 10)), true);
  assert.equal(isValidInterval(iv(10, 10)), false);
  assert.equal(isValidInterval(iv(10, 9)), false);
  assert.equal(isValidInterval({ start: 0, end: Infinity }), false);
});

test('durationMs lanza si el intervalo es invalido', () => {
  assert.equal(durationMs(iv(9, 11)), 2 * H);
  assert.throws(() => durationMs(iv(11, 9)), RangeError);
});

test('overlaps: adyacentes NO se traslapan (semiabierto)', () => {
  assert.equal(overlaps(iv(9, 10), iv(10, 11)), false, '10:00 pega con 10:00 pero no encima');
  assert.equal(overlaps(iv(9, 10.5), iv(10, 11)), true);
  assert.equal(overlaps(iv(9, 12), iv(10, 11)), true, 'contenido cuenta como traslape');
  assert.equal(overlaps(iv(9, 10), iv(11, 12)), false);
});

test('contains y containsInstant', () => {
  assert.equal(contains(iv(9, 17), iv(12, 13)), true);
  assert.equal(contains(iv(9, 17), iv(8, 13)), false);
  assert.equal(contains(iv(9, 17), iv(9, 17)), true, 'bordes incluidos');
  assert.equal(containsInstant(iv(9, 10), 9 * H), true);
  assert.equal(containsInstant(iv(9, 10), 10 * H), false, 'fin exclusivo');
});

test('intersection: parte comun o null', () => {
  assert.deepEqual(intersection(iv(9, 12), iv(11, 14)), iv(11, 12));
  assert.equal(intersection(iv(9, 10), iv(10, 11)), null, 'solo se tocan');
  assert.equal(intersection(iv(9, 10), iv(20, 21)), null);
});

test('gapMs: hueco positivo, 0 al tocar, negativo al encimar; orden no importa', () => {
  assert.equal(gapMs(iv(9, 10), iv(11, 12)), H);
  assert.equal(gapMs(iv(11, 12), iv(9, 10)), H);
  assert.equal(gapMs(iv(9, 10), iv(10, 11)), 0);
  assert.equal(gapMs(iv(9, 11), iv(10, 12)), -H);
});

test('expand: colchon en ambos extremos; contraer de mas colapsa a un punto', () => {
  assert.deepEqual(expand(iv(10, 11), 0.5 * H), iv(9.5, 11.5));
  const collapsed = expand(iv(10, 11), -1 * H);
  assert.equal(collapsed.start, collapsed.end, 'contraer 60min un rango de 60min -> punto');
  assert.equal(isValidInterval(collapsed), false);
});
