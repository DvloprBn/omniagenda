'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Calendar } from '@/lib/types';

/**
 * Selector de sucursal (= calendario) — el vertical elegido para la demo
 * es una estetica MULTISUCURSAL (PLAN_DESARROLLO.md §11), asi que cambiar
 * de sucursal sin recargar toda la app es el primer gesto real que
 * necesita la interfaz. El calendario activo vive en la URL (`?cal=`),
 * nunca solo en estado de React — asi un link a una sucursal concreta se
 * puede compartir/recargar.
 */
export function BranchSwitcher({ calendars }: { calendars: Calendar[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Los layouts de Next no reciben `searchParams` (persisten entre
  // navegaciones que solo cambian el query) — por eso el calendario activo
  // se lee AQUI, del lado del cliente, no se pasa desde el layout servidor.
  const activeId = params.get('cal') ?? calendars[0]?.calendar_id;

  function switchTo(calendarId: string) {
    const next = new URLSearchParams(params.toString());
    next.set('cal', calendarId);
    router.push(`${pathname}?${next.toString()}`);
  }

  if (calendars.length === 0) return null;

  return (
    <div className="flex gap-1 rounded-[var(--radius-md)] p-1" style={{ background: 'var(--ink-100)' }} role="tablist" aria-label="Sucursal">
      {calendars.map((cal) => {
        const active = cal.calendar_id === activeId;
        return (
          <button
            key={cal.calendar_id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => switchTo(cal.calendar_id)}
            className="rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              background: active ? 'var(--white)' : 'transparent',
              color: active ? 'var(--brand-700)' : 'var(--ink-500)',
              boxShadow: active ? 'var(--shadow-card)' : 'none',
            }}
          >
            {cal.name.replace(/^Demo — /, '').replace(/\s*\(ficticia\)$/, '')}
          </button>
        );
      })}
    </div>
  );
}
