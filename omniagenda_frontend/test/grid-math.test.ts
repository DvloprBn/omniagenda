import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID_START_HOUR,
  GRID_END_HOUR,
  snapMinutes,
  minutesToTopPx,
  durationToHeightPx,
  clampToGrid,
  pxDeltaToSnappedMinutes,
  pxDeltaToColumnShift,
} from '../src/lib/grid-math';

test('snapMinutes redondea al escalón más cercano', () => {
  assert.equal(snapMinutes(7, 15), 0);
  assert.equal(snapMinutes(8, 15), 15);
  assert.equal(snapMinutes(22, 15), 15);
  assert.equal(snapMinutes(23, 15), 30);
});

test('minutesToTopPx: la hora de inicio de la rejilla queda en 0', () => {
  const pxPerMinute = 2;
  assert.equal(minutesToTopPx(GRID_START_HOUR * 60, pxPerMinute), 0);
  assert.equal(minutesToTopPx(GRID_START_HOUR * 60 + 60, pxPerMinute), 120); // 1h despues = 60*2px
});

test('durationToHeightPx escala linealmente', () => {
  assert.equal(durationToHeightPx(30, 2), 60);
  assert.equal(durationToHeightPx(60, 2), 120);
});

test('clampToGrid recorta a la ventana visible (las 24h reales)', () => {
  assert.equal(clampToGrid(-30), GRID_START_HOUR * 60); // antes de medianoche -> el borde de arriba
  assert.equal(clampToGrid(GRID_END_HOUR * 60 + 30), GRID_END_HOUR * 60); // despues de medianoche -> el borde de abajo
  assert.equal(clampToGrid(10 * 60), 10 * 60); // dentro de la ventana: sin cambio
});

test('pxDeltaToSnappedMinutes convierte y redondea', () => {
  const pxPerMinute = 2;
  assert.equal(pxDeltaToSnappedMinutes(30, pxPerMinute), 15); // 30px / 2 = 15min, ya alineado
  assert.equal(pxDeltaToSnappedMinutes(-30, pxPerMinute), -15);
  assert.equal(pxDeltaToSnappedMinutes(29, pxPerMinute), 15); // 14.5min -> redondea a 15
});

test('pxDeltaToColumnShift redondea a la columna más cercana', () => {
  const columnWidth = 150;
  assert.equal(pxDeltaToColumnShift(0, columnWidth), 0);
  assert.equal(pxDeltaToColumnShift(149, columnWidth), 1);
  assert.equal(pxDeltaToColumnShift(-160, columnWidth), -1);
  assert.equal(pxDeltaToColumnShift(300, columnWidth), 2);
});
