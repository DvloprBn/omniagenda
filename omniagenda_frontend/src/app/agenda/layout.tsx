import { Suspense } from 'react';
import { serverFetch } from '@/lib/server-fetch';
import type { AuthUser, Calendar } from '@/lib/types';
import { LogoutButton } from '@/components/logout-button';
import { BranchSwitcher } from '@/components/branch-switcher';

// Esta seccion siempre depende de la sesion (cookies) y de datos en vivo
// del backend — nunca tiene sentido pre-renderizarla estatica. Bridge,
// leccion #11: sin esto, `next build` se cuelga intentando generar esta
// ruta contra un backend que no esta disponible en tiempo de build.
export const dynamic = 'force-dynamic';

export default async function AgendaLayout({ children }: { children: React.ReactNode }) {
  const [me, calendars] = await Promise.all([
    serverFetch<AuthUser>('/auth/me'),
    serverFetch<Calendar[]>('/calendars'),
  ]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      <header className="border-b" style={{ borderColor: 'var(--ink-100)', background: 'var(--white)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--brand-700)' }}>
              OmniAgenda
            </span>
            <Suspense fallback={null}>
              <BranchSwitcher calendars={calendars} />
            </Suspense>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'var(--ink-500)' }}>
              {me.name ?? me.email} <span className="opacity-60">· {me.role}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
