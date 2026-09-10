# Estado del proyecto — OmniAgenda

> Bitácora día a día. Se actualiza cada vez que se pide o al cerrar un hito. La estrategia y las
> decisiones que no cambian seguido viven en [`PLAN_DESARROLLO.md`](./PLAN_DESARROLLO.md).
>
> **Nota de origen (2026-09-10):** este proyecto arranca leyendo `projects/espiral/`,
> `projects/delyDoggy/`, `dvlopmnt/login/` y `dvlopmnt/gallery/`, que conservan intacta su propia
> documentación como referencia. Se reutilizan sus **patrones probados**, nunca sus decisiones de
> negocio. Este archivo arranca **vacío a propósito**: es la bitácora de este proyecto y de
> ningún otro.
>
> **Antes de repetir un error ya conocido:** [`../../DocumentacionProyecto/Bridge/`](../../DocumentacionProyecto/Bridge/).

Última actualización: **2026-09-10** (Fase 2 completa — schema + `EXCLUDE` verificado en vivo)

---

## 1. Dónde estamos

**Fases 0, 1 y 2 completas y verificadas.** El stack de 4 servicios levanta y se comunica; el
núcleo `omniagenda_core` tiene la lógica pura probada (57 pruebas); y la base de datos ya tiene
los 6 modelos del motor con la **garantía real contra doble-reserva** (`EXCLUDE USING gist`)
aplicada y comprobada contra PostgreSQL en vivo.

Estructura real en disco:

| Carpeta / archivo | Estado |
|---|---|
| `docker-compose.yml` | ✅ 4 servicios (db 5439 · redis 6384 · backend 3060 · frontend 3061), Postgres/Redis solo `127.0.0.1`, `no-new-privileges`, healthchecks. `command` del backend: `prisma generate && migrate deploy && db seed && start:dev` |
| `.env.example` / `.env` | ✅ `.env` local con contraseñas de prueba (gitignored) |
| `omniagenda_core/` | ✅ **Fase 1** — paquete `@omniagenda/core` 0.1.0. `time/` · `recurrence/` · `conflict/` · `availability/`. 57 pruebas `node:test` + `tsx`, `tsc` limpio, `dist/` compila |
| `omniagenda_backend/prisma/` | ✅ **Fase 2** — `schema.prisma` con 6 modelos; migración `20260910211526_init` con bloque SQL **a mano** (`btree_gist`, 3 `CHECK`, el `EXCLUDE`); `seed.ts` idempotente (datos de demo ficticios); `checks/double_booking.sql` + `checks/status-sync.mjs` |
| `omniagenda_backend/src/` | ✅ NestJS 11, `main.ts` (helmet + CORS + ValidationPipe), `PrismaService`/`RedisService`, `/health` toca Postgres y Redis. **No importa `omniagenda_core` aún** — se cablea en Fase 4 (la API) |
| `omniagenda_frontend/` | ✅ Next.js 16.3.1 + React 19.2.4 + Tailwind 4, cabeceras de seguridad, página de estado que consulta `/health` |

**Modelo de datos (Fase 2):** `resources` (persona/sala/equipo/… — ciego al negocio) · `calendars`
(con `timezone` IANA y `visibility`) · `schedule_rules` (horario semanal JSON + recurrencia
opcional, uno por par recurso-calendario) · `time_off` (rango de días, `CHECK start<=end`) ·
`bookings` (fuente de verdad del horario + `source_type`/`source_id`, el puente al anfitrión) ·
`booking_resources` (el espejo por recurso donde vive el `EXCLUDE`).

**Verificación Fase 2 (2026-09-10), reinicio limpio (`down -v` → `up`):**
- `prisma generate` → `migrate deploy` (aplica `init`) → `db seed` → `nest start` con **0 errores**.
- Semilla: 1 calendario, 3 recursos, 3 horarios, 1 reserva, 2 `booking_resources`.
- `pg_constraint`: `no_overlapping_resource_bookings` (x) + 3 `CHECK` presentes; extensión
  `btree_gist` instalada.
- `checks/double_booking.sql` contra el Postgres en vivo → **6/6 PASS** (traslape rechazado,
  adyacentes permitidas, `cancelada`/`blocking=false`/otro-recurso ignorados, `CHECK` de orden).
- `checks/status-sync.mjs` → **PASS** (el `WHERE` de la migración == `NON_BLOCKING_STATUSES`).
- `/health` `ok:true`, frontend `200`. `docker compose down` conserva volúmenes.

**Verificación real (no "arrancó"), 2026-09-10:**
- `docker compose config` válido.
- 4 contenedores arriba; `omniagenda_db` y `omniagenda_redis` en estado `healthy`.
- Backend: `nest build` → **0 errores**, Nest arranca limpio, ruta `GET /health` mapeada.
- `GET http://localhost:3060/health` → `{"ok":true,"checks":{"node":"ok","postgres":"ok","redis":"ok"}}`
  — el backend tocó Postgres de verdad (`SELECT 1`) y Redis de verdad (`PING`).
- `GET http://localhost:3061/` → `200`; el Server Component de Next resolvió el `fetch` al
  backend por la red interna de Docker y pintó las 4 filas de estado en `ok`.
- Logs de los 4 servicios sin errores propios (solo los avisos estándar de las imágenes
  Alpine de Postgres/Redis — locale, overcommit — idénticos en los proyectos hermanos).
- `docker compose down` deja los volúmenes: el próximo `up` reusa los datos.

**Lo que NO existe todavía (a propósito, por fase):** ningún modelo de Prisma ni migración
(Fase 2, con el `EXCLUDE USING gist` a mano) · la lógica del núcleo (Fase 1) · auth /
`ThrottlerModule` / `APP_GUARD` (Fase 3) · cron / correo / `.ics` (Fase 6) · Stripe (Fase 7) ·
servicios de documentación en el compose (Fase 8).

---

## 2. Contexto real levantado el 2026-09-10

Antes de escribir una sola línea de esta documentación se leyó código y documentación real:

- **Bridge completo** (README, 11 lecciones de arquitectura, checklist de seguridad de 9+2+3
  rondas de auditoría).
- **Espiral**: `appointments.service.ts` (2,276 líneas), `appointments.cron.ts`,
  `appointment-status.constants.ts`, los modelos `artists` / `artist_locations` /
  `artist_time_off` / `appointments` / `budget_requests` / `recurring_expenses` del schema, y
  `week-calendar.tsx` (713 líneas).
- **Dely Doggy**: `agenda.service.ts`, los modelos `events` / `event_items` /
  `employee_assignments` / `local_deliveries` / `delivery_routes`, y `lib/mexico-calendar.ts`.
- **OmniUser** (`dvlopmnt/login`): estado real de la base de auth — jerarquía de roles con
  `level`/`max_count`, 2FA TOTP, 25 pruebas `jest`, `PRUEBAS_SEGURIDAD.md` con 9 pruebas OWASP.
- **gallery**: política real de animación (CSS puro; `motion` probado y retirado).
- **Asclepios**: solo para confirmar que planeaba copiar el modelo de Espiral — y quedó
  **explícitamente fuera** de las decisiones de este proyecto.
- **Puertos** de los 6 proyectos que corren en este host, para no chocar.

---

## 3. Hallazgo que definió la estrategia

**Tres proyectos ya escribieron su propia agenda por separado, y un cuarto planeaba copiar la
primera a mano.** Es la misma divergencia que ya obligó a sacar el Bridge a una ruta externa,
ocurriendo esta vez en el código en lugar de en la documentación. Detalle completo en
`PLAN_DESARROLLO.md` §0.1.

---

## 4. Próximo paso

**Fase 3 — Identidad y permisos.** Auth portada de OmniUser (jerarquía real de roles con
`level`/`max_count`, 2FA TOTP, anti-enumeración) **más** permisos por calendario, y el modelo
**fail-closed**: `APP_GUARD` de autenticación global + decorador `@Public()` explícito, desde
ahora y no después (el checklist es claro: invertirlo con muchos módulos cuesta mucho más).
Verificación: barrido real de rutas sin autenticación, clasificado por código de respuesta.

**Cómo correr lo que ya existe:**
```
cd /home/bn/DvloprBn/dvlopmnt/Planner
# Núcleo (no necesita Docker — TypeScript puro):
cd omniagenda_core && npm install && npm test && npm run typecheck && npm run build
# Stack + base de datos:
cd .. && cp .env.example .env          # solo la 1ª vez; rellena las 2 contraseñas
docker compose up -d --build           # migra + siembra solo; frontend :3061 · health :3060/health
# Comprobaciones de la garantía (con el stack arriba):
docker compose exec -T omniagenda_db psql -U omniagenda_user -d omniagenda_db \
  -v ON_ERROR_STOP=1 -f - < omniagenda_backend/prisma/checks/double_booking.sql
node omniagenda_backend/prisma/checks/status-sync.mjs
docker compose down                    # detener (los datos de Postgres persisten)
```

---

## 5. Preguntas abiertas que bloquean algo

Ninguna bloquea la Fase 0. Las cinco de `PLAN_DESARROLLO.md` §11 se pueden responder mientras se
construye la infraestructura. La primera que se vuelve bloqueante es **cuál es el negocio de
demostración**, y lo hace hasta la Fase 5 (interfaz).

---

## Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-09-10 | **Fase 2 (Persistencia + la garantía real) — completa y verificada en vivo.** `schema.prisma` con los 6 modelos del motor, todos ciegos al negocio. Migración `20260910211526_init` generada con `prisma migrate dev --create-only` y luego **editada a mano** para añadir lo que el DSL de Prisma no expresa: `CREATE EXTENSION btree_gist`, `CHECK (starts_at < ends_at)` / `CHECK (start_time < end_time)` / `CHECK (start_date <= end_date)`, y la restricción central `no_overlapping_resource_bookings` — `EXCLUDE USING gist (resource_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE (blocking = true AND status NOT IN ('cancelada','rechazada','expirada'))`. `tstzrange` es `[)` por defecto → misma semántica semiabierta que `omniagenda_core`. `seed.ts` idempotente con datos de demo **ficticios** (el repo es público): 1 calendario "Estética", 3 recursos, 3 horarios, 1 reserva de ejemplo. `prisma db seed` añadido al `command` del compose; `seed` reactivado en `prisma.config.ts`. **Dos comprobaciones committeadas** en `omniagenda_backend/prisma/checks/`: `double_booking.sql` (6 casos contra Postgres en vivo, transacción con ROLLBACK) y `status-sync.mjs` (Node sin deps: falla si el `WHERE` de la migración y `NON_BLOCKING_STATUSES` dejan de coincidir — la prueba que faltó en Espiral). **Verificado con reinicio limpio** (`down -v` → `up`): cadena `generate→migrate→seed→nest` con 0 errores; `pg_constraint` confirma el `EXCLUDE` + 3 `CHECK`; 6/6 PASS en `double_booking.sql`; PASS en `status-sync.mjs`; `/health` ok, frontend 200. Se quitó el campo obsoleto `phase:0` de `/health`. **Movido a Fase 4** (decisión consciente): el cableado del backend para importar `@omniagenda/core` en runtime — se hace donde de verdad se usa (`evaluateConflict` en la API), no antes. |
| 2026-09-10 | **Fase 1 (`omniagenda_core`) — completa, 57 pruebas verdes.** Paquete `@omniagenda/core` 0.1.0, TypeScript puro (sin Nest/Prisma/React). Módulos: `time/interval.ts` (rango semiabierto `[start,end)` en ms epoch — `overlaps` con `<`, no `<=`, para que dos citas seguidas no choquen), `time/interval-set.ts` (`normalize`/`subtract`/`intersect`/`freeWithin`/`expandEach`), `time/zoned.ts` (puente hora-de-pared ↔ instante con zona IANA vía `Intl`, sin librería; salvedad DST documentada, verticales de referencia sin DST), `recurrence/rrule.ts` (`expandRecurrence` — subconjunto RFC 5545: DAILY/WEEKLY/MONTHLY, INTERVAL, BYDAY, BYMONTHDAY con recorte a fin de mes, COUNT, UNTIL, EXDATE; avanza en reloj de pared, no en saltos fijos de 24 h; tope de 20 000 iteraciones), `recurrence/horizon.ts` (**cierra el riesgo #1**: `MATERIALIZATION_HORIZON_DAYS = 90` en una sola constante, con el razonamiento de la compensación escrito ahí), `conflict/status.ts` (`NON_BLOCKING_STATUSES = ['cancelada','rechazada','expirada']` — la constante única que la migración de Fase 2 tendrá que citar), `conflict/conflict.ts` (`evaluateConflict` — duro vs blando, multi-recurso, colchón de traslado, `ignoreBookingId` para reprogramar), `availability/weekly-hours.ts` + `availability/availability.ts` (patrón semanal JSON estilo `artist_locations.weekly_hours`; `apertura − ausencias − (ocupado+colchón) → filtrar cortos`). **Runner: `node:test` nativo + `tsx`**, cero framework (lo más coherente con "TS puro"). **Verificado**: `npm test` → 57/57 en ~185 ms; `tsc --noEmit` limpio; `npm run build` genera `dist/` sin los `.test`; smoke de `import('./dist/index.js')` → 31 exports. **Decisión §6.3 tomada**: paquete versionado, consumo local dentro del repo hasta que haya un consumidor externo; no se publica a registro todavía. `git init` local, sin remoto (el dueño creará el repo público). |
| 2026-09-10 | **Fase 0 (Infraestructura) — completa y verificada en vivo.** `docker-compose.yml` con 4 servicios calcado del patrón probado de OmniUser: `postgres:18-alpine` + `redis:8-alpine` (ambos solo `127.0.0.1`, healthchecks reales, `no-new-privileges`), backend NestJS 11 / Prisma 7 / `ioredis` sobre `node:24-alpine` (tini como PID 1, usuario `node`), frontend Next.js 16.3.1 / React 19.2.4 / Tailwind 4. `main.ts` con helmet + CORS por `ALLOWED_ORIGINS` + `ValidationPipe` whitelist. `schema.prisma` **solo generador + datasource** (modelos y el `EXCLUDE` a mano → Fase 2). `RedisService` lee host/puerto del entorno en vez de incrustarlos (mismo principio que "la zona horaria es un dato"). `omniagenda_core` queda como esqueleto de paquete `@omniagenda/core`. Puertos: db 5439 · redis 6384 · api 3060 · front 3061 · studio 5523 (reservado). **Verificación real**: `compose config` válido → 4 contenedores arriba, db+redis `healthy` → `nest build` 0 errores → `GET /health` responde `ok:true` con `postgres:"ok"` y `redis:"ok"` (tocó ambos de verdad) → `GET /` del frontend `200` con las 4 filas de estado en `ok` (Server Component resolvió el fetch por la red interna) → logs sin errores propios. `docker compose down` conserva volúmenes. |
| 2026-09-10 | **Documentación inicial v0.1 — 8 archivos.** Contexto levantado de Bridge + Espiral + Dely Doggy + OmniUser + gallery (código real, no solo documentación). Estrategia cerrada con 11 decisiones del dueño: nombre **OmniAgenda**, forma núcleo+anfitriona, solo PostgreSQL/web, naturaleza estudio/portafolio bajo `dvloprbn.dev`, alcance v1 de 4 dominios + cobro en línea, distribución por paquete npm versionado, sin migrar Espiral ni Dely Doggy, **Asclepios fuera de consideración**, animación CSS con componentes 100% propios, POS como paquete complementario abierto. Se documentó además una **regla general nueva de la carpeta `dvlopmnt/`** que el dueño quería registrada y no estaba en ningún lado: todo proyecto de esa carpeta es de estudio/demo, comparte los recursos de terceros del portafolio (Stripe, Resend), guarda solo datos de demostración con usuarios de prueba, y se publica bajo el dominio del portafolio. Puertos asignados sin choque contra los 6 proyectos existentes. **Cero código escrito.** |
