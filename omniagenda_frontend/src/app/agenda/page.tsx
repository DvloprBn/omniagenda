import { serverFetch } from '@/lib/server-fetch';
import type { Booking, BusyBooking, Calendar } from '@/lib/types';
import { monthLabel, viewRange, weekdayLabel, type CalendarView } from '@/lib/calendar-nav';
import { ViewSwitcher } from '@/components/view-switcher';
import { DateNav } from '@/components/date-nav';
import { WeekView } from '@/components/week-view';

export const dynamic = 'force-dynamic';

const VALID_VIEWS: CalendarView[] = ['day', 'week', 'month', 'agenda', 'timeline'];

/**
 * FASE 5b — las 5 vistas reales de calendario, construidas una a la vez
 * sobre los cimientos de la Fase 5a (sesión, selector de sucursal, cliente
 * de API real). Orden de construcción (cada una verificada antes de la
 * siguiente): Semana primero — la más completa, fija el patrón de
 * arrastrar-y-soltar — luego Día, Mes, Agenda, Línea de tiempo.
 *
 * Vista y fecha viven en la URL (`?view=`, `?date=`), mismo criterio que
 * `?cal=` del selector de sucursal (Fase 5a): un enlace a "la semana del
 * 15 de junio en Sucursal Norte" se puede compartir o recargar tal cual.
 */
export default async function AgendaHomePage({
  searchParams,
}: {
  searchParams: Promise<{ cal?: string; view?: string; date?: string }>;
}) {
  const { cal, view: rawView, date: rawDate } = await searchParams;
  const calendars = await serverFetch<Calendar[]>('/calendars');
  const active = calendars.find((c) => c.calendar_id === cal) ?? calendars[0];

  if (!active) {
    return (
      <p className="oa-card p-6 text-sm" style={{ color: 'var(--ink-500)' }}>
        Todavía no hay ningún calendario. Se crea uno desde <code>POST /calendars</code>.
      </p>
    );
  }

  const view: CalendarView = VALID_VIEWS.includes(rawView as CalendarView) ? (rawView as CalendarView) : 'week';
  const anchorDate = rawDate && !Number.isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : new Date();
  const { from, to } = viewRange(view, anchorDate, active.timezone);
  const bookings = await serverFetch<(Booking | BusyBooking)[]>(
    `/calendars/${active.calendar_id}/bookings?from=${from.toISOString()}&to=${to.toISOString()}`,
  );

  return (
    <div className="space-y-6 oa-anim-fade">
      <section className="oa-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewSwitcher current={view} />
          <DateNav view={view} dateLabel={view === 'month' ? monthLabel(anchorDate, active.timezone) : `${weekdayLabel(from, active.timezone)} ${from.getDate()} – ${weekdayLabel(new Date(to.getTime() - 1), active.timezone)} ${new Date(to.getTime() - 1).getDate()}`} />
        </div>
      </section>

      {view === 'week' && <WeekView calendarId={active.calendar_id} weekStartIso={from.toISOString()} timeZone={active.timezone} bookings={bookings} />}

      {view === 'agenda' && <AgendaListView bookings={bookings} />}

      {(view === 'day' || view === 'month' || view === 'timeline') && (
        <section className="oa-card p-6">
          <p className="text-sm" style={{ color: 'var(--ink-500)' }}>
            La vista de {view === 'day' ? 'Día' : view === 'month' ? 'Mes' : 'Línea de tiempo'} es el
            siguiente incremento de la Fase 5b — todavía no está construida. Mientras tanto,{' '}
            <strong>{bookings.length}</strong> reserva(s) real(es) en esta ventana ({from.toLocaleDateString('es-MX')} –{' '}
            {to.toLocaleDateString('es-MX')}).
          </p>
        </section>
      )}
    </div>
  );
}

function AgendaListView({ bookings }: { bookings: (Booking | BusyBooking)[] }) {
  return (
    <section className="oa-card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-500)' }}>
        Próximos 14 días
      </h2>
      {bookings.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-500)' }}>Sin reservas en esta ventana.</p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'var(--ink-100)' }}>
          {bookings.map((b) => (
            <li key={b.booking_id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium" style={{ color: 'var(--ink-900)' }}>
                  {'title' in b && b.title ? b.title : `${b.resource_ids.length} recurso(s)`}
                </p>
                <p style={{ color: 'var(--ink-500)' }}>
                  {new Date(b.starts_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                  {' → '}
                  {new Date(b.ends_at).toLocaleTimeString('es-MX', { timeStyle: 'short' })}
                </p>
              </div>
              <StatusPill status={b.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone: Record<string, { bg: string; fg: string }> = {
    confirmada: { bg: 'var(--ok-50)', fg: 'var(--ok-600)' },
    pendiente: { bg: 'var(--warn-50)', fg: 'var(--warn-600)' },
    cancelada: { bg: 'var(--ink-100)', fg: 'var(--ink-500)' },
    rechazada: { bg: 'var(--bad-50)', fg: 'var(--bad-600)' },
  };
  const c = tone[status] ?? { bg: 'var(--ink-100)', fg: 'var(--ink-700)' };
  return (
    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: c.bg, color: c.fg }}>
      {status}
    </span>
  );
}
