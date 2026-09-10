// Prisma 7: la URL de conexion y las rutas de schema/migraciones viven
// aqui, ya no en schema.prisma. El .env real vive un nivel arriba (junto a
// docker-compose.yml); "dotenv/config" por si solo solo mira el directorio
// actual, por eso se apunta con path explicito.
import { config } from 'dotenv';
config({ path: '../.env' });

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // seed: se agrega en la Fase 2, cuando exista prisma/seed.ts.
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
