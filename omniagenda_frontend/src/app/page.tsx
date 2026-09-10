import { getHealth } from '@/lib/api';

// Este proyecto casi siempre necesita datos vivos del backend en cada
// request (sesion, calendarios, disponibilidad). `force-dynamic` en el
// layout raiz seria lo normal a partir de la Fase 3; aqui, en una sola
// pagina, basta marcarla. Ver Bridge, leccion #11.
export const dynamic = 'force-dynamic';

function StatusPill({ value }: { value: string }) {
  const ok = value === 'ok';
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ' +
        (ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
      }
    >
      <span className={'size-1.5 rounded-full ' + (ok ? 'bg-green-600' : 'bg-red-600')} />
      {ok ? 'ok' : value}
    </span>
  );
}

export default async function HomePage() {
  const health = await getHealth();
  const failed = 'error' in health;

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-(--brand)">OmniAgenda</p>
      <h1 className="mt-1 text-2xl font-bold text-(--brand-dark)">Fase 0 — Infraestructura</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Esta pantalla existe solo para confirmar, en vivo y desde el navegador, que los cuatro
        servicios de <code className="rounded bg-neutral-200 px-1">docker-compose.yml</code> estan
        arriba y se hablan entre si. Se reemplaza en cuanto empiece la interfaz real (Fase 5).
      </p>

      <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        {failed ? (
          <div className="text-sm">
            <p className="font-medium text-red-700">El frontend no pudo hablar con el backend.</p>
            <p className="mt-1 text-neutral-600">{health.error}</p>
            <p className="mt-3 text-xs text-neutral-500">
              Revisa que <code>omniagenda_backend</code> haya arrancado sin errores en los logs de
              Docker.
            </p>
          </div>
        ) : (
          <dl className="divide-y divide-neutral-100 text-sm">
            <div className="flex items-center justify-between py-2">
              <dt className="text-neutral-600">Frontend (Next.js) &rarr; Backend (NestJS)</dt>
              <dd><StatusPill value={health.ok ? 'ok' : 'parcial'} /></dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-neutral-600">Backend &rarr; proceso Node</dt>
              <dd><StatusPill value={health.checks.node} /></dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-neutral-600">Backend &rarr; PostgreSQL (<code>SELECT 1</code>)</dt>
              <dd><StatusPill value={health.checks.postgres} /></dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-neutral-600">Backend &rarr; Redis (<code>PING</code>)</dt>
              <dd><StatusPill value={health.checks.redis} /></dd>
            </div>
            <div className="flex items-center justify-between py-2 text-xs text-neutral-500">
              <dt>Respuesta del backend</dt>
              <dd>{health.time}</dd>
            </div>
          </dl>
        )}
      </div>

      <p className="mt-6 text-xs text-neutral-500">
        Endpoint crudo: <code className="rounded bg-neutral-200 px-1">GET http://localhost:3060/health</code>
      </p>
    </div>
  );
}
