'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Booking, BusyBooking } from '@/lib/types';
import { addDays, dayNumberLabel, hourLabel, minutesSinceDayStart, startOfDayInZone, weekdayLabel } from '@/lib/calendar-nav';
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  GRID_TOTAL_MINUTES,
  clampToGrid,
  durationToHeightPx,
  minutesToTopPx,
  pxDeltaToColumnShift,
  pxDeltaToSnappedMinutes,
} from '@/lib/grid-math';
import { BookingBlock, bookingTitle } from '@/components/booking-block';
import { clientFetch, ClientApiError } from '@/lib/client-api';

const PX_PER_MINUTE = 1.2; // 72px/hora — suficiente para leer el título de una cita de 30-60 min
const GRID_HEIGHT = GRID_TOTAL_MINUTES * PX_PER_MINUTE;
const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i);
const KEYBOARD_STEP_MINUTES = 15;

type AnyBooking = Booking | BusyBooking;

function isEditable(b: AnyBooking): b is Booking {
  return 'title' in b;
}

/**
 * Vista de Semana (Fase 5b) — la vista ancla que fija el patrón de
 * arrastrar-y-soltar para las demás. Arrastre con Pointer Events escritos
 * desde cero (nunca el HTML5 Drag&Drop nativo ni una librería — cero
 * "sensación física" con el nativo, y PLAN_DESARROLLO.md §9 prohíbe
 * librerías de animación/DnD de terceros): mover un bloque aplica
 * `transform: translate()` en tiempo real; al soltar, `PATCH
 * /calendars/:id/bookings/:id` con el horario nuevo. Si el backend
 * responde con un conflicto real (409) o sin permiso (403), el bloque
 * REGRESA a su lugar con la animación `oa-shake` — el backend sigue
 * siendo la única fuente de verdad, esto nunca "decide" que un horario es
 * válido por su cuenta.
 *
 * Alternativa real de teclado (WCAG 2.1, no decorativa): con el bloque
 * enfocado, las flechas mueven la reserva por el mismo camino (optimista
 * + PATCH + revertir si falla) — nunca queda como la única forma de
 * arrastrar la vista sea con mouse/touch.
 */
export function WeekView({
  calendarId,
  weekStartIso,
  timeZone,
  bookings: initialBookings,
}: {
  calendarId: string;
  weekStartIso: string;
  timeZone: string;
  bookings: AnyBooking[];
}) {
  const router = useRouter();
  const weekStart = new Date(weekStartIso);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayStarts = days.map((d) => startOfDayInZone(d, timeZone));

  const [bookings, setBookings] = useState(initialBookings);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    bookingId: string;
    pointerId: number;
    startX: number;
    startY: number;
    columnWidth: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);

  function dayIndexOf(instant: Date): number {
    const day = startOfDayInZone(instant, timeZone);
    return dayStarts.findIndex((d) => d.getTime() === day.getTime());
  }

  async function commitMove(bookingId: string, newStart: Date, newEnd: Date, previous: AnyBooking) {
    // Optimista: se ve el movimiento de inmediato, el backend confirma o lo rechaza después.
    setBookings((prev) => prev.map((b) => (b.booking_id === bookingId ? { ...b, starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() } : b)));
    try {
      const updated = await clientFetch<Booking>(`/calendars/${calendarId}/bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() }),
      });
      setBookings((prev) => prev.map((b) => (b.booking_id === bookingId ? updated : b)));
      router.refresh(); // re-sincroniza con el servidor (ej. si algo más también cambió)
    } catch (e) {
      // Revertir: el backend es la única fuente de verdad de si un horario es válido.
      setBookings((prev) => prev.map((b) => (b.booking_id === bookingId ? previous : b)));
      setShakeId(bookingId);
      setErrorMsg(e instanceof ClientApiError ? e.message : 'No se pudo mover la reserva.');
      setTimeout(() => setShakeId(null), 450);
      setTimeout(() => setErrorMsg(null), 4000);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, booking: Booking) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const grid = gridRef.current;
    if (!grid) return;
    const columnWidth = grid.getBoundingClientRect().width / 7;
    dragStateRef.current = {
      bookingId: booking.booking_id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      columnWidth,
      originalStart: new Date(booking.starts_at),
      originalEnd: new Date(booking.ends_at),
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingId(booking.booking_id);
    setDragDelta({ x: 0, y: 0 });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDragDelta({ x: e.clientX - drag.startX, y: e.clientY - drag.startY });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>, booking: AnyBooking) {
    const drag = dragStateRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragStateRef.current = null;
    setDraggingId(null);

    const columnShift = pxDeltaToColumnShift(dragDelta.x, drag.columnWidth);
    const minutesShift = pxDeltaToSnappedMinutes(dragDelta.y, PX_PER_MINUTE);
    setDragDelta({ x: 0, y: 0 });

    if (columnShift === 0 && minutesShift === 0) return; // clic sin arrastre real: no hace nada

    const durationMs = drag.originalEnd.getTime() - drag.originalStart.getTime();
    const newStart = new Date(drag.originalStart.getTime() + columnShift * 86_400_000 + minutesShift * 60_000);
    const newEnd = new Date(newStart.getTime() + durationMs);
    commitMove(booking.booking_id, newStart, newEnd, booking);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>, booking: Booking) {
    let deltaDays = 0;
    let deltaMinutes = 0;
    if (e.key === 'ArrowUp') deltaMinutes = -KEYBOARD_STEP_MINUTES;
    else if (e.key === 'ArrowDown') deltaMinutes = KEYBOARD_STEP_MINUTES;
    else if (e.key === 'ArrowLeft') deltaDays = -1;
    else if (e.key === 'ArrowRight') deltaDays = 1;
    else return;
    e.preventDefault();

    const start = new Date(booking.starts_at);
    const end = new Date(booking.ends_at);
    const durationMs = end.getTime() - start.getTime();
    const newStart = new Date(start.getTime() + deltaDays * 86_400_000 + deltaMinutes * 60_000);
    const newEnd = new Date(newStart.getTime() + durationMs);
    commitMove(booking.booking_id, newStart, newEnd, booking);
  }

  return (
    <div className="oa-card overflow-hidden">
      {errorMsg && (
        <div className="oa-error m-3 rounded-md" role="alert">
          {errorMsg}
        </div>
      )}
      {/* Encabezado de días */}
      <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b" style={{ borderColor: 'var(--ink-100)' }}>
        <div />
        {days.map((d, i) => (
          <div key={i} className="border-l px-2 py-2 text-center" style={{ borderColor: 'var(--ink-100)' }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ink-500)' }}>
              {weekdayLabel(d, timeZone)}
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink-900)' }}>
              {dayNumberLabel(d, timeZone)}
            </p>
          </div>
        ))}
      </div>

      {/* Cuerpo: gutter de horas + 7 columnas */}
      <div className="grid grid-cols-[3.5rem_repeat(7,1fr)]" style={{ height: GRID_HEIGHT }} ref={gridRef}>
        <div className="relative">
          {HOURS.map((h) => (
            <div key={h} className="oa-grid-row absolute w-full pr-1.5 text-right text-[0.6875rem]" style={{ top: minutesToTopPx(h * 60, PX_PER_MINUTE), color: 'var(--ink-500)' }}>
              {hourLabel(h)}
            </div>
          ))}
        </div>

        {days.map((_, dayIndex) => {
          const dayStart = dayStarts[dayIndex];
          const dayBookings = bookings.filter((b) => dayIndexOf(new Date(b.starts_at)) === dayIndex);
          return (
            <div key={dayIndex} className="oa-grid-col relative" style={{ borderColor: 'var(--ink-100)' }}>
              {HOURS.map((h) => (
                <div key={h} className="oa-grid-row absolute w-full" style={{ top: minutesToTopPx(h * 60, PX_PER_MINUTE) }} />
              ))}
              {dayBookings.map((booking) => {
                const start = new Date(booking.starts_at);
                const end = new Date(booking.ends_at);
                const startMin = clampToGrid(minutesSinceDayStart(start, dayStart));
                const endMin = clampToGrid(minutesSinceDayStart(end, dayStart));
                const isDragging = draggingId === booking.booking_id;
                const editableBooking = isEditable(booking) ? booking : null;
                const transform = isDragging ? `translate(${dragDelta.x}px, ${dragDelta.y}px)` : undefined;

                return (
                  <BookingBlock
                    key={booking.booking_id}
                    booking={booking}
                    dragging={isDragging}
                    className={shakeId === booking.booking_id ? 'oa-anim-shake' : ''}
                    style={{
                      top: minutesToTopPx(startMin, PX_PER_MINUTE),
                      height: Math.max(durationToHeightPx(endMin - startMin, PX_PER_MINUTE), 18),
                      transform,
                      cursor: editableBooking ? undefined : 'default',
                    }}
                    role={editableBooking ? 'button' : undefined}
                    tabIndex={editableBooking ? 0 : undefined}
                    aria-label={editableBooking ? `${bookingTitle(booking)}. Usa las flechas para mover esta reserva.` : undefined}
                    onPointerDown={editableBooking ? (e) => handlePointerDown(e, editableBooking) : undefined}
                    onPointerMove={editableBooking ? handlePointerMove : undefined}
                    onPointerUp={editableBooking ? (e) => handlePointerUp(e, editableBooking) : undefined}
                    onKeyDown={editableBooking ? (e) => handleKeyDown(e, editableBooking) : undefined}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
