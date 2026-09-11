/**
 * Solo para Client Components — corren en el NAVEGADOR del usuario, asi
 * que hablan al backend por el puerto expuesto al host, nunca por el
 * nombre del servicio de docker-compose (eso no resuelve fuera de la red
 * interna). Ver docker-compose.yml (NEXT_PUBLIC_API_URL, resuelto en
 * tiempo de BUILD — Bridge, leccion #1).
 */
export const CLIENT_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3060';
