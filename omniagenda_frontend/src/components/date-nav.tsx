'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { addDays, addMonthsInZone, parseDateInZone, type CalendarView } from '@/lib/calendar-nav';

const STEP_DAYS: Record<CalendarView, number> = {
  day: 1,
  week: 7,
  month: 1, // se interpreta como "±1 mes" (addMonthsInZone), no como días
  agenda: 14,
  timeline: 1,
};

/**
 * Navegación de fecha (‹ Hoy ›) — la fecha activa vive en `?date=`
 * (YYYY-MM-DD, sin hora). SIEMPRE se lee/escribe con las funciones de
 * `calendar-nav.ts` conscientes de zona (`parseDateInZone`/`addDays`/
 * `addMonthsInZone`), nunca con `new Date(iso)` + `.setDate()` a secas:
 * eso mezcla parseo UTC con mutación en la zona LOCAL DEL NAVEGADOR,
 * pudiendo aterrizar un día distinto al que el calendario espera si el
 * navegador está en una zona horaria distinta a la del negocio.
 */
export function DateNav({ view, dateLabel, timeZone }: { view: CalendarView; dateLabel: string; timeZone: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const currentIso = params.get('date');
  const current = currentIso ? parseDateInZone(currentIso, timeZone) : new Date();

  function go(direction: -1 | 1 | 'today') {
    const next = new URLSearchParams(params.toString());
    if (direction === 'today') {
      next.delete('date');
    } else {
      const shifted = view === 'month' ? addMonthsInZone(current, direction, timeZone) : addDays(current, direction * STEP_DAYS[view]);
      next.set('date', shifted.toISOString().slice(0, 10));
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" className="oa-btn oa-btn-ghost px-2.5 py-1.5" aria-label="Anterior" onClick={() => go(-1)}>
        ‹
      </button>
      <button type="button" className="oa-btn oa-btn-ghost px-3 py-1.5 text-sm" onClick={() => go('today')}>
        Hoy
      </button>
      <button type="button" className="oa-btn oa-btn-ghost px-2.5 py-1.5" aria-label="Siguiente" onClick={() => go(1)}>
        ›
      </button>
      <span className="ml-1 text-sm font-semibold capitalize" style={{ color: 'var(--ink-900)' }}>
        {dateLabel}
      </span>
    </div>
  );
}
