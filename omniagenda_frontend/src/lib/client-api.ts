'use client';

import { CLIENT_API_URL } from './client-api-url';

export class ClientApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Fetch desde el NAVEGADOR directo al backend (`credentials:'include'` —
 * las cookies httpOnly de sesion viajan y se guardan del lado del
 * navegador bajo el origen del backend; el CORS del backend ya las
 * autoriza para el origen del frontend, ver main.ts). Nunca usa
 * `INTERNAL_API_URL` (eso solo resuelve dentro del contenedor del
 * frontend, nunca desde el navegador del usuario).
 */
export async function clientFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CLIENT_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const message = (body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : undefined) ?? `Error ${res.status}`;
    throw new ClientApiError(res.status, message);
  }

  const text = await res.text();
  if (text === '') return undefined as T;
  return JSON.parse(text) as T;
}
