import Link from 'next/link';

export const metadata = {
  title: 'OmniAgenda',
  description: 'Motor de agenda y reservaciones — panel del negocio',
};

/**
 * FASE 5a — landing publica minima. El vertical elegido para la demo
 * (PLAN_DESARROLLO.md §11) es una estetica MULTISUCURSAL; esta pantalla no
 * es el producto — solo la puerta hacia el panel real (`/agenda`,
 * protegido). Sin datos en vivo aqui a proposito: es estatica y liviana.
 */
export default function HomePage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: 'linear-gradient(180deg, var(--brand-50), var(--paper) 60%)' }}
    >
      <div className="oa-anim-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--brand-600)' }}>
          OmniAgenda
        </p>
        <h1 className="mt-3 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--ink-900)' }}>
          Un calendario que no se pisa
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm" style={{ color: 'var(--ink-500)' }}>
          Reservas por sucursal, sin doble reserva posible — garantizado por la base de datos, no
          solo por la pantalla.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/login" className="oa-btn oa-btn-primary">
            Entrar al panel
          </Link>
          <Link href="/estado" className="oa-btn oa-btn-ghost">
            Estado del sistema
          </Link>
        </div>
      </div>
    </div>
  );
}
