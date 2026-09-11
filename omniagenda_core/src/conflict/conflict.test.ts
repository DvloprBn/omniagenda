import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateConflict, type ResourceBooking, type ConflictCandidate } from './conflict.js';
import { NON_BLOCKING_STATUSES, isBlockingStatus } from './status.js';

const H = 3_600_000;
const iv = (a: number, b: number) => ({ start: a * H, end: b * H });
const booking = (over: Partial<ResourceBooking>): ResourceBooking => ({
  bookingId: 'b1', resourceId: 'r1', calendarId: 'cal-1', interval: iv(10, 11), status: 'confirmada', blocking: true, ...over,
});
const candidate = (over: Partial<ConflictCandidate>): ConflictCandidate => ({
  resourceIds: ['r1'], calendarId: 'cal-1', interval: iv(10, 11), ...over,
});

test('status: los tres estados no-bloqueantes y su complemento', () => {
  assert.deepEqual([...NON_BLOCKING_STATUSES], ['cancelada', 'rechazada', 'expirada']);
  for (const s of NON_BLOCKING_STATUSES) assert.equal(isBlockingStatus(s), false);
  for (const s of ['confirmada', 'pendiente', 'completada', 'no_show']) assert.equal(isBlockingStatus(s), true);
});

test('agenda limpia -> ok, sin conflictos', () => {
  const r = evaluateConflict(candidate({ interval: iv(9, 10) }), [booking({ interval: iv(12, 13) })]);
  assert.deepEqual(r, { hard: [], soft: [], ok: true });
});

test('traslape con reserva que bloquea, mismo recurso -> conflicto DURO', () => {
  const r = evaluateConflict(candidate({ interval: iv(10.5, 11.5) }), [booking({})]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.hard.map((b) => b.bookingId), ['b1']);
});

test('traslape pero OTRO recurso -> se ignora', () => {
  const r = evaluateConflict(candidate({ resourceIds: ['r2'] }), [booking({ resourceId: 'r1' })]);
  assert.equal(r.ok, true);
});

test('traslape con reserva CANCELADA -> se ignora (estado no bloqueante)', () => {
  const r = evaluateConflict(candidate({}), [booking({ status: 'cancelada' })]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.soft, []);
});

test('traslape con bloque no-bloqueante (blocking:false) -> BLANDO, no duro', () => {
  const r = evaluateConflict(candidate({}), [booking({ blocking: false })]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.soft.map((b) => b.bookingId), ['b1']);
});

test('colchon general: vecino demasiado cerca -> BLANDO; vecino con margen -> ok', () => {
  const near = booking({ bookingId: 'near', interval: iv(11.25, 12) }); // 15 min despues
  const far = booking({ bookingId: 'far', interval: iv(11.75, 12) });    // 45 min despues
  const withNear = evaluateConflict(candidate({ bufferMinutes: 30 }), [near]);
  assert.equal(withNear.ok, true, 'el colchon general es BLANDO, nunca tumba ok');
  assert.deepEqual(withNear.soft.map((b) => b.bookingId), ['near']);
  const withFar = evaluateConflict(candidate({ bufferMinutes: 30 }), [far]);
  assert.deepEqual(withFar.soft, []);
});

test('colchon general NO se dispara contra un bloque no-bloqueante', () => {
  const tentative = booking({ bookingId: 't', interval: iv(11.25, 12), blocking: false });
  const r = evaluateConflict(candidate({ bufferMinutes: 30 }), [tentative]);
  assert.deepEqual(r.soft, []);
});

test('multi-recurso: uno de los recursos ocupado -> DURO', () => {
  const existing = [booking({ bookingId: 'x', resourceId: 'sala-2', interval: iv(10, 11) })];
  const r = evaluateConflict(candidate({ resourceIds: ['medico-1', 'sala-2'], interval: iv(10.5, 11.5) }), existing);
  assert.equal(r.ok, false);
  assert.deepEqual(r.hard.map((b) => b.resourceId), ['sala-2']);
});

test('ignoreBookingId: reprogramar no choca consigo misma', () => {
  const self = booking({ bookingId: 'self', interval: iv(10, 11) });
  const r = evaluateConflict(candidate({ interval: iv(10.5, 11.5), ignoreBookingId: 'self' }), [self]);
  assert.equal(r.ok, true);
});

test('no duplica la misma reserva en el reporte', () => {
  const b = booking({ bookingId: 'dup', interval: iv(10, 11) });
  const r = evaluateConflict(candidate({ interval: iv(10, 12), bufferMinutes: 30 }), [b, b]);
  assert.equal(r.hard.length, 1);
});

// ── Colchon ENTRE CALENDARIOS (sucursales) — el "colchon de traslado" de Espiral ──

test('crossCalendarBufferMinutes: vecino de OTRO calendario demasiado cerca -> DURO (imposibilidad fisica)', () => {
  const otraSucursal = booking({ bookingId: 'otra-suc', calendarId: 'cal-2', interval: iv(11.25, 12) }); // 15 min despues
  const r = evaluateConflict(candidate({ crossCalendarBufferMinutes: 30 }), [otraSucursal]);
  assert.equal(r.ok, false, 'no dio tiempo de cambiar de sucursal -> DURO, no blando');
  assert.deepEqual(r.hard.map((b) => b.bookingId), ['otra-suc']);
});

test('crossCalendarBufferMinutes: vecino de OTRO calendario con margen suficiente -> ok', () => {
  const otraSucursal = booking({ bookingId: 'otra-suc', calendarId: 'cal-2', interval: iv(11.75, 12) }); // 45 min despues
  const r = evaluateConflict(candidate({ crossCalendarBufferMinutes: 30 }), [otraSucursal]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.hard, []);
});

test('crossCalendarBufferMinutes: un vecino del MISMO calendario cerca NO dispara el colchon entre sucursales', () => {
  const mismaSucursal = booking({ bookingId: 'misma-suc', calendarId: 'cal-1', interval: iv(11.25, 12) });
  const r = evaluateConflict(candidate({ crossCalendarBufferMinutes: 30 }), [mismaSucursal]);
  assert.equal(r.ok, true, 'el colchon entre sucursales no aplica si el vecino es de la MISMA sucursal');
  assert.deepEqual(r.soft, []); // tampoco es colchon general: bufferMinutes no se paso
});

test('crossCalendarBufferMinutes NO se dispara contra un bloque no-bloqueante de otra sucursal', () => {
  const tentativeOtraSuc = booking({ bookingId: 't', calendarId: 'cal-2', interval: iv(11.25, 12), blocking: false });
  const r = evaluateConflict(candidate({ crossCalendarBufferMinutes: 30 }), [tentativeOtraSuc]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.hard, []);
  assert.deepEqual(r.soft, []);
});

test('ambos colchones a la vez: el de OTRO calendario manda (DURO) sobre el general (BLANDO) cuando ambos aplicarian', () => {
  const otraSucursal = booking({ bookingId: 'otra-suc', calendarId: 'cal-2', interval: iv(11.1, 12) }); // 6 min despues
  const r = evaluateConflict(candidate({ bufferMinutes: 10, crossCalendarBufferMinutes: 30 }), [otraSucursal]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.hard.map((b) => b.bookingId), ['otra-suc']);
  assert.deepEqual(r.soft, []); // no se reporta dos veces la misma reserva
});

test('crossCalendarBufferMinutes en 0 (default): un vecino de otra sucursal pegado no es ni duro ni blando', () => {
  const otraSucursal = booking({ bookingId: 'otra-suc', calendarId: 'cal-2', interval: iv(11, 12) }); // adyacente exacto
  const r = evaluateConflict(candidate({}), [otraSucursal]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.soft, []);
});
