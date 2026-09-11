'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { VIEWS, VIEW_LABELS, type CalendarView } from '@/lib/calendar-nav';

/**
 * Selector de vista de calendario (Fase 5b) — mismo criterio que
 * `BranchSwitcher`: la vista activa vive en la URL (`?view=`), nunca solo
 * en estado de React, para que un enlace a "la vista de semana de esta
 * sucursal" se pueda compartir o recargar.
 */
export function ViewSwitcher({ current }: { current: CalendarView }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function switchTo(view: CalendarView) {
    const next = new URLSearchParams(params.toString());
    next.set('view', view);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex gap-1 rounded-[var(--radius-md)] p-1" style={{ background: 'var(--ink-100)' }} role="tablist" aria-label="Vista de calendario">
      {VIEWS.map((view) => {
        const active = view === current;
        return (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => switchTo(view)}
            className="rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              background: active ? 'var(--white)' : 'transparent',
              color: active ? 'var(--brand-700)' : 'var(--ink-500)',
              boxShadow: active ? 'var(--shadow-card)' : 'none',
            }}
          >
            {VIEW_LABELS[view]}
          </button>
        );
      })}
    </div>
  );
}
