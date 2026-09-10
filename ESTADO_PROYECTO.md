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

Última actualización: **2026-09-10** (Fase 0 completa y verificada de punta a punta)

---

## 1. Dónde estamos

**Fase 0 (Infraestructura) — COMPLETA y verificada en vivo.** `docker compose up --build`
levanta los 4 servicios, y el health real confirma que se hablan entre sí.

Estructura real en disco:

| Carpeta / archivo | Estado |
|---|---|
| `docker-compose.yml` | ✅ 4 servicios (db 5439 · redis 6384 · backend 3060 · frontend 3061), Postgres/Redis solo `127.0.0.1`, `security_opt: no-new-privileges`, healthchecks reales |
| `.env.example` / `.env` | ✅ `.env` local generado con contraseñas de prueba (gitignored) |
| `omniagenda_core/` | ⏳ **esqueleto** — `package.json` (`@omniagenda/core`), `tsconfig.json`, `src/index.ts` casi vacío. La lógica se escribe en Fase 1 |
| `omniagenda_backend/` | ✅ NestJS 11 + Prisma 7 + `ioredis`, `Dockerfile.dev` (node 24, tini, usuario `node`), `main.ts` (helmet + CORS + ValidationPipe), `PrismaService` / `RedisService`, `schema.prisma` **sin modelos todavía** (Fase 2) |
| `omniagenda_frontend/` | ✅ Next.js 16.3.1 + React 19.2.4 + Tailwind 4, `next.config.ts` con cabeceras de seguridad, página de estado que consulta `/health` por la red interna |
| Documentación (8 archivos v0.1) | ✅ sin cambios respecto a la versión de estrategia |

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

**Fase 1 — `omniagenda_core`.** Álgebra de intervalos (traslape, fusión, resta de rangos,
colchones) y expansión de `RRULE`, **sin base de datos y sin framework**, dirigido por pruebas
unitarias reales. Aquí se decide también el mecanismo concreto de distribución del paquete
(`PLAN_DESARROLLO.md` §6.3).

Antes de escribir la primera regla de recurrencia hay que cerrar el **riesgo #1** del
`DOCUMENTO_VIVO_ARQUITECTURA.md` §8: el horizonte de materialización de series recurrentes (el
`EXCLUDE` de Postgres no ve ocurrencias virtuales).

**Cómo levantar lo que ya existe:**
```
cd /home/bn/DvloprBn/dvlopmnt/Planner
cp .env.example .env      # solo la primera vez; rellena las 2 contraseñas
docker compose up -d --build
# frontend: http://localhost:3061    ·    health: http://localhost:3060/health
docker compose down       # detener (los datos de Postgres persisten)
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
| 2026-09-10 | **Fase 0 (Infraestructura) — completa y verificada en vivo.** `docker-compose.yml` con 4 servicios calcado del patrón probado de OmniUser: `postgres:18-alpine` + `redis:8-alpine` (ambos solo `127.0.0.1`, healthchecks reales, `no-new-privileges`), backend NestJS 11 / Prisma 7 / `ioredis` sobre `node:24-alpine` (tini como PID 1, usuario `node`), frontend Next.js 16.3.1 / React 19.2.4 / Tailwind 4. `main.ts` con helmet + CORS por `ALLOWED_ORIGINS` + `ValidationPipe` whitelist. `schema.prisma` **solo generador + datasource** (modelos y el `EXCLUDE` a mano → Fase 2). `RedisService` lee host/puerto del entorno en vez de incrustarlos (mismo principio que "la zona horaria es un dato"). `omniagenda_core` queda como esqueleto de paquete `@omniagenda/core`. Puertos: db 5439 · redis 6384 · api 3060 · front 3061 · studio 5523 (reservado). **Verificación real**: `compose config` válido → 4 contenedores arriba, db+redis `healthy` → `nest build` 0 errores → `GET /health` responde `ok:true` con `postgres:"ok"` y `redis:"ok"` (tocó ambos de verdad) → `GET /` del frontend `200` con las 4 filas de estado en `ok` (Server Component resolvió el fetch por la red interna) → logs sin errores propios. `docker compose down` conserva volúmenes. |
| 2026-09-10 | **Documentación inicial v0.1 — 8 archivos.** Contexto levantado de Bridge + Espiral + Dely Doggy + OmniUser + gallery (código real, no solo documentación). Estrategia cerrada con 11 decisiones del dueño: nombre **OmniAgenda**, forma núcleo+anfitriona, solo PostgreSQL/web, naturaleza estudio/portafolio bajo `dvloprbn.dev`, alcance v1 de 4 dominios + cobro en línea, distribución por paquete npm versionado, sin migrar Espiral ni Dely Doggy, **Asclepios fuera de consideración**, animación CSS con componentes 100% propios, POS como paquete complementario abierto. Se documentó además una **regla general nueva de la carpeta `dvlopmnt/`** que el dueño quería registrada y no estaba en ningún lado: todo proyecto de esa carpeta es de estudio/demo, comparte los recursos de terceros del portafolio (Stripe, Resend), guarda solo datos de demostración con usuarios de prueba, y se publica bajo el dominio del portafolio. Puertos asignados sin choque contra los 6 proyectos existentes. **Cero código escrito.** |
