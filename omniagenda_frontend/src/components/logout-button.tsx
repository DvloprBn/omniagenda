'use client';

import { useState } from 'react';
import { clientFetch } from '@/lib/client-api';

/** Cierra la sesion real (revoca el refresh token en el backend) y navega a /login con una recarga completa. */
export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await clientFetch('/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <button type="button" className="oa-btn oa-btn-ghost" onClick={handleLogout} disabled={loading}>
      {loading ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}
