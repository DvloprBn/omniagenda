#!/usr/bin/env node
/**
 * Verifica que el `WHERE` de la restriccion `no_overlapping_resource_bookings`
 * (en la migracion SQL) y `NON_BLOCKING_STATUSES` (en @omniagenda/core)
 * sigan diciendo EXACTAMENTE lo mismo.
 *
 * Ese desfase es el origen de una vulnerabilidad real de Espiral
 * (2026-09-03): el pre-chequeo de la app y la garantia del motor se
 * desincronizaron y una cita "rechazada" bloqueaba su horario para
 * siempre desde un endpoint anonimo. Ver PLAN_DESARROLLO.md §3 y §4.2.
 *
 * Sin dependencias, sin Docker, sin base de datos — solo lee dos archivos.
 *   node omniagenda_backend/prisma/checks/status-sync.mjs
 * Sale con codigo != 0 si no coinciden (apto para CI / pre-commit).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..'); // .../Planner

// --- 1. La lista que dice el codigo del nucleo -------------------------------
const statusTs = readFileSync(
  join(repo, 'omniagenda_core', 'src', 'conflict', 'status.ts'),
  'utf8',
);
const coreMatch = statusTs.match(/NON_BLOCKING_STATUSES\s*=\s*\[([^\]]*)\]/);
if (!coreMatch) fail('No se encontro NON_BLOCKING_STATUSES en omniagenda_core/src/conflict/status.ts');
const coreList = [...coreMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

// --- 2. La lista que dice la migracion SQL ----------------------------------
const migrationsDir = join(repo, 'omniagenda_backend', 'prisma', 'migrations');
const sqlFiles = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(migrationsDir, d.name, 'migration.sql'));

let excludeWhere = null;
for (const f of sqlFiles) {
  const sql = readFileSync(f, 'utf8');
  const m = sql.match(/no_overlapping_resource_bookings[\s\S]*?WHERE\s*\(([\s\S]*?)\);/i);
  if (m) excludeWhere = { file: f, clause: m[1] };
}
if (!excludeWhere) fail('No se encontro la restriccion no_overlapping_resource_bookings en ninguna migracion');

const sqlMatch = excludeWhere.clause.match(/status\s+NOT\s+IN\s*\(([^)]*)\)/i);
if (!sqlMatch) fail(`El WHERE de la restriccion no tiene "status NOT IN (...)":\n  ${excludeWhere.clause.trim()}`);
const sqlList = [...sqlMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

// --- 3. Comparar (como conjunto Y como secuencia) --------------------------
const same =
  coreList.length === sqlList.length && coreList.every((s, i) => s === sqlList[i]);

console.log('  @omniagenda/core  NON_BLOCKING_STATUSES :', JSON.stringify(coreList));
console.log('  migracion SQL     status NOT IN         :', JSON.stringify(sqlList));

if (!same) {
  fail('Las dos listas NO coinciden — el pre-chequeo de la app y la garantia de la base estan desincronizados.');
}
console.log('\nPASS: la migracion y @omniagenda/core dicen lo mismo.');

function fail(msg) {
  console.error('\nFAIL:', msg);
  process.exit(1);
}
