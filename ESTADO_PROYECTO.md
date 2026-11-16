# Estado del proyecto — OmniAgenda

> **Remoto (2026-11-16):** `git@github.com:DvloprBn/omniagenda.git` (rama `main`, 16 commits, público como los demás de `dvlopmnt/`). Antes de la primera subida se escaneó toda la historia (sin secretos) y se reescribió para sustituir un dato personal en una prueba (`escape-html.util.test.ts`); los hashes anteriores ya no existen. Copia de seguridad del estado previo: solo en el scratchpad de esa sesión.

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

Última actualización: **2026-09-11** (Vista de Día construida + corregido un bug real de zona horaria en `?date=`)

---

## 1. Dónde estamos

**Fases 0 a 4 completas y verificadas + Fase 5a + vínculo recurso↔cuenta + Fase 5b en
construcción.** Backend completo (motor, identidad, permisos por calendario, API de agenda,
colchón entre sucursales, vínculo opcional recurso↔cuenta) y un **frontend real** — login de 2
pantallas, sesión por cookies, panel protegido con selector de sucursal, y ahora la **primera
vista de calendario real con arrastrar y soltar** (Semana). El dueño ya confirmó visualmente la
Fase 5a el 2026-09-11 ("se ve bien, aún no tiene nada" — exactamente lo esperado de unos
cimientos); la Vista de Semana que se acaba de construir es la primera pieza que le pone
contenido real. **Sin herramienta de navegador en esta sesión** — lo verificable por HTTP/build se
verificó de verdad; el dueño ya probó el arrastre en su propio navegador y confirmó: "se siente
muy natural, funciona muy bien, mueve entre columnas sin retrasos".

Estructura real en disco:

| Carpeta / archivo | Estado |
|---|---|
| `docker-compose.yml` | ✅ 4 servicios (db 5439 · redis 6384 · backend 3060 · frontend 3061). Contexto de build del backend = raíz del repo (para incluir `omniagenda_core`) |
| `.env.example` / `.env` | ✅ `.env` local con contraseñas de prueba (gitignored) |
| `omniagenda_core/` | ✅ **v0.2.0** — CommonJS; `ResourceBooking`/`ConflictCandidate` con `calendarId` y `crossCalendarBufferMinutes` (colchón entre calendarios, conflicto DURO). **63 pruebas** `node:test` + `tsx` |
| `omniagenda_backend/` | ✅ 14 modelos, 5 migraciones; `auth`/`two-factor`/`roles`/`users`/`security-events`/`mail`/`calendar-access` (fail-closed) + `resources`/`calendars`/`schedule-rules`/`time-off`/`bookings` (escritor único)/`availability`/`me` (vínculo recurso↔cuenta, `GET /me/schedule`). **51 pruebas Jest** + `auth-sweep.sh` (27) + `agenda-e2e.sh` (23) + `checks/` de Fase 2 |
| `omniagenda_frontend/` | ✅ Fase 5a + 🔶 **Fase 5b en construcción** — Next.js 16.3.1 + React 19.2.4 + Tailwind 4 + CSS propio. `lib/server-fetch.ts` + `lib/client-api.ts` (cliente de API real) · `proxy.ts` (protección de `/agenda/*`) · `/login` (2 pantallas) · `/agenda?view=&date=&cal=` (protegido: `ViewSwitcher`+`DateNav` nuevos, estado en la URL) — **Semana y Día reales** (`time-grid-view.tsx`, componente único con `daysCount: 1\|7`: rejilla de **24 horas completas**, arrastrar-y-soltar con Pointer Events propios + alternativa de teclado real, `PATCH` optimista con reversión ante `409`/`403`, confirmado en navegador real por el dueño), Agenda (formaliza la lista de 5a), Mes/Línea de tiempo pendientes (aviso honesto en la UI, no simuladas) · `lib/calendar-nav.ts` (+ `parseDateInZone`/`addMonthsInZone`, conscientes de zona) + `lib/grid-math.ts` (aritmética pura, **20 pruebas `node:test`+`tsx`**) · `/estado` · `/` |

**Verificación Fase 5a (2026-09-11) — todo lo verificable sin navegador:**
- `next build` (producción) → compila limpio, TypeScript sin errores, rutas clasificadas
  correctamente (`/` estática; `/login`/`/estado`/`/agenda` dinámicas; `proxy.ts` registrado).
- `GET /agenda` sin cookie → `307` a `/login?next=%2Fagenda`.
- **Login real por curl** (cuenta sembrada) contra el backend → esas mismas cookies contra el
  frontend en `GET /agenda` → `200` con el nombre real de la cuenta, las 2 sucursales reales y
  las reservas de los próximos 7 días en el HTML.
- `GET /login` con sesión activa → `307` a `/agenda` (protección inversa).
- `POST /auth/logout` real → `GET /agenda` vuelve a dar `307` a `/login`.
- **No verificado** (requiere navegador): que el paso de 2FA se revele bien en el DOM, y toda la
  calidad visual/animación real.

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

**Verificación vínculo recurso↔cuenta (2026-09-11), reinicio limpio TOTAL (`down -v` + `--build`):**
- Migración `20260911141304_link_resource_to_user_account` (`resources.user_id String? @unique`,
  `onDelete: SetNull`) aplica limpio desde cero.
- Seed (parte 4) vincula `estilista+omniagenda@example.com` al recurso estilista sembrado.
- `PATCH /resources/:id { user_id }` valida: cuenta inexistente → 404; cuenta ya vinculada a otro
  recurso → 409 (vía `@unique` de Postgres); `null` desvincula.
- `GET /me/schedule` (nuevo, sin `@Roles`/`@CalendarRole` — cualquier cuenta puede preguntar por SU
  PROPIA agenda): estilista vinculado → ve su reserva real combinando las 2 sucursales; cuenta sin
  vínculo → 404 con mensaje claro; sin `from`/`to` → 400.
- **51/51 pruebas Jest** (+8: `resources.service.test.ts` y `me.service.test.ts` nuevos),
  **`agenda-e2e.sh` 23/23** (+4, `/me/schedule` real), `auth-sweep.sh` 27/27, checks de Fase 2 y
  núcleo (63/63) sin regresión.

**Verificación Fase 5b, 1er incremento (2026-09-11), reinicio limpio TOTAL (`down -v` + `--build`):**
- Cimientos compartidos: `ViewSwitcher`/`DateNav` (estado en `?view=`/`?date=`, mismo criterio que
  `?cal=`), `BookingBlock` (chip visual reutilizable), `lib/calendar-nav.ts` + `lib/grid-math.ts`
  (aritmética pura de calendario/rejilla, con `Intl` en vez de reimportar `@omniagenda/core` — ver
  `DOCUMENTO_VIVO_ARQUITECTURA.md` §14 el porqué).
- **Vista de Semana real**, arrastrar-y-soltar con Pointer Events escritos desde cero (nunca HTML5
  Drag&Drop nativo ni librería): mueve con `transform`, confirma con `PATCH
  /calendars/:id/bookings/:id`, revierte con `oa-shake` si el backend responde `409`/`403`.
  Alternativa real de teclado (flechas, mismo camino optimista+PATCH) — no decorativa.
- **16 pruebas `node:test`+`tsx` nuevas** (primer runner de pruebas del frontend): 10 de
  `calendar-nav.ts`, 6 de `grid-math.ts`. `tsc --noEmit` y `next build` producción limpios.
- Con el stack reconstruido desde cero: login real por curl → `GET
  /agenda?view=week&cal=...&date=2026-12-15` → `200` con la reserva sembrada real dentro de la
  rejilla y su `aria-label` de accesibilidad presente. `?view=agenda` conserva el comportamiento
  de la Fase 5a; `?view=day|month|timeline` muestran un aviso honesto de "no construida todavía"
  en vez de simular una vista que no existe.
- Sin regresión: núcleo 63/63, backend Jest 51/51, `auth-sweep.sh` 27/27, `agenda-e2e.sh` 23/23,
  checks SQL de Fase 2.
- **Confirmado por el dueño en su navegador (2026-09-11)**: "se siente muy natural, funciona muy
  bien, mueve entre columnas sin retrasos" — la sensación física del arrastre queda verificada.
  Sigue sin poder confirmarse a simple vista en esta sesión: que el foco de teclado se vea
  correctamente.

**Corrección tras la primera revisión real del dueño (2026-09-11):** dos hallazgos concretos al
abrir la Vista de Semana. (1) "¿Por qué no se ven las 24 hrs?" — la rejilla arrancaba a las 07:00
y terminaba a las 21:00; corregido a `GRID_START_HOUR=0`/`GRID_END_HOUR=24`, cubre el día
completo. (2) Faltaban datos para revisar funcionalidades — la única reserva sembrada vivía en
2026-12-15 (fecha fija de los scripts de prueba), así que la semana de "hoy" se veía vacía;
agregado un 5º bloque al seed con **17 reservas de demostración** (fechas fijas entre 2026-09-07
y 2026-09-19, las 2 sucursales, los 3 recursos, los 4 estados reales) — el dueño pidió
explícitamente que esta siembra se quede así hasta producción, no que se borre después.
**Verificado de nuevo con reinicio limpio TOTAL**: seed idempotente (18 `bookings` estables en 2
corridas), `GET /agenda?view=week&date=2026-09-09` → 9 bloques reales en Centro, 2 en Norte;
exactamente 24 etiquetas de hora (nunca 25); sin regresión en ninguna suite. Documentado en
`DOCUMENTO_VIVO_ARQUITECTURA.md` §14.

**Fase 5b, 2º incremento — Vista de Día (2026-09-11):** `week-view.tsx` se generalizó a
`time-grid-view.tsx` (`TimeGridView`, `daysCount: 1 | 7`) — construir Día mostró que no había
nada específico de "semana" en la lógica de arrastre, mantener dos archivos habría significado
dos copias divergiendo con el tiempo. **Encontrado y corregido un bug real de zona horaria**: el
parámetro `?date=` se parseaba con `new Date('2026-09-11')` directo, que JavaScript interpreta
como medianoche UTC — en Ciudad de México (UTC-6) esa misma instante es las 18:00 del día
ANTERIOR, así que la Vista de Día mostraba el 10 de septiembre en vez del 11, sin reservas. La
Vista de Semana no lo expuso al construirse (una fecha de prueba a mitad de semana absorbe el
corrimiento de 6h sin cruzar de semana) pero el bug ya estaba ahí. Corregido con
`parseDateInZone`/`addMonthsInZone` nuevas en `calendar-nav.ts` (interpretan la fecha EN LA ZONA
del calendario, nunca en UTC ni en la zona del navegador del visitante) — el mismo patrón de bug
vivía también en `date-nav.tsx` (el botón `Hoy`, del lado del cliente). **Verificado con
reinicio limpio TOTAL**: `GET /agenda?view=day&date=2026-09-11` (viernes real) → 3 bloques reales
y la etiqueta correcta "vie 11" (antes: "jue 10" y 0 bloques); **20/20 pruebas del frontend**
(+4: 2 de `parseDateInZone`, 2 de `addMonthsInZone`, reproduciendo el bug exacto); sin regresión
en núcleo (63/63), Jest backend (51/51), `auth-sweep.sh` (27/27), `agenda-e2e.sh` (23/23).
Documentado en `DOCUMENTO_VIVO_ARQUITECTURA.md` §15.

**Lo que NO existe todavía (a propósito, por fase):** Mes/Línea de tiempo de la Fase 5b · cron /
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

**Fase 5b — Mes, luego Línea de tiempo.** Semana y Día (ambas con arrastrar y soltar real,
comparten `TimeGridView`) ya están construidas y verificadas (ver arriba y
`DOCUMENTO_VIVO_ARQUITECTURA.md` §14/§15); Agenda formaliza la lista que ya existía en 5a. Faltan
Mes (cuadrícula de solo lectura, sin arrastre de precisión horaria) y Línea de tiempo (la más
distinta: carriles por recurso, no por hora). Cada una se construye y se verifica antes de pasar
a la siguiente, mismo ritmo que el resto del proyecto.

**Cómo correr lo que ya existe:**
```
cd /home/bn/DvloprBn/dvlopmnt/Planner
# Núcleo (no necesita Docker — TypeScript puro, CommonJS):
cd omniagenda_core && npm install && npm test && npm run typecheck && npm run build
# Stack + base de datos (el backend construye el núcleo dentro de su propia imagen):
cd .. && cp .env.example .env          # solo la 1ª vez; rellena las contraseñas + secretos
docker compose up -d --build           # migra + siembra; frontend :3061 · api :3060
# En el navegador: http://localhost:3061  ->  "Entrar al panel"  ->  login con una cuenta sembrada
# Pruebas y comprobaciones (con el stack arriba):
docker compose exec -T omniagenda_backend npm test              # 51 pruebas Jest
docker compose exec -T omniagenda_backend npm run build         # typecheck completo backend
docker compose exec -T omniagenda_frontend npm test             # 20 pruebas node:test (calendario/rejilla)
docker compose exec -T omniagenda_frontend sh -lc "NODE_ENV=production npx next build"  # build frontend
bash omniagenda_backend/test/auth-sweep.sh                       # 27 casos de control de acceso
bash omniagenda_backend/test/agenda-e2e.sh                       # 23 casos de la API de agenda
docker compose exec -T omniagenda_db psql -U omniagenda_user -d omniagenda_db \
  -v ON_ERROR_STOP=1 -f - < omniagenda_backend/prisma/checks/double_booking.sql
node omniagenda_backend/prisma/checks/status-sync.mjs
docker compose down                    # detener (los datos de Postgres persisten)
```

Cuentas de prueba sembradas: `<rol>+omniagenda@example.com` (rol ∈ super/director/admin/manager/
staff/usuario), contraseña `TestOnly123!`. `staff` es `manager` de **ambas** sucursales; `usuario`
es `booker` de Centro. Cuenta extra `estilista+omniagenda@example.com` (rol `usuario`, misma
contraseña) — vinculada al recurso estilista del seed (`resources.user_id`): al entrar ve su
propia agenda combinada de las 2 sucursales en `GET /me/schedule`.

---

## 5. Preguntas abiertas que bloquean algo

**Bloqueo de la Fase 5b — CERRADO el 2026-09-11.** El dueño abrió `http://localhost:3061` y
confirmó: "se ve bien". Con una precisión clave, esperada y correcta: "aún creo que no tiene
nada, funcional pero da información del sistema y permite entrar a la zona admin" — exactamente
lo que la Fase 5a **debía** ser (cimientos: sesión real, panel protegido, selector de sucursal),
no todavía el producto real. Esa falta de contenido es el trabajo que le toca a la Fase 5b, no un
defecto de la 5a. **Fase 5b queda desbloqueada.**

La pregunta que bloqueaba antes de esta (cuál es el negocio de demostración, pregunta abierta #2
de `PLAN_DESARROLLO.md` §11) quedó **cerrada** el 2026-09-11: estética multisucursal. Las otras
cuatro de esa lista se pueden seguir respondiendo mientras tanto.

---

## Historial de cambios

| Fecha | Cambio |
|---|---|
| 2026-10-31 | **Enlace al checklist de seguridad corregido en `CLAUDE.md`.** Apuntaba a `Bridge/CHECKLIST_SEGURIDAD_PRELANZAMIENTO.md` (congelado el 2026-10-03, sin 3 vulnerabilidades registradas después); ahora apunta a `Biblioteca/10_Ingenieria/seguridad/INDICE.md`. Solo el enlace; nada más cambió. Sin comitear en el repo del proyecto (hay más cambios locales sin comitear): se comitea al correr `/barrido-docs` (su paso 4b revisa también otras reglas en conflicto). |
| 2026-09-11 | **Fase 5b, 2º incremento: Vista de Día + corrección de un bug real de zona horaria.** `week-view.tsx` se generalizó a `time-grid-view.tsx` (`TimeGridView`, `daysCount: 1\|7`) al construir Día y notar que no había nada específico de "semana" en la lógica de arrastre. **Bug encontrado y corregido**: `?date=2026-09-11` se parseaba con `new Date(...)` directo — JavaScript lo interpreta como medianoche UTC, que en Ciudad de México (UTC-6) es las 18:00 del día ANTERIOR; la Vista de Día mostraba el 10 de septiembre en vez del 11, sin reservas (la Vista de Semana no lo expuso al construirse por pura coincidencia de la fecha de prueba usada). Corregido con `parseDateInZone`/`addMonthsInZone` nuevas en `calendar-nav.ts` — el mismo patrón de bug vivía también en `date-nav.tsx` (botón "Hoy", del lado del cliente, mezclando parseo UTC con mutación en la zona del NAVEGADOR del visitante). **Verificado con reinicio limpio TOTAL**: `GET /agenda?view=day&date=2026-09-11` → 3 bloques reales y etiqueta "vie 11" correcta; **20/20 pruebas del frontend** (+4 que reproducen el bug exacto); sin regresión en núcleo (63/63), Jest backend (51/51), `auth-sweep.sh` (27/27), `agenda-e2e.sh` (23/23). Documentado en `DOCUMENTO_VIVO_ARQUITECTURA.md` §15. |
| 2026-09-11 | **Arrastrar-y-soltar de la Vista de Semana confirmado por el dueño en su navegador.** Primera vez en el proyecto que se confirma cómo se SIENTE una superficie interactiva real (antes solo login/formularios): "se siente muy natural, funciona muy bien, mueve entre columnas sin retrasos". Cierra la última pieza sin verificar del primer incremento de la Fase 5b (ver DOCUMENTO_VIVO_ARQUITECTURA.md §14). Sin cambios de código — solo constancia de la confirmación. |
| 2026-09-11 | **Vista de Semana corregida tras la primera revisión real del dueño: 24h completas + 17 reservas de demostración.** Retroalimentación positiva ("me agrada, incluso lo veo mejor formateado que el de Espiral") con dos hallazgos concretos: (1) la rejilla solo mostraba 07:00–21:00 — corregido a las 24 horas completas (`GRID_START_HOUR=0`/`GRID_END_HOUR=24` en `grid-math.ts`; las etiquetas de hora se generan sin el `+1` que habría duplicado la medianoche); (2) la única reserva sembrada vivía 3 meses en el futuro (2026-12-15, fecha fija de los scripts de prueba), así que abrir el panel en "hoy" mostraba una semana vacía — el dueño pidió explícitamente datos de prueba suficientes para revisar cada funcionalidad, **sin necesidad de borrarlos después: se quedan en el seed hasta producción**. Se agregó un 5º bloque a `seed.ts` (`DEMO_BOOKINGS`, 17 reservas con fechas FIJAS del 2026-09-07 al 2026-09-19 — nunca relativas a "hoy" en tiempo de ejecución, para que la siembra siga siendo idempotente y predecible): las 2 sucursales, los 3 recursos, y los 4 estados reales de una reserva. **Verificado con reinicio limpio TOTAL**: seed idempotente (18 `bookings` estables en 2 corridas seguidas), `GET /agenda?view=week&date=2026-09-09` real por curl → 9 bloques en Centro / 2 en Norte, exactamente 24 etiquetas de hora en el margen; sin regresión en núcleo (63/63), Jest backend (51/51), `auth-sweep.sh` (27/27), `agenda-e2e.sh` (23/23), ni las 16 pruebas del frontend. Documentado en `DOCUMENTO_VIVO_ARQUITECTURA.md` §14. |
| 2026-09-11 | **Fase 5b, 1er incremento: cimientos + Vista de Semana con arrastrar y soltar.** Con la Fase 5b desbloqueada, se construyó en orden: `ViewSwitcher`/`DateNav` (vista y fecha viven en `?view=`/`?date=`, mismo criterio que `?cal=`), `BookingBlock` (chip reutilizable) y dos archivos de aritmética pura — `lib/calendar-nav.ts` (fronteras de día/semana/mes conscientes de zona horaria, con `Intl` en vez de reimportar `@omniagenda/core` al frontend) y `lib/grid-math.ts` (convertir un arrastre en píxeles a minutos/columnas). La **Vista de Semana** es la primera vista real: arrastrar-y-soltar con **Pointer Events escritos desde cero** (nunca el HTML5 Drag&Drop nativo, sin "sensación física", ni ninguna librería) — mueve con `transform`, confirma con `PATCH /calendars/:id/bookings/:id`, y **revierte con la animación `oa-shake`** si el backend responde un conflicto real (409) o sin permiso (403): el backend sigue siendo la única fuente de verdad. Incluye una **alternativa real de teclado** (flechas, mismo camino optimista+PATCH — WCAG 2.1, no decorativa); un hallazgo real durante la construcción: envolver el bloque en OTRO `div` sin posición propia habría dejado el foco de teclado en un elemento invisible (los punteros seguirían funcionando por *bubbling*, el teclado no) — corregido pasando los manejadores directo al elemento con tamaño real. El frontend gana su **primer runner de pruebas** (`node:test`+`tsx`, igual que el núcleo): **16 pruebas** nuevas. Agenda formaliza la lista que ya existía en 5a; Día/Mes/Línea de tiempo muestran un aviso honesto de "no construida todavía" en la propia UI, nunca una vista simulada. **Verificado con reinicio limpio TOTAL**: `tsc`/`next build` limpios, login real por curl → la reserva sembrada real dentro de la rejilla con su `aria-label`, sin regresión en núcleo (63/63), Jest backend (51/51), `auth-sweep.sh` (27/27) ni `agenda-e2e.sh` (23/23). Documentado en `DOCUMENTO_VIVO_ARQUITECTURA.md` §14. **Sigue pendiente sin navegador**: la sensación física real del arrastre. |
| 2026-09-11 | **Confirmación visual de la Fase 5a recibida — Fase 5b desbloqueada.** El dueño abrió `http://localhost:3061` y confirmó: "se ve bien" — pero con una precisión importante: "aún creo que no tiene nada, funcional pero da información del sistema y permite entrar a la zona admin". Esa observación es correcta y esperada: la Fase 5a era deliberadamente solo cimientos (sesión real, panel protegido, selector de sucursal), nunca el producto — la falta de contenido sustantivo es exactamente el trabajo que le toca a la Fase 5b (las 5 vistas de calendario + arrastrar y soltar), no un defecto de lo construido. Con esta confirmación, el único bloqueo pendiente para la Fase 5b queda cerrado. |
| 2026-09-11 | **Vínculo opcional recurso↔cuenta (`resources.user_id`) + `GET /me/schedule` — construido y verificado en vivo.** Surgió de una pregunta directa del dueño al ver el login real de la Fase 5a: "¿y habría rol para el estilista?". La respuesta correcta no es un rol nuevo (RBAC contesta "qué puede hacer esta cuenta", no "qué recurso ES esta cuenta") sino un vínculo 1-a-1 opcional, **ortogonal al RBAC** — generaliza `artists.user_id` de Espiral, sin nombre de negocio. `resources.user_id String? @unique @db.Uuid` con `onDelete: SetNull` (migración `20260911141304_link_resource_to_user_account`): borrar la cuenta de login nunca borra el recurso ni su historial. `PATCH /resources/:id { user_id }` (mismo endpoint que ya editaba el recurso, sin ruta nueva) valida cuenta inexistente (404) y cuenta ya vinculada a otro recurso (409, vía el `@unique` de Postgres traducido del `P2002`); `user_id: null` desvincula. Módulo nuevo `me/` — `GET /me/schedule` sin `@Roles`/`@CalendarRole`: cualquier cuenta autenticada pregunta por SU PROPIA agenda, ancorada siempre en `caller.userId` del JWT (cero riesgo de IDOR, ningún id de ruta manipulable), cruzando TODOS los calendarios donde el recurso vinculado trabaja — un estilista de 2 sucursales ve su agenda combinada sin necesitar membresía manual en ninguna; sin vínculo → 404 con mensaje claro, nunca una lista vacía disfrazada. Seed: 7ª cuenta de prueba `estilista+omniagenda@example.com` (rol `usuario` a propósito), vinculada al recurso estilista sembrado. **Verificado con reinicio limpio TOTAL** (`down -v` + `--build`): migración desde cero, seed idempotente, login real como estilista → agenda combinada real; login como `usuario` sin vínculo → 404; conflicto/404/desvincular/re-vincular por `PATCH` — todos correctos por curl. **51/51 pruebas Jest** (+8: `resources.service.test.ts`, `me.service.test.ts` nuevos), **`agenda-e2e.sh` 23/23** (+4), `auth-sweep.sh` 27/27, checks de Fase 2 y núcleo (63/63) sin regresión. Documentado en `DOCUMENTO_VIVO_ARQUITECTURA.md` §13. **Fase 5b sigue bloqueada** — este trabajo es backend puro, no toca el frontend ni resuelve la confirmación visual pendiente. |
| 2026-09-11 | **Fase 5a (cimientos de interfaz) — construida y verificada, con un límite explícito.** Primer código real de `omniagenda_frontend` desde la Fase 0. `lib/server-fetch.ts` (Server Components, reenvía cookies httpOnly hacia `INTERNAL_API_URL`, un 401 real es la única fuente de verdad de "no hay sesión") + `lib/client-api.ts` (Client Components, habla al backend por `NEXT_PUBLIC_API_URL` con `credentials:'include'`) — dos mitades del cliente de API, escritas desde cero. `proxy.ts` (Next 16 renombró `middleware.ts`): protege `/agenda/*`, saca de `/login` a quien ya tiene sesión — chequeo optimista de cookie, la autorización real la sigue haciendo el backend. `/login`: 2 pantallas reales (credenciales → 2FA solo si `requiresTwoFactor:true`, el formulario reacciona a la API). `/agenda`: protegido, trae `/auth/me` + `/calendars` reales, `BranchSwitcher` (`?cal=` en la URL, nunca solo estado de React — el vertical es multisucursal) y lista las reservas reales de los próximos 7 días. `/estado` (el diagnóstico de la Fase 0, reubicado) y `/` (landing pública mínima) nuevos. **Lenguaje visual propio en `globals.css`**: tokens de color/duración/easing, 3 animaciones (`oa-rise-in`/`oa-shake`/`oa-spin`) solo con `transform`/`opacity`, todas con versión sin movimiento bajo `prefers-reduced-motion` — cero librería de animación, cero código de terceros. **Un dato real de por qué esto funciona**: backend y frontend comparten el hostname `localhost` en dev — las cookies ignoran el puerto, así que una cookie que puso el backend en `:3060` viaja igual cuando el navegador visita `:3061`; verificado con curl usando el mismo cookie-jar contra los dos puertos. **Límite declarado explícito**: sin herramienta de navegador en esta sesión — no se verificó la calidad visual/animación real ni que el DOM del paso de 2FA se revele bien (mismo criterio ya aplicado en `gallery`). **Verificado (todo lo que SÍ se puede sin navegador)**: `next build` producción compila limpio (0 errores TS, rutas clasificadas correctamente); `GET /agenda` sin cookie → 307 a `/login`; login real por curl (cuenta sembrada) contra el backend → esas cookies contra el frontend → `GET /agenda` → 200 con la cuenta real, las 2 sucursales reales y las reservas reales en el HTML; `GET /login` con sesión → 307 a `/agenda`; `POST /auth/logout` real → `/agenda` vuelve a bloquear. **Pendiente: Fase 5b** (las 5 vistas de calendario + arrastrar y soltar) — bloqueada hasta que el dueño confirme visualmente que 5a se ve y se siente bien. |
| 2026-09-11 | **Negocio de demostración decidido (estética multisucursal) + colchón entre calendarios construido.** El dueño preguntó cuál candidato (restaurante vs. estética, ambos multisucursal) da un caso de estudio más completo. Análisis contra el código real: el restaurante ejercitaría capacidad que la Fase 4 **ya construyó** (multi-recurso, transacción atómica); la estética exige que el motor **crezca** una capacidad nueva — un recurso (estilista) que trabaja en 2 sucursales, con un colchón de traslado entre ellas. **Decisión: estética multisucursal**; restaurante multisucursal queda anotado como caso de estudio futuro, no descartado. Construido en el acto: `resources.calendar_switch_buffer_minutes` (migración `20260911012816`, `CHECK >= 0`) generaliza `artists.location_change_buffer_minutes` de Espiral — a diferencia del colchón general (preferencia, conflicto BLANDO), este es una imposibilidad física y se reporta como conflicto **DURO**. `omniagenda_core`: `ResourceBooking`/`ConflictCandidate` ganaron `calendarId` + `crossCalendarBufferMinutes` (cambio incompatible de tipos → **v0.2.0**). `BookingsService.preflightConflict` calcula el valor efectivo como el máximo entre los recursos de la reserva. Seed actualizado: **2 sucursales** (Centro L–Sáb, Norte mar/jue) con el estilista de demo atendiendo en ambas, colchón de 45 min. **Verificado con reinicio limpio TOTAL**: núcleo **63/63** (+6), Jest **43/43** (+3), `agenda-e2e.sh` **19/19** (+3, contra el seed real: 15 min entre sucursales → 409, 45 min → 201), `auth-sweep.sh` 27/27, checks de Fase 2 verdes. |
| 2026-09-11 | **Fase 4 (API de agenda) — completa y verificada en vivo.** Se cableó `@omniagenda/core` al backend en runtime (pendiente desde Fase 2): contexto de build del backend pasó a la raíz del repo, `Dockerfile.dev` copia y construye el núcleo como paso previo (`file:../omniagenda_core`, symlink en `node_modules`). **Cambio real al núcleo que esto forzó**: dejó de ser `"type":"module"` (ESM) — ahora **CommonJS** — para que NestJS y Jest lo importen con `require()` sin gimnasia de ESM; las 57 pruebas del núcleo no se afectaron. 6 módulos nuevos: `resources` (CRUD, rol global), `calendars` (crear → el creador queda `manager`; listar según membresía/visibilidad/admin), `schedule-rules` (horario semanal por recurso-calendario), `time-off` (ausencias de calendario o de recurso), `bookings` — **el escritor único** de `bookings`+`booking_resources`, con dos capas de defensa: `evaluateConflict` del núcleo como pre-chequeo (mensaje claro) + la `EXCLUDE` de PostgreSQL dentro de `$transaction` como backstop real contra condiciones de carrera (rollback sin fila huérfana); multi-recurso atómico; mover/cancelar reescriben el espejo. `availability` — `computeAvailability` del núcleo sobre horario+ausencias+ocupado+colchón. Todo gateado por `@CalendarRole`+`CalendarAccessGuard` (o rol global donde el recurso es del sistema). La disponibilidad sigue siendo un dato personal: un `busy_only` visto sin membresía real oculta título/creador/origen. **Verificado con reinicio limpio TOTAL** (`down -v` + `--build`): `require('@omniagenda/core')` funciona en el contenedor, `nest build` 0 errores, **40 pruebas Jest** (7 archivos, +`bookings.service.test.ts`), **`agenda-e2e.sh` nuevo, 16/16 PASS** por HTTP real — el caso central: **doble-reserva por la API real → `409`**; adyacentes conviven; multi-recurso atómico; mover/cancelar liberan horario; disponibilidad real; permisos por calendario respetados. Las suites de Fases 2 y 3 siguen verdes. **Bug corregido en los propios scripts de prueba**: el flush de Redis no limpiaba nada (patrón equivocado) → `FLUSHDB`. |
| 2026-09-10 | **Fase 3 (Identidad y permisos) — completa y verificada en vivo.** Núcleo de auth **portado de OmniUser con toda su profundidad** (feedback explícito del dueño, sin base recortada): registro público, login en 3 pasos (correo→contraseña→2FA TOTP), refresh token opaco con rotación + ventana de gracia 30 s + revocación en cascada ante reuso, cambio/reset de contraseña, **2FA real** (setup con QR, 10 códigos de recuperación de un solo uso hasheados, secreto TOTP cifrado AES-256-GCM con llave distinta de `JWT_SECRET`), **jerarquía de roles** (`level` 0–5, `max_count`), **detección de fuerza bruta** (login/2FA/reuso de refresh) con conteo en Redis + alerta a admin/super, anti-enumeración. **Mejora sobre OmniUser: modelo fail-closed** — `JwtAuthGuard` es `APP_GUARD` global (toda ruta exige sesión salvo `@Public()` explícito), `RolesGuard` global; orden Throttler→JwtAuth→Roles. **Nuevo, sin equivalente en OmniUser: `calendar_members`** — permisos por calendario (viewer/booker/manager) encima del rol global: admin/director/super son manager implícito en todos; `CalendarAccessService` (exportado para Fase 4) + `@CalendarRole` + `CalendarAccessGuard` + `/calendars/:id/members`; `allowByVisibility` para lectura pública acotada; `CHECK (calendar_role IN …)` a mano. Migración `20260910213848_add_auth_and_calendar_permissions` (7 tablas + `bookings.created_by` + el `CHECK`). `seed.ts` fusionado: 6 roles + 6 cuentas de prueba (`<rol>+omniagenda@example.com`, `TestOnly123!`) + demo + 2 membresías. Deps nuevas: `@nestjs/jwt`/`passport`/`passport-jwt`/`@nestjs/throttler`/`@nest-lab/throttler-storage-redis`/`bcryptjs`/`otplib`/`qrcode`/`resend`/`ms`/`@nestjs/swagger`. **Runner de pruebas del backend: Jest + ts-jest** (NestJS DI necesita `emitDecoratorMetadata`, que `tsx`/esbuild no emite; el cliente Prisma 7 usa imports `.js` ESM → `moduleNameMapper`, misma cura que OmniUser). `tsx` se conserva para el seed. **Verificado con reinicio limpio** (`down -v` → `up`): 3 migraciones desde cero, seed OK, `nest build` 0 errores, **31 pruebas Jest** verdes (6 archivos: crypto/totp/escapeHtml portados + roles/users de integración portados + `calendar-access` nuevo), **`auth-sweep.sh` 27/27** (toda ruta protegida 401 sin sesión, `@Public()` nunca 401, RolesGuard 403, matriz por calendario correcta), **2FA end-to-end por curl** (setup→confirm→login pide 2FA→TOTP fresco→sesión; recovery code 1er uso 200 / 2º uso 401), y los `checks/` de Fase 2 siguen verdes. `RESEND_API_KEY` es placeholder (flujo real, no entrega). |
| 2026-09-10 | **Fase 2 (Persistencia + la garantía real) — completa y verificada en vivo.** `schema.prisma` con los 6 modelos del motor, todos ciegos al negocio. Migración `20260910211526_init` generada con `prisma migrate dev --create-only` y luego **editada a mano** para añadir lo que el DSL de Prisma no expresa: `CREATE EXTENSION btree_gist`, `CHECK (starts_at < ends_at)` / `CHECK (start_time < end_time)` / `CHECK (start_date <= end_date)`, y la restricción central `no_overlapping_resource_bookings` — `EXCLUDE USING gist (resource_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE (blocking = true AND status NOT IN ('cancelada','rechazada','expirada'))`. `tstzrange` es `[)` por defecto → misma semántica semiabierta que `omniagenda_core`. `seed.ts` idempotente con datos de demo **ficticios** (el repo es público): 1 calendario "Estética", 3 recursos, 3 horarios, 1 reserva de ejemplo. `prisma db seed` añadido al `command` del compose; `seed` reactivado en `prisma.config.ts`. **Dos comprobaciones committeadas** en `omniagenda_backend/prisma/checks/`: `double_booking.sql` (6 casos contra Postgres en vivo, transacción con ROLLBACK) y `status-sync.mjs` (Node sin deps: falla si el `WHERE` de la migración y `NON_BLOCKING_STATUSES` dejan de coincidir — la prueba que faltó en Espiral). **Verificado con reinicio limpio** (`down -v` → `up`): cadena `generate→migrate→seed→nest` con 0 errores; `pg_constraint` confirma el `EXCLUDE` + 3 `CHECK`; 6/6 PASS en `double_booking.sql`; PASS en `status-sync.mjs`; `/health` ok, frontend 200. Se quitó el campo obsoleto `phase:0` de `/health`. **Movido a Fase 4** (decisión consciente): el cableado del backend para importar `@omniagenda/core` en runtime — se hace donde de verdad se usa (`evaluateConflict` en la API), no antes. |
| 2026-09-10 | **Fase 1 (`omniagenda_core`) — completa, 57 pruebas verdes.** Paquete `@omniagenda/core` 0.1.0, TypeScript puro (sin Nest/Prisma/React). Módulos: `time/interval.ts` (rango semiabierto `[start,end)` en ms epoch — `overlaps` con `<`, no `<=`, para que dos citas seguidas no choquen), `time/interval-set.ts` (`normalize`/`subtract`/`intersect`/`freeWithin`/`expandEach`), `time/zoned.ts` (puente hora-de-pared ↔ instante con zona IANA vía `Intl`, sin librería; salvedad DST documentada, verticales de referencia sin DST), `recurrence/rrule.ts` (`expandRecurrence` — subconjunto RFC 5545: DAILY/WEEKLY/MONTHLY, INTERVAL, BYDAY, BYMONTHDAY con recorte a fin de mes, COUNT, UNTIL, EXDATE; avanza en reloj de pared, no en saltos fijos de 24 h; tope de 20 000 iteraciones), `recurrence/horizon.ts` (**cierra el riesgo #1**: `MATERIALIZATION_HORIZON_DAYS = 90` en una sola constante, con el razonamiento de la compensación escrito ahí), `conflict/status.ts` (`NON_BLOCKING_STATUSES = ['cancelada','rechazada','expirada']` — la constante única que la migración de Fase 2 tendrá que citar), `conflict/conflict.ts` (`evaluateConflict` — duro vs blando, multi-recurso, colchón de traslado, `ignoreBookingId` para reprogramar), `availability/weekly-hours.ts` + `availability/availability.ts` (patrón semanal JSON estilo `artist_locations.weekly_hours`; `apertura − ausencias − (ocupado+colchón) → filtrar cortos`). **Runner: `node:test` nativo + `tsx`**, cero framework (lo más coherente con "TS puro"). **Verificado**: `npm test` → 57/57 en ~185 ms; `tsc --noEmit` limpio; `npm run build` genera `dist/` sin los `.test`; smoke de `import('./dist/index.js')` → 31 exports. **Decisión §6.3 tomada**: paquete versionado, consumo local dentro del repo hasta que haya un consumidor externo; no se publica a registro todavía. `git init` local, sin remoto (el dueño creará el repo público). |
| 2026-09-10 | **Fase 0 (Infraestructura) — completa y verificada en vivo.** `docker-compose.yml` con 4 servicios calcado del patrón probado de OmniUser: `postgres:18-alpine` + `redis:8-alpine` (ambos solo `127.0.0.1`, healthchecks reales, `no-new-privileges`), backend NestJS 11 / Prisma 7 / `ioredis` sobre `node:24-alpine` (tini como PID 1, usuario `node`), frontend Next.js 16.3.1 / React 19.2.4 / Tailwind 4. `main.ts` con helmet + CORS por `ALLOWED_ORIGINS` + `ValidationPipe` whitelist. `schema.prisma` **solo generador + datasource** (modelos y el `EXCLUDE` a mano → Fase 2). `RedisService` lee host/puerto del entorno en vez de incrustarlos (mismo principio que "la zona horaria es un dato"). `omniagenda_core` queda como esqueleto de paquete `@omniagenda/core`. Puertos: db 5439 · redis 6384 · api 3060 · front 3061 · studio 5523 (reservado). **Verificación real**: `compose config` válido → 4 contenedores arriba, db+redis `healthy` → `nest build` 0 errores → `GET /health` responde `ok:true` con `postgres:"ok"` y `redis:"ok"` (tocó ambos de verdad) → `GET /` del frontend `200` con las 4 filas de estado en `ok` (Server Component resolvió el fetch por la red interna) → logs sin errores propios. `docker compose down` conserva volúmenes. |
| 2026-09-10 | **Documentación inicial v0.1 — 8 archivos.** Contexto levantado de Bridge + Espiral + Dely Doggy + OmniUser + gallery (código real, no solo documentación). Estrategia cerrada con 11 decisiones del dueño: nombre **OmniAgenda**, forma núcleo+anfitriona, solo PostgreSQL/web, naturaleza estudio/portafolio bajo `dvloprbn.dev`, alcance v1 de 4 dominios + cobro en línea, distribución por paquete npm versionado, sin migrar Espiral ni Dely Doggy, **Asclepios fuera de consideración**, animación CSS con componentes 100% propios, POS como paquete complementario abierto. Se documentó además una **regla general nueva de la carpeta `dvlopmnt/`** que el dueño quería registrada y no estaba en ningún lado: todo proyecto de esa carpeta es de estudio/demo, comparte los recursos de terceros del portafolio (Stripe, Resend), guarda solo datos de demostración con usuarios de prueba, y se publica bajo el dominio del portafolio. Puertos asignados sin choque contra los 6 proyectos existentes. **Cero código escrito.** |
