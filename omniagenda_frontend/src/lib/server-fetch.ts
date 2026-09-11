import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Solo para Server Components/Actions (corren DENTRO del contenedor
// omniagenda_frontend) — "localhost:3060" no resuelve ahi, solo existe
// fuera de Docker (ver docker-compose.yml).
const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? 'http://omniagenda_backend:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

/**
 * DAL minimo real para Server Components: reenvia las cookies httpOnly de
 * sesion (el `fetch` del servidor de Next NO tiene acceso automatico a las
 * cookies del navegador — hay que leerlas de la peticion entrante y
 * adjuntarlas a mano) y trata un 401 del backend como la senal de
 * autoridad real de "no hay sesion valida" — el backend es la UNICA
 * fuente de verdad de autenticacion, Next nunca duplica ese estado.
 *
 * @param onUnauthorized Que hacer ante un 401. 'redirect' (default) manda
 *   a /login; 'throw' deja que el caller decida (util en /estado, que
 *   quiere mostrar el error, no redirigir).
 */
export async function serverFetch<T>(
  path: string,
  init?: RequestInit & { onUnauthorized?: 'redirect' | 'throw' },
): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const res = await fetch(`${INTERNAL_API_URL}${path}`, {
    ...init,
    headers: {
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (res.status === 401 && (init?.onUnauthorized ?? 'redirect') === 'redirect') {
    redirect('/login');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const message = (body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : undefined) ?? `Error ${res.status}`;
    throw new ApiError(res.status, message, body);
  }

  const text = await res.text();
  if (text === '') return undefined as T;
  return JSON.parse(text) as T;
}
