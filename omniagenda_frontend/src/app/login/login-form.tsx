'use client';

import { useState } from 'react';
import { clientFetch, ClientApiError } from '@/lib/client-api';

type Stage = 'credentials' | 'twoFactor';

/**
 * Login real de 2 pantallas (correo+contrasena, luego el codigo de 2FA
 * SOLO si la cuenta lo tiene activo — la API decide, el formulario solo
 * reacciona). Tras exito, navegacion COMPLETA (`window.location`, no
 * `router.push`) — las cookies httpOnly las puso el backend en la
 * respuesta del fetch; una navegacion real es la forma mas simple y
 * robusta de que `proxy.ts` las vea en la siguiente peticion.
 */
export function LoginForm({ nextPath }: { nextPath: string }) {
  const [stage, setStage] = useState<Stage>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  function fail(message: string) {
    setError(message);
    setShakeKey((k) => k + 1);
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await clientFetch<{ requiresTwoFactor: boolean }>('/auth/login/step2', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (result.requiresTwoFactor) {
        setStage('twoFactor');
      } else {
        window.location.assign(nextPath);
      }
    } catch (err) {
      fail(err instanceof ClientApiError ? messageFor(err) : 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await clientFetch('/auth/login/2fa', { method: 'POST', body: JSON.stringify({ code }) });
      window.location.assign(nextPath);
    } catch (err) {
      fail(err instanceof ClientApiError ? messageFor(err) : 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="oa-card p-6">
      {stage === 'credentials' ? (
        <form onSubmit={submitCredentials} className="space-y-4" noValidate>
          <div>
            <label className="oa-field" htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="oa-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? 'true' : undefined}
            />
          </div>
          <div>
            <label className="oa-field" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              className="oa-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? 'true' : undefined}
            />
          </div>
          <ErrorBanner message={error} shakeKey={shakeKey} />
          <button type="submit" className="oa-btn oa-btn-primary w-full" disabled={loading}>
            {loading && <span className="oa-spinner" aria-hidden />}
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-4 oa-anim-fade" noValidate>
          <div>
            <p className="mb-3 text-sm" style={{ color: 'var(--ink-500)' }}>
              Ingresa el código de 6 dígitos de tu app de autenticación, o uno de tus códigos de recuperación.
            </p>
            <label className="oa-field" htmlFor="code">Código</label>
            <input
              id="code"
              type="text"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={20}
              className="oa-input text-center tracking-[0.3em]"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              aria-invalid={error ? 'true' : undefined}
            />
          </div>
          <ErrorBanner message={error} shakeKey={shakeKey} />
          <button type="submit" className="oa-btn oa-btn-primary w-full" disabled={loading}>
            {loading && <span className="oa-spinner" aria-hidden />}
            {loading ? 'Verificando…' : 'Confirmar código'}
          </button>
          <button
            type="button"
            className="oa-btn oa-btn-ghost w-full"
            onClick={() => { setStage('credentials'); setCode(''); setError(null); }}
          >
            Volver
          </button>
        </form>
      )}
    </div>
  );
}

function ErrorBanner({ message, shakeKey }: { message: string | null; shakeKey: number }) {
  if (!message) return null;
  // `key` cambia en cada intento fallido -> React remonta el nodo -> la
  // animacion de "shake" se re-dispara aunque el texto sea igual al anterior.
  return (
    <p key={shakeKey} className="oa-error oa-anim-shake" role="alert">
      {message}
    </p>
  );
}

function messageFor(err: ClientApiError): string {
  if (err.status === 429) return 'Demasiados intentos — espera un minuto antes de volver a intentar.';
  return err.message || 'Ocurrió un error inesperado.';
}
