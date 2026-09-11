import { serverFetch } from '@/lib/server-fetch';
import type { Booking, BusyBooking, Calendar } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * FASE 5a — cimientos: prueba que la sesion, el selector de sucursal y la
 * API de agenda (Fase 4) ya hablan entre si de verdad. Las 5 vistas reales
 * de calendario (dia/semana/mes/agenda/linea de tiempo) y arrastrar-y-
 * soltar son la FASE 5b — esta pantalla es la base sobre la que se
 * construyen, no el resultado final.
 */
export default async function AgendaHomePage({
  searchParams,
}: {
  searchParams: Promise<{ cal?: string }>;
}) {
  const { cal } = await searchParams;
  const calendars = await serverFetch<Calendar[]>('/calendars');
  const active = calendars.find((c) => c.calendar_id === cal) ?? calendars[0];

  if (!active) {
    return (
      <p className="oa-card p-6 text-sm" style={{ color: 'var(--ink-500)' }}>
        Todavía no hay ningún calendario. Se crea uno desde <code>POST /calendars</code>.
      </p>
    );
  }

  const from = new Date();
  const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  const bookings = await serverFetch<(Booking | BusyBooking)[]>(
    `/calendars/${active.calendar_id}/bookings?from=${from.toISOString()}&to=${to.toISOString()}`,
  );

  return (
    <div className="space-y-6 oa-anim-fade">
      <section className="oa-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-lg font-bold" style={{ color: 'var(--ink-900)' }}>
            {active.name}
          </h1>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: 'var(--brand-50)', color: 'var(--brand-700)' }}>
            {active.visibility}
          </span>
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-500)' }}>
          Zona horaria: {active.timezone}
        </p>
      </section>

      <section className="oa-card p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-500)' }}>
          Próximos 7 días
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

      <p className="text-xs" style={{ color: 'var(--ink-500)' }}>
        Esta lista es la base de la Fase 5a — la vista de calendario real (semana/mes/día/línea de
        tiempo, con arrastrar y soltar) es la Fase 5b.
      </p>
    </div>
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
