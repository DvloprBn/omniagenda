import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalize, union, subtract, intersect, freeWithin, totalDurationMs,
  expandEach, dropShorterThan,
} from './interval-set.js';

const H = 3_600_000;
const iv = (a: number, b: number) => ({ start: a * H, end: b * H });

test('normalize: ordena, descarta invalidos, fusiona traslape y adyacencia', () => {
  assert.deepEqual(normalize([iv(12, 13), iv(9, 10), iv(10, 11)]), [iv(9, 11), iv(12, 13)]);
  assert.deepEqual(normalize([iv(9, 12), iv(10, 11)]), [iv(9, 12)]);
  assert.deepEqual(normalize([iv(5, 5), iv(9, 10)]), [iv(9, 10)], 'el de duracion 0 se descarta');
});

test('union', () => {
  assert.deepEqual(union([iv(9, 11)], [iv(10, 13), iv(20, 21)]), [iv(9, 13), iv(20, 21)]);
});

test('subtract: sin traslape, borde, en medio (parte en dos), cobertura total', () => {
  assert.deepEqual(subtract([iv(9, 17)], [iv(20, 21)]), [iv(9, 17)]);
  assert.deepEqual(subtract([iv(9, 17)], [iv(8, 10)]), [iv(10, 17)]);
  assert.deepEqual(subtract([iv(9, 17)], [iv(16, 20)]), [iv(9, 16)]);
  assert.deepEqual(subtract([iv(9, 17)], [iv(12, 13)]), [iv(9, 12), iv(13, 17)]);
  assert.deepEqual(subtract([iv(9, 17)], [iv(8, 20)]), []);
  assert.deepEqual(subtract([iv(9, 17)], [iv(10, 11), iv(13, 14)]), [iv(9, 10), iv(11, 13), iv(14, 17)]);
});

test('intersect: solo lo que esta en ambos', () => {
  assert.deepEqual(intersect([iv(9, 17)], [iv(12, 20), iv(6, 10)]), [iv(9, 10), iv(12, 17)]);
  assert.deepEqual(intersect([iv(9, 10)], [iv(15, 16)]), []);
});

test('freeWithin: huecos libres dentro de una ventana', () => {
  assert.deepEqual(freeWithin(iv(9, 17), [iv(12, 13)]), [iv(9, 12), iv(13, 17)]);
  assert.deepEqual(freeWithin(iv(9, 17), []), [iv(9, 17)]);
});

test('totalDurationMs no cuenta el solape dos veces', () => {
  assert.equal(totalDurationMs([iv(9, 11), iv(10, 12)]), 3 * H);
});

test('expandEach aplica colchon y re-normaliza (puede fusionar)', () => {
  assert.deepEqual(expandEach([iv(9, 10), iv(11, 12)], 0.5 * H), [iv(8.5, 12.5)]);
});

test('dropShorterThan', () => {
  assert.deepEqual(dropShorterThan([iv(9, 9.25), iv(10, 12)], 0.5 * H), [iv(10, 12)]);
});
