import type { CSSProperties, HTMLAttributes } from 'react';
import type { Booking, BusyBooking } from '@/lib/types';

const STATUS_TONE: Record<string, { bg: string; fg: string; border: string }> = {
  confirmada: { bg: 'var(--brand-50)', fg: 'var(--brand-700)', border: 'var(--brand-200)' },
  pendiente: { bg: 'var(--warn-50)', fg: 'var(--warn-600)', border: '#fde68a' },
  cancelada: { bg: 'var(--ink-100)', fg: 'var(--ink-500)', border: 'var(--ink-300)' },
  rechazada: { bg: 'var(--bad-50)', fg: 'var(--bad-600)', border: '#fecaca' },
  completada: { bg: 'var(--ok-50)', fg: 'var(--ok-600)', border: '#bbf7d0' },
};

function toneFor(status: string) {
  return STATUS_TONE[status] ?? { bg: 'var(--ink-100)', fg: 'var(--ink-700)', border: 'var(--ink-300)' };
}

export function bookingTitle(b: Booking | BusyBooking): string {
  return 'title' in b && b.title ? b.title : `${b.resource_ids.length} recurso(s)`;
}

/**
 * Chip visual de una reserva — usado en Semana/Día (posicionado absoluto
 * dentro de la rejilla), Mes (una fila más) y Agenda (en línea).
 *
 * Recibe los manejadores de puntero/teclado como props normales (`rest`,
 * spread directo sobre el `div` raíz) en vez de que quien lo use lo
 * envuelva en OTRO `div`: como este componente es el único con
 * `position:absolute` y tamaño real dentro de la rejilla, un wrapper sin
 * posición/tamaño propio colapsaría a 0×0 y el foco de teclado (aunque
 * los punteros seguirían funcionando por *bubbling*) terminaría en un
 * elemento invisible. La lógica de arrastre sigue viviendo en quien lo usa
 * (`week-view`, etc.) — esto solo la recibe, nunca la decide.
 */
export function BookingBlock({
  booking,
  compact = false,
  style,
  className = '',
  dragging = false,
  ...interactive
}: {
  booking: Booking | BusyBooking;
  compact?: boolean;
  style?: CSSProperties;
  className?: string;
  dragging?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const tone = toneFor(booking.status);
  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);
  const timeLabel = `${start.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}–${end.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}`;

  return (
    <div
      className={`oa-booking-block ${className}`}
      style={{
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
        opacity: dragging ? 0.85 : 1,
        boxShadow: dragging ? 'var(--shadow-pop)' : undefined,
        cursor: dragging ? 'grabbing' : undefined,
        transition: dragging ? 'none' : undefined,
        zIndex: dragging ? 30 : undefined,
        ...style,
      }}
      {...interactive}
    >
      <p className="truncate text-xs font-semibold leading-tight">{bookingTitle(booking)}</p>
      {!compact && <p className="truncate text-[0.6875rem] leading-tight opacity-80">{timeLabel}</p>}
    </div>
  );
}
