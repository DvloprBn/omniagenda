import 'server-only';

// Solo para Server Components / Actions (corren DENTRO del contenedor
// omniagenda_frontend) — "localhost:3060" no resuelve ahi, solo existe
// fuera de Docker.
const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? 'http://omniagenda_backend:3000';

export type Health = {
  ok: boolean;
  service: string;
  phase: number;
  checks: { node: string; postgres: string; redis: string };
  time: string;
};

/**
 * Fase 0: el frontend confirma en vivo que el backend responde y que llega
 * de verdad a Postgres y a Redis. Sin cookies ni auth todavia (Fase 3).
 * Nunca lanza: devuelve `{ error }` para que la pagina lo pueda pintar.
 */
export async function getHealth(): Promise<Health | { error: string }> {
  try {
    const res = await fetch(`${INTERNAL_API_URL}/health`, { cache: 'no-store' });
    if (!res.ok) return { error: `El backend respondio ${res.status}` };
    return (await res.json()) as Health;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
