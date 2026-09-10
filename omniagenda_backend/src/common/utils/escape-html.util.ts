/**
 * Escapa los 5 caracteres que pueden inyectar HTML si un dato de texto
 * libre (ej. `users.name`) se interpola sin escapar en un correo HTML.
 * Leccion real ya aprendida en Dely Doggy (Bridge/LECCIONES_ARQUITECTURA).
 * Portado de OmniUser.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
