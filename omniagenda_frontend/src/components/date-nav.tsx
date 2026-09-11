'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { CalendarView } from '@/lib/calendar-nav';

const STEP_DAYS: Record<CalendarView, number> = {
  day: 1,
  week: 7,
  month: 30, // aproximado a propósito: "mes siguiente" se recalcula sobre la fecha real, no sobre 30 días exactos
  agenda: 14,
  timeline: 1,
};

/** Navegación de fecha (‹ Hoy ›) — la fecha activa vive en `?date=` (ISO, sin hora). */
export function DateNav({ view, dateLabel }: { view: CalendarView; dateLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const currentIso = params.get('date');
  const current = currentIso ? new Date(currentIso) : new Date();

  function go(days: number | 'today') {
    const next = new URLSearchParams(params.toString());
    if (days === 'today') {
      next.delete('date');
    } else {
      const shifted = new Date(current);
      if (view === 'month') {
        shifted.setMonth(shifted.getMonth() + (days > 0 ? 1 : -1));
      } else {
        shifted.setDate(shifted.getDate() + days);
      }
      next.set('date', shifted.toISOString().slice(0, 10));
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  const step = STEP_DAYS[view];

  return (
    <div className="flex items-center gap-2">
      <button type="button" className="oa-btn oa-btn-ghost px-2.5 py-1.5" aria-label="Anterior" onClick={() => go(-step)}>
        ‹
      </button>
      <button type="button" className="oa-btn oa-btn-ghost px-3 py-1.5 text-sm" onClick={() => go('today')}>
        Hoy
      </button>
      <button type="button" className="oa-btn oa-btn-ghost px-2.5 py-1.5" aria-label="Siguiente" onClick={() => go(step)}>
        ›
      </button>
      <span className="ml-1 text-sm font-semibold capitalize" style={{ color: 'var(--ink-900)' }}>
        {dateLabel}
      </span>
    </div>
  );
}
