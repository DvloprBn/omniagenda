import { LoginForm } from './login-form';

export const metadata = {
  title: 'Iniciar sesión — OmniAgenda',
};

/**
 * Server Component minimo — el formulario real (con estado, envio y
 * animacion) vive en el Client Component `login-form.tsx`. `searchParams`
 * es una Promise en Next 16 (cambio de ruptura respecto a versiones
 * previas — AGENTS.md).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, var(--brand-50), var(--paper) 55%)' }}>
      <div className="w-full max-w-sm oa-anim-rise">
        <p className="mb-1 text-center text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--brand-600)' }}>
          OmniAgenda
        </p>
        <h1 className="mb-6 text-center text-xl font-bold" style={{ color: 'var(--ink-900)' }}>
          Panel del negocio
        </h1>
        <LoginForm nextPath={next && next.startsWith('/') ? next : '/agenda'} />
      </div>
    </div>
  );
}
