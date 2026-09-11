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

Última actualización: **2026-09-11** (negocio de demostración decidido + colchón entre calendarios)

---

## 1. Dónde estamos

**Fases 0 a 4 completas y verificadas, más una capacidad nueva motivada por una decisión de
negocio.** Stack de 4 servicios OK; `omniagenda_core` cableado al backend en runtime; base de
datos con la garantía `EXCLUDE USING gist`; identidad + permisos por calendario; API de agenda
real (crear/mover/cancelar, multi-recurso, `409` real ante doble-reserva, disponibilidad). **El
negocio de demostración quedó decidido: estética multisucursal** (`PLAN_DESARROLLO.md` §11,
pregunta #2, cerrada) — y eso motivó construir el **colchón entre calendarios**
(`resources.calendar_switch_buffer_minutes`), la generalización del "colchón de traslado" de
Espiral. Ver `DOCUMENTO_VIVO_ARQUITECTURA.md` §11 para el razonamiento completo.

Estructura real en disco:

| Carpeta / archivo | Estado |
|---|---|
| `docker-compose.yml` | ✅ 4 servicios (db 5439 · redis 6384 · backend 3060 · frontend 3061). **Contexto de build del backend = raíz del repo** (Fase 4, para incluir `omniagenda_core`) |
| `.env.example` / `.env` | ✅ `.env` local con contraseñas de prueba (gitignored) |
| `omniagenda_core/` | ✅ **v0.2.0** — CommonJS (Fase 4); `ResourceBooking`/`ConflictCandidate` ganaron `calendarId` y `crossCalendarBufferMinutes` (colchón entre calendarios, conflicto DURO). **63 pruebas** `node:test` + `tsx` |
| `omniagenda_backend/prisma/` | ✅ `schema.prisma` con **13 modelos**; **4 migraciones**, tres con bloque SQL a mano (`EXCLUDE`+`CHECK`s de tiempo, `CHECK` de `calendar_role`, `CHECK >= 0` del colchón entre calendarios); `seed.ts` idempotente = 6 roles + 6 cuentas + **2 sucursales** (Centro/Norte) + un estilista que atiende en ambas con colchón de 45 min; `checks/double_booking.sql` + `checks/status-sync.mjs` |
| `omniagenda_backend/src/` | ✅ `auth`/`two-factor`/`roles`/`users`/`security-events`/`mail`/`calendar-access` (`@Global()`, fail-closed) + `resources`/`calendars`/`schedule-rules`/`time-off`/`bookings` (**el escritor único**)/`availability`. `@omniagenda/core` se importa en runtime (`file:../omniagenda_core`) |
| `omniagenda_backend/test/` | ✅ 7 archivos Jest (**43 pruebas**, +3 de colchón entre calendarios) + `auth-sweep.sh` (27 casos) + `agenda-e2e.sh` (**19 casos**, +3 de colchón entre sucursales contra el seed real) |
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

**Verificación Fase 3 (2026-09-10), reinicio limpio (`down -v` → `up`):**
- Las **3 migraciones** aplican desde cero; seed corre (`Listo.`): 6 roles + 6 cuentas de prueba
  (`super+omniagenda@example.com` … `usuario+omniagenda@example.com`, contraseña `TestOnly123!`)
  + demo + 2 membresías de calendario.
- `nest build` → **0 errores**. **31 pruebas Jest** verdes (6 archivos).
- `omniagenda_backend/test/auth-sweep.sh` → **27/27 PASS**: toda ruta protegida da 401 sin sesión;
  las `@Public()` nunca dan 401; `usuario` global → 403 en `/users`; la matriz de permisos por
  calendario se comporta como se diseñó (admin global = manager implícito; `booker` cubre
  `viewer` pero no `manager`; no-miembro sin acceso a calendario no público).
- **2FA end-to-end** por curl: setup → confirm (10 códigos) → login pide 2FA → login/2fa con
  TOTP fresco emite sesión → `/auth/me` 200; código de recuperación 1er uso 200, 2º uso 401.
- Los `checks/` de la Fase 2 siguen verdes.

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

**Verificación Fase 4 (2026-09-11), reinicio limpio TOTAL (`down -v` + `--build`):**
- El backend construye el núcleo dentro de su propia imagen y lo `require()` en runtime —
  `nest build` **0 errores**.
- **40 pruebas Jest** verdes (7 archivos, incluido `bookings.service.test.ts`): transacción con
  rollback real ante traslape (sin fila huérfana en `bookings`), espejo sincronizado,
  multi-recurso atómico, mover a hueco libre / a uno ocupado, cancelar libera el horario, bloque
  no-bloqueante, ventana inválida.
- **`agenda-e2e.sh` 16/16 PASS** contra la API real por HTTP: recurso + calendario (el creador
  queda `manager`) + horario semanal → **una reserva solapada por la API real recibe `409`** →
  adyacentes conviven → multi-recurso atómico (si un solo recurso choca, la reserva entera falla)
  → mover y cancelar liberan el horario → disponibilidad calculada por `@omniagenda/core` →
  permisos por calendario respetados en los endpoints de reservas (403 fuera de membresía).
- Las suites de Fases 2 y 3 siguen verdes tras el reinicio total.
- Corregido un bug en los propios scripts de verificación: el flush de Redis no limpiaba nada
  (patrón que no coincidía con las llaves reales del throttler) → `FLUSHDB`.

**Lo que NO existe todavía (a propósito, por fase):** frontend de login/agenda (Fase 5) · cron /
correo real / `.ics` (Fase 6) · Stripe (Fase 7) · servicios de documentación en el compose
(Fase 8) · negocio de demostración concreto para la Fase 9. `RESEND_API_KEY` es un placeholder —
el flujo de correo es real pero no entrega.

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

**Fase 5 — Interfaz y animación**, ya sin bloqueo. Las 5 vistas de calendario
(día/semana/mes/agenda/línea de tiempo), arrastrar y soltar, lenguaje visual propio en CSS puro
(ver `PLAN_DESARROLLO.md` §9) — la primera pantalla real que sustituye a la página de estado de
la Fase 0. Consume la API de la Fase 4 vía `INTERNAL_API_URL`/`NEXT_PUBLIC_API_URL` ya
configurados, con el vertical de **estética multisucursal** (2 sucursales sembradas: Centro y
Norte) como el caso concreto a diseñar.

**Cómo correr lo que ya existe:**
```
cd /home/bn/DvloprBn/dvlopmnt/Planner
# Núcleo (no necesita Docker — TypeScript puro, CommonJS):
cd omniagenda_core && npm install && npm test && npm run typecheck && npm run build
# Stack + base de datos (el backend construye el núcleo dentro de su propia imagen):
cd .. && cp .env.example .env          # solo la 1ª vez; rellena las contraseñas + secretos
docker compose up -d --build           # migra + siembra; frontend :3061 · api :3060
# Pruebas y comprobaciones (con el stack arriba):
docker compose exec -T omniagenda_backend npm test              # 43 pruebas Jest
docker compose exec -T omniagenda_backend npm run build         # typecheck completo
bash omniagenda_backend/test/auth-sweep.sh                       # 27 casos de control de acceso
bash omniagenda_backend/test/agenda-e2e.sh                       # 19 casos de la API de agenda
docker compose exec -T omniagenda_db psql -U omniagenda_user -d omniagenda_db \
  -v ON_ERROR_STOP=1 -f - < omniagenda_backend/prisma/checks/double_booking.sql
node omniagenda_backend/prisma/checks/status-sync.mjs
docker compose down                    # detener (los datos de Postgres persisten)
```

Cuentas de prueba sembradas: `<rol>+omniagenda@example.com` (rol ∈ super/director/admin/manager/
staff/usuario), contraseña `TestOnly123!`. `staff` es `manager` de **ambas** sucursales; `usuario`
es `booker` de Centro.

---

## 5. Preguntas abiertas que bloquean algo

Ninguna bloquea la Fase 5. La pregunta que bloqueaba (cuál es el negocio de demostración,
pregunta abierta #2 de `PLAN_DESARROLLO.md` §11) quedó **cerrada** el 2026-09-11: estética
multisucursal. Las otras cuatro de esa lista se pueden seguir respondiendo mientras tanto.

---

## Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-09-11 | **Negocio de demostración decidido (estética multisucursal) + colchón entre calendarios construido.** El dueño preguntó cuál candidato (restaurante vs. estética, ambos multisucursal) da un caso de estudio más completo. Análisis contra el código real: el restaurante ejercitaría capacidad que la Fase 4 **ya construyó** (multi-recurso, transacción atómica); la estética exige que el motor **crezca** una capacidad nueva — un recurso (estilista) que trabaja en 2 sucursales, con un colchón de traslado entre ellas. **Decisión: estética multisucursal**; restaurante multisucursal queda anotado como caso de estudio futuro, no descartado. Construido en el acto: `resources.calendar_switch_buffer_minutes` (migración `20260911012816`, `CHECK >= 0`) generaliza `artists.location_change_buffer_minutes` de Espiral — a diferencia del colchón general (preferencia, conflicto BLANDO), este es una imposibilidad física y se reporta como conflicto **DURO**. `omniagenda_core`: `ResourceBooking`/`ConflictCandidate` ganaron `calendarId` + `crossCalendarBufferMinutes` (cambio incompatible de tipos → **v0.2.0**). `BookingsService.preflightConflict` calcula el valor efectivo como el máximo entre los recursos de la reserva. Seed actualizado: **2 sucursales** (Centro L–Sáb, Norte mar/jue) con el estilista de demo atendiendo en ambas, colchón de 45 min. **Verificado con reinicio limpio TOTAL**: núcleo **63/63** (+6), Jest **43/43** (+3), `agenda-e2e.sh` **19/19** (+3, contra el seed real: 15 min entre sucursales → 409, 45 min → 201), `auth-sweep.sh` 27/27, checks de Fase 2 verdes. |
| 2026-09-11 | **Fase 4 (API de agenda) — completa y verificada en vivo.** Se cableó `@omniagenda/core` al backend en runtime (pendiente desde Fase 2): contexto de build del backend pasó a la raíz del repo, `Dockerfile.dev` copia y construye el núcleo como paso previo (`file:../omniagenda_core`, symlink en `node_modules`). **Cambio real al núcleo que esto forzó**: dejó de ser `"type":"module"` (ESM) — ahora **CommonJS** — para que NestJS y Jest lo importen con `require()` sin gimnasia de ESM; las 57 pruebas del núcleo no se afectaron. 6 módulos nuevos: `resources` (CRUD, rol global), `calendars` (crear → el creador queda `manager`; listar según membresía/visibilidad/admin), `schedule-rules` (horario semanal por recurso-calendario), `time-off` (ausencias de calendario o de recurso), `bookings` — **el escritor único** de `bookings`+`booking_resources`, con dos capas de defensa: `evaluateConflict` del núcleo como pre-chequeo (mensaje claro) + la `EXCLUDE` de PostgreSQL dentro de `$transaction` como backstop real contra condiciones de carrera (rollback sin fila huérfana); multi-recurso atómico; mover/cancelar reescriben el espejo. `availability` — `computeAvailability` del núcleo sobre horario+ausencias+ocupado+colchón. Todo gateado por `@CalendarRole`+`CalendarAccessGuard` (o rol global donde el recurso es del sistema). La disponibilidad sigue siendo un dato personal: un `busy_only` visto sin membresía real oculta título/creador/origen. **Verificado con reinicio limpio TOTAL** (`down -v` + `--build`): `require('@omniagenda/core')` funciona en el contenedor, `nest build` 0 errores, **40 pruebas Jest** (7 archivos, +`bookings.service.test.ts`), **`agenda-e2e.sh` nuevo, 16/16 PASS** por HTTP real — el caso central: **doble-reserva por la API real → `409`**; adyacentes conviven; multi-recurso atómico; mover/cancelar liberan horario; disponibilidad real; permisos por calendario respetados. Las suites de Fases 2 y 3 siguen verdes. **Bug corregido en los propios scripts de prueba**: el flush de Redis no limpiaba nada (patrón equivocado) → `FLUSHDB`. |
| 2026-09-10 | **Fase 3 (Identidad y permisos) — completa y verificada en vivo.** Núcleo de auth **portado de OmniUser con toda su profundidad** (feedback explícito del dueño, sin base recortada): registro público, login en 3 pasos (correo→contraseña→2FA TOTP), refresh token opaco con rotación + ventana de gracia 30 s + revocación en cascada ante reuso, cambio/reset de contraseña, **2FA real** (setup con QR, 10 códigos de recuperación de un solo uso hasheados, secreto TOTP cifrado AES-256-GCM con llave distinta de `JWT_SECRET`), **jerarquía de roles** (`level` 0–5, `max_count`), **detección de fuerza bruta** (login/2FA/reuso de refresh) con conteo en Redis + alerta a admin/super, anti-enumeración. **Mejora sobre OmniUser: modelo fail-closed** — `JwtAuthGuard` es `APP_GUARD` global (toda ruta exige sesión salvo `@Public()` explícito), `RolesGuard` global; orden Throttler→JwtAuth→Roles. **Nuevo, sin equivalente en OmniUser: `calendar_members`** — permisos por calendario (viewer/booker/manager) encima del rol global: admin/director/super son manager implícito en todos; `CalendarAccessService` (exportado para Fase 4) + `@CalendarRole` + `CalendarAccessGuard` + `/calendars/:id/members`; `allowByVisibility` para lectura pública acotada; `CHECK (calendar_role IN …)` a mano. Migración `20260910213848_add_auth_and_calendar_permissions` (7 tablas + `bookings.created_by` + el `CHECK`). `seed.ts` fusionado: 6 roles + 6 cuentas de prueba (`<rol>+omniagenda@example.com`, `TestOnly123!`) + demo + 2 membresías. Deps nuevas: `@nestjs/jwt`/`passport`/`passport-jwt`/`@nestjs/throttler`/`@nest-lab/throttler-storage-redis`/`bcryptjs`/`otplib`/`qrcode`/`resend`/`ms`/`@nestjs/swagger`. **Runner de pruebas del backend: Jest + ts-jest** (NestJS DI necesita `emitDecoratorMetadata`, que `tsx`/esbuild no emite; el cliente Prisma 7 usa imports `.js` ESM → `moduleNameMapper`, misma cura que OmniUser). `tsx` se conserva para el seed. **Verificado con reinicio limpio** (`down -v` → `up`): 3 migraciones desde cero, seed OK, `nest build` 0 errores, **31 pruebas Jest** verdes (6 archivos: crypto/totp/escapeHtml portados + roles/users de integración portados + `calendar-access` nuevo), **`auth-sweep.sh` 27/27** (toda ruta protegida 401 sin sesión, `@Public()` nunca 401, RolesGuard 403, matriz por calendario correcta), **2FA end-to-end por curl** (setup→confirm→login pide 2FA→TOTP fresco→sesión; recovery code 1er uso 200 / 2º uso 401), y los `checks/` de Fase 2 siguen verdes. `RESEND_API_KEY` es placeholder (flujo real, no entrega). |
| 2026-09-10 | **Fase 2 (Persistencia + la garantía real) — completa y verificada en vivo.** `schema.prisma` con los 6 modelos del motor, todos ciegos al negocio. Migración `20260910211526_init` generada con `prisma migrate dev --create-only` y luego **editada a mano** para añadir lo que el DSL de Prisma no expresa: `CREATE EXTENSION btree_gist`, `CHECK (starts_at < ends_at)` / `CHECK (start_time < end_time)` / `CHECK (start_date <= end_date)`, y la restricción central `no_overlapping_resource_bookings` — `EXCLUDE USING gist (resource_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE (blocking = true AND status NOT IN ('cancelada','rechazada','expirada'))`. `tstzrange` es `[)` por defecto → misma semántica semiabierta que `omniagenda_core`. `seed.ts` idempotente con datos de demo **ficticios** (el repo es público): 1 calendario "Estética", 3 recursos, 3 horarios, 1 reserva de ejemplo. `prisma db seed` añadido al `command` del compose; `seed` reactivado en `prisma.config.ts`. **Dos comprobaciones committeadas** en `omniagenda_backend/prisma/checks/`: `double_booking.sql` (6 casos contra Postgres en vivo, transacción con ROLLBACK) y `status-sync.mjs` (Node sin deps: falla si el `WHERE` de la migración y `NON_BLOCKING_STATUSES` dejan de coincidir — la prueba que faltó en Espiral). **Verificado con reinicio limpio** (`down -v` → `up`): cadena `generate→migrate→seed→nest` con 0 errores; `pg_constraint` confirma el `EXCLUDE` + 3 `CHECK`; 6/6 PASS en `double_booking.sql`; PASS en `status-sync.mjs`; `/health` ok, frontend 200. Se quitó el campo obsoleto `phase:0` de `/health`. **Movido a Fase 4** (decisión consciente): el cableado del backend para importar `@omniagenda/core` en runtime — se hace donde de verdad se usa (`evaluateConflict` en la API), no antes. |
| 2026-09-10 | **Fase 1 (`omniagenda_core`) — completa, 57 pruebas verdes.** Paquete `@omniagenda/core` 0.1.0, TypeScript puro (sin Nest/Prisma/React). Módulos: `time/interval.ts` (rango semiabierto `[start,end)` en ms epoch — `overlaps` con `<`, no `<=`, para que dos citas seguidas no choquen), `time/interval-set.ts` (`normalize`/`subtract`/`intersect`/`freeWithin`/`expandEach`), `time/zoned.ts` (puente hora-de-pared ↔ instante con zona IANA vía `Intl`, sin librería; salvedad DST documentada, verticales de referencia sin DST), `recurrence/rrule.ts` (`expandRecurrence` — subconjunto RFC 5545: DAILY/WEEKLY/MONTHLY, INTERVAL, BYDAY, BYMONTHDAY con recorte a fin de mes, COUNT, UNTIL, EXDATE; avanza en reloj de pared, no en saltos fijos de 24 h; tope de 20 000 iteraciones), `recurrence/horizon.ts` (**cierra el riesgo #1**: `MATERIALIZATION_HORIZON_DAYS = 90` en una sola constante, con el razonamiento de la compensación escrito ahí), `conflict/status.ts` (`NON_BLOCKING_STATUSES = ['cancelada','rechazada','expirada']` — la constante única que la migración de Fase 2 tendrá que citar), `conflict/conflict.ts` (`evaluateConflict` — duro vs blando, multi-recurso, colchón de traslado, `ignoreBookingId` para reprogramar), `availability/weekly-hours.ts` + `availability/availability.ts` (patrón semanal JSON estilo `artist_locations.weekly_hours`; `apertura − ausencias − (ocupado+colchón) → filtrar cortos`). **Runner: `node:test` nativo + `tsx`**, cero framework (lo más coherente con "TS puro"). **Verificado**: `npm test` → 57/57 en ~185 ms; `tsc --noEmit` limpio; `npm run build` genera `dist/` sin los `.test`; smoke de `import('./dist/index.js')` → 31 exports. **Decisión §6.3 tomada**: paquete versionado, consumo local dentro del repo hasta que haya un consumidor externo; no se publica a registro todavía. `git init` local, sin remoto (el dueño creará el repo público). |
| 2026-09-10 | **Fase 0 (Infraestructura) — completa y verificada en vivo.** `docker-compose.yml` con 4 servicios calcado del patrón probado de OmniUser: `postgres:18-alpine` + `redis:8-alpine` (ambos solo `127.0.0.1`, healthchecks reales, `no-new-privileges`), backend NestJS 11 / Prisma 7 / `ioredis` sobre `node:24-alpine` (tini como PID 1, usuario `node`), frontend Next.js 16.3.1 / React 19.2.4 / Tailwind 4. `main.ts` con helmet + CORS por `ALLOWED_ORIGINS` + `ValidationPipe` whitelist. `schema.prisma` **solo generador + datasource** (modelos y el `EXCLUDE` a mano → Fase 2). `RedisService` lee host/puerto del entorno en vez de incrustarlos (mismo principio que "la zona horaria es un dato"). `omniagenda_core` queda como esqueleto de paquete `@omniagenda/core`. Puertos: db 5439 · redis 6384 · api 3060 · front 3061 · studio 5523 (reservado). **Verificación real**: `compose config` válido → 4 contenedores arriba, db+redis `healthy` → `nest build` 0 errores → `GET /health` responde `ok:true` con `postgres:"ok"` y `redis:"ok"` (tocó ambos de verdad) → `GET /` del frontend `200` con las 4 filas de estado en `ok` (Server Component resolvió el fetch por la red interna) → logs sin errores propios. `docker compose down` conserva volúmenes. |
| 2026-09-10 | **Documentación inicial v0.1 — 8 archivos.** Contexto levantado de Bridge + Espiral + Dely Doggy + OmniUser + gallery (código real, no solo documentación). Estrategia cerrada con 11 decisiones del dueño: nombre **OmniAgenda**, forma núcleo+anfitriona, solo PostgreSQL/web, naturaleza estudio/portafolio bajo `dvloprbn.dev`, alcance v1 de 4 dominios + cobro en línea, distribución por paquete npm versionado, sin migrar Espiral ni Dely Doggy, **Asclepios fuera de consideración**, animación CSS con componentes 100% propios, POS como paquete complementario abierto. Se documentó además una **regla general nueva de la carpeta `dvlopmnt/`** que el dueño quería registrada y no estaba en ningún lado: todo proyecto de esa carpeta es de estudio/demo, comparte los recursos de terceros del portafolio (Stripe, Resend), guarda solo datos de demostración con usuarios de prueba, y se publica bajo el dominio del portafolio. Puertos asignados sin choque contra los 6 proyectos existentes. **Cero código escrito.** |
