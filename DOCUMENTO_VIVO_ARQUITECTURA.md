# OmniAgenda — Documento vivo de arquitectura

> El **detalle técnico** de cada decisión: qué se decidió, por qué, qué se descartó y qué se
> aprendió. La estrategia vive en [`PLAN_DESARROLLO.md`](./PLAN_DESARROLLO.md); el día a día en
> [`ESTADO_PROYECTO.md`](./ESTADO_PROYECTO.md).
>
> **v0.8 — 2026-09-11.** Cada sección lleva su estado: qué está implementado y verificado en
> vivo (Fases 0–4, el negocio de demostración decidido en §11, los cimientos de interfaz en §12,
> el vínculo recurso↔cuenta en §13, y el primer incremento de la Fase 5b — cimientos + Vista de
> Semana — en §14) y qué sigue en construcción (el resto de la Fase 5b: Día/Mes/Línea de tiempo).

---

## §1. El `EXCLUDE` va sobre el recurso, no sobre la reserva

**Decidido: 2026-09-10 · Estado: implementado y verificado en vivo — Fase 2.**
Migración `omniagenda_backend/prisma/migrations/20260910211526_init/` (bloque SQL a mano al
final). Aplicada contra el Postgres real; 6 comprobaciones en vivo pasan (ver abajo).

Espiral pone la restricción sobre `appointments` con `artist_id`: un artista, una cita. Funciona
porque ahí un bloque siempre ocupa exactamente un recurso. OmniAgenda no puede asumirlo: una
reserva de restaurante para 8 personas puede ocupar dos mesas, y una cirugía ocupa médico +
enfermera + sala.

Por eso la restricción no vive en `bookings` sino en `booking_resources`, la tabla puente:

```sql
-- Requiere la extensión btree_gist para poder mezclar una comparación de
-- igualdad (=) sobre un uuid con una de traslape (&&) sobre un rango.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE booking_resources
  ADD CONSTRAINT no_overlapping_resource_bookings
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (blocking = true AND status NOT IN ('cancelada', 'rechazada', 'expirada'));
```

Consecuencias aceptadas:
- `start_time`/`end_time` se **repiten** en `booking_resources`, no solo en `bookings`. Es
  desnormalización deliberada: una restricción `EXCLUDE` no puede mirar otra tabla. Un único
  servicio escritor mantiene la coherencia — mismo principio que `EmployeeSchedulingService` de
  Dely Doggy y que `allocateAndPriceItem` para inventario.
- Una reserva multi-recurso es **atómica**: los N renglones se insertan en una sola transacción,
  y si cualquiera choca, la reserva completa falla. Es el comportamiento correcto — media mesa
  reservada no sirve.

**Descartado:** validar el traslape solo en el servicio. Es lo que Espiral documenta como
"defensa más débil": dos peticiones simultáneas pasan las dos el `if` y las dos escriben.

### Cómo quedó implementado (Fase 2)

Los 6 modelos (`resources`, `calendars`, `schedule_rules`, `time_off`, `bookings`,
`booking_resources`) más, escrito a mano en la migración:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"           ADD CONSTRAINT "bookings_time_order"           CHECK ("starts_at" < "ends_at");
ALTER TABLE "booking_resources"  ADD CONSTRAINT "booking_resources_time_order" CHECK ("start_time" < "end_time");
ALTER TABLE "time_off"           ADD CONSTRAINT "time_off_date_range_valid"    CHECK ("start_date" <= "end_date");

ALTER TABLE "booking_resources"
  ADD CONSTRAINT "no_overlapping_resource_bookings"
  EXCLUDE USING gist ("resource_id" WITH =, tstzrange("start_time", "end_time") WITH &&)
  WHERE (blocking = true AND status NOT IN ('cancelada', 'rechazada', 'expirada'));
```

`tstzrange(a, b)` es `[)` por defecto — inclusivo en el inicio, exclusivo en el fin: **la misma
semántica semiabierta que el `Interval` de `omniagenda_core`**, así que "encimado" y "pegado"
significan lo mismo en la base y en el motor.

**Dos comprobaciones committeadas** (`omniagenda_backend/prisma/checks/`):

- `double_booking.sql` — se corre contra el Postgres en vivo, en una transacción con `ROLLBACK`
  (no deja datos). 6 casos, cada uno imprime `PASS`/`FAIL`:
  1. traslape mismo recurso, ambos bloqueantes → **rechazado por PostgreSQL**
  2. reservas adyacentes (`fin == inicio`) → permitidas (semiabierto)
  3. traslape con `status='cancelada'` → permitido (el `WHERE` lo excluye)
  4. traslape con `blocking=false` → permitido
  5. mismo horario en otro recurso → libre
  6. `start_time == end_time` → rechazado por el `CHECK`
- `status-sync.mjs` — script Node sin dependencias: lee el `WHERE` de la migración y
  `NON_BLOCKING_STATUSES` de `omniagenda_core/src/conflict/status.ts` y **falla si dejan de
  coincidir**. Es la prueba que exige `PLAN_DESARROLLO.md` §3, del tipo que faltó en Espiral y
  causó una vulnerabilidad real.

**Cerrado en Fase 4:** `BookingsService` es el único servicio escritor — ver §10.

---

## §2. `blocking` como columna: el conflicto duro y el blando conviven

**Decidido: 2026-09-10 · Estado: implementado — Fase 2 (columna `booking_resources.blocking`,
default `true`, dentro del `WHERE` del `EXCLUDE`) + Fase 1 (`evaluateConflict` la distingue).**

No todos los bloques deben impedir otro bloque. Una tarea personal ("preparar el pedido") no
debería bloquear la agenda de nadie; una consulta médica sí.

La solución es una columna booleana `blocking` **dentro del `WHERE` de la restricción parcial**.
Un bloque `blocking = false` se guarda, se muestra en el calendario y se puede detectar como
conflicto para **avisar** — pero la base de datos no lo rechaza.

Esto cubre de un solo golpe los dominios 3 y 4 del alcance (turnos y tareas) sin una segunda
tabla ni una segunda restricción.

> ⚠️ **Trampa conocida, heredada de Espiral.** La condición del `WHERE` y el filtro equivalente
> en el código **tienen que decir exactamente lo mismo**. Ese desfase fue una vulnerabilidad real
> allá. Ver §3.

---

## §3. Una sola constante, y una prueba que lee la migración

**Decidido: 2026-09-10 · Estado: implementado — Fase 2.** Constante en
`omniagenda_core/src/conflict/status.ts`; la prueba que compara contra la migración es
`omniagenda_backend/prisma/checks/status-sync.mjs` (Node, sin dependencias, apto para CI). Pasa
verde.

Herencia directa de
`espiral_backend/src/appointments/appointment-status.constants.ts`, que existe por una
vulnerabilidad real reproducida en vivo el 2026-09-03: la restricción `EXCLUDE` excluía solo
`'cancelada'` mientras la aplicación filtraba distinto, así que un bloque **rechazado** seguía
ocupando su horario para siempre — y el endpoint que lo creaba era anónimo.

En OmniAgenda:
- Los estados que **no** bloquean viven en **un solo archivo** del núcleo (`omniagenda_core`), no
  en el backend — así el frontend y cualquier proyecto anfitrión leen la misma lista.
- Una prueba automatizada **abre el archivo SQL de la migración**, extrae la condición del
  `WHERE` y verifica que coincida con la constante. Si alguien cambia uno sin el otro, falla la
  suite, no la producción.

---

## §4. Recurrencia: RFC 5545 real, con ocurrencias virtuales

**Decidido: 2026-09-10 · Estado: `expandRecurrence` implementado y probado en Fase 1
(`omniagenda_core/src/recurrence/rrule.ts`, 15 pruebas). El horizonte de materialización se
implementó como constante única — ver §8, riesgo #1, ahora CERRADO en cuanto al diseño.**

Espiral resolvió recurrencia solo para gastos (`recurring_expenses`) y **documentó explícitamente
que un `RRULE` completo sería sobreingeniería ahí**. Es cierto para gastos; es insuficiente para
una agenda: "todos los martes y jueves salvo el 24 de diciembre" no se expresa con
`day_of_month`/`weekday`.

El modelo:
- La serie se guarda **una vez** como regla (`RRULE` + `DTSTART` + `EXDATE`), nunca como miles de
  filas.
- Las ocurrencias se **expanden bajo demanda** dentro de la ventana que se está mirando. Es lo que
  el calendario de Espiral ya llama *ocurrencia virtual* — sin fila propia todavía.
- Una ocurrencia se **materializa** (gana fila real) solo cuando algo la vuelve distinta de sus
  hermanas: se reserva, se mueve, se cancela sola, o alguien le escribe una nota.
- La identidad de una ocurrencia virtual es `(regla, fecha)`, exactamente el `occurrenceKey` que
  ya existe en `week-calendar.tsx` de Espiral.

**Cerrado en Fase 1 (2026-09-10):** el `EXCLUDE` no puede ver ocurrencias virtuales, así que un
bloque recurrente que debe bloquear se materializa dentro de un horizonte finito por un cron. El
horizonte vive en **una sola constante** (`recurrence/horizon.ts` →
`MATERIALIZATION_HORIZON_DAYS = 90`) con el razonamiento de la compensación escrito ahí mismo,
para que el cron, el cálculo de disponibilidad y las pruebas lean el mismo número. **Se revisa
con medición real en la Fase 2**, sobre datos sembrados — no antes. Mientras tanto, el
pre-chequeo de la aplicación (`evaluateConflict`) **sí** considera las ocurrencias virtuales que
el llamador le pase, así que el hueco entre "más allá del horizonte" y "protegido de verdad" lo
cubre la capa de aplicación, no queda descubierto.

---

## §5. Zona horaria como dato del calendario

**Decidido: 2026-09-10 · Estado: el puente puro está implementado y probado en Fase 1
(`omniagenda_core/src/time/zoned.ts`, 9 pruebas — round-trip en zona sin DST, en UTC, y en una
zona con DST incluido el hueco de "adelantar el reloj"). La parte de schema (`calendars.timezone`,
`timestamptz` vs `date`) sigue pendiente para la Fase 2.**

Hoy `America/Mexico_City` está incrustado como constante en al menos dos archivos reales
(`espiral/.../week-calendar.tsx` y `delyDoggy/src/lib/mexico-calendar.ts`). Funciona porque ambos
negocios operan en una sola zona. Un motor replicable no puede asumirlo.

Reglas:
- `calendars.timezone` es una columna (nombre IANA, ej. `America/Mexico_City`).
- Un **instante** es siempre `timestamptz`. Una **fecha pura** (un día de vacaciones) es siempre
  `date`. Nunca se comparan entre sí sin convertir — la sección de zona horaria del checklist
  existe porque mezclarlas ya desalineó nómina real en Espiral.
- Del lado del navegador, toda aritmética pasa por `Intl.DateTimeFormat` con zona explícita.
  **Prohibido** `new Date(x.getFullYear(), x.getMonth(), x.getDate())`: construye la fecha en la
  zona del proceso, que en un contenedor sin `TZ` es UTC.
- `TZ` definida explícitamente en el `docker-compose`, aunque el código ya sea correcto.

---

## §6. El núcleo puro y por qué no importa Prisma

**Decidido: 2026-09-10 · Estado: implementado y probado — Fase 1.**

`omniagenda_core` no importa Prisma, ni Nest, ni React. Recibe datos ya cargados y devuelve
decisiones. Tres razones concretas:

1. **Es lo único que se replica.** Un núcleo que importa Prisma solo corre donde corre Prisma.
2. **Se prueba sin base de datos.** 57 pruebas de casos borde de traslape, colchones, recurrencia
   y zona horaria corren en **~185 ms**, sin contenedor (`node --import tsx --test`).
3. **La puerta queda abierta gratis.** El dueño decidió *solo PostgreSQL/web*, y así se construye
   — pero no importar el ORM no cuesta trabajo extra y evita cerrar una puerta sin necesidad.

Lo que **sí** vive en el backend y no en el núcleo: el `EXCLUDE`, las transacciones, los permisos,
el cron, el correo y Stripe.

### Estructura real construida en Fase 1

```
omniagenda_core/src/
├── time/
│   ├── interval.ts        rango semiabierto [start,end) en ms epoch;
│   │                      overlaps / contains / intersection / gapMs / expand
│   ├── interval-set.ts    normalize · union · subtract · intersect ·
│   │                      freeWithin · expandEach · dropShorterThan
│   └── zoned.ts           puente hora-de-pared <-> instante, zona IANA
│                          explícita, vía Intl (sin librería). Salvedad DST
│                          documentada; verticales de referencia sin DST.
├── recurrence/
│   ├── rrule.ts           expandRecurrence(regla, ventana) — subconjunto
│   │                      RFC 5545: FREQ DAILY/WEEKLY/MONTHLY, INTERVAL,
│   │                      BYDAY, BYMONTHDAY (recorte a fin de mes), COUNT,
│   │                      UNTIL, EXDATE. Avanza en reloj de pared, no en
│   │                      saltos fijos de 24 h. Tope de 20 000 iteraciones.
│   └── horizon.ts         MATERIALIZATION_HORIZON_DAYS = 90 (cierra riesgo #1)
├── conflict/
│   ├── status.ts          NON_BLOCKING_STATUSES = ['cancelada','rechazada',
│   │                      'expirada'] — la constante única (§3 del PLAN)
│   └── conflict.ts        evaluateConflict — duro vs blando, multi-recurso,
│                          colchón, ignoreBookingId para reprogramar
└── availability/
    ├── weekly-hours.ts    expandWeeklyHours — patrón semanal JSON estilo
    │                      artist_locations.weekly_hours de Espiral
    └── availability.ts    computeAvailability = apertura − ausencias −
                           (ocupado + colchón) → filtrar cortos
```

### Decisión de distribución (§6.3 del PLAN), tomada en Fase 1

**Paquete `@omniagenda/core`, versionado (`0.1.0`), con `dist/` compilado por `tsc`.**

- **Dentro de este repo**, cuando el backend lo necesite (Fase 2), lo consume como dependencia
  local (`file:` / workspace) apuntando a `omniagenda_core` — el build de Docker del backend
  copiará `omniagenda_core/dist` a su contexto. Todavía no se cablea nada: el backend de Fase 0
  no importa el núcleo.
- **Publicar a un registro real** (privado) se hace cuando exista el **primer consumidor externo**
  — otro proyecto. No se monta infraestructura de publicación para un solo usuario, tal como dice
  el PLAN. El `package.json` ya declara `name`, `version`, `exports`, `types` y `files` para que
  ese paso sea trivial cuando toque.
- **Runner de pruebas: `node:test` nativo + `tsx`**, cero framework. Es la elección más coherente
  con el mandato "TypeScript puro, sin dependencias de infraestructura" — no hay ni Jest ni
  Vitest, solo Node y un cargador de TS.

---

## §7. La vista de agenda agrega, no decide

**Decidido: 2026-09-10 · Estado: diseño, sin implementar.**

Copiado tal cual de `AgendaService` de Dely Doggy, que lo resolvió bien: el agregador que junta
varios dominios en una sola línea de tiempo es **de solo lectura** y **no reimplementa ninguna
regla de negocio ni de autorización** — delega en el servicio dueño de cada dominio y solo da
forma al resultado.

Es la diferencia entre una vista unificada y un segundo lugar donde los permisos se pueden
desincronizar en silencio.

---

## §8. Riesgos conocidos, sin resolver todavía

| # | Riesgo | Por qué importa | Estado |
|---|---|---|---|
| 1 | Horizonte de materialización de series recurrentes (§4) | El `EXCLUDE` no ve ocurrencias virtuales | **Cerrado en diseño (Fase 1)** — constante única `MATERIALIZATION_HORIZON_DAYS=90` en `recurrence/horizon.ts`; se **mide y ajusta** en Fase 2 con datos sembrados. `evaluateConflict` ya cubre el hueco en la capa de aplicación |
| 2 | Costo de expandir `RRULE` en calendarios grandes | Una vista de mes con muchas series puede volverse cara | Abierto — `expandRecurrence` ya exige ventana acotada y tiene tope de 20 000 iteraciones; falta medir con muchas series reales (Fase 2/5) |
| 3 | Arrastrar y soltar contra conflicto duro | La animación tiene que poder "rebotar" limpio cuando la base rechaza | Abierto — Fase 5 |
| 4 | Cuentas de Stripe/Resend compartidas del portafolio | Una llave filtrada compromete a todos los hermanos | Mitigado por diseño: solo claves de prueba, secretos fuera de git |
| 5 | Cuatro dominios en v1 | Es el alcance más amplio de cualquier proyecto tuyo hasta hoy | Aceptado por el dueño; se ordena por fases (`PLAN_DESARROLLO.md` §5) |
| 6 | Rangos que cruzan medianoche (un bar que cierra a las 02:00) | `expandWeeklyHours` los rechaza hoy con error | Abierto a propósito — Espiral tampoco los soporta; se agrega cuando un caso real lo pida |
| 7 | Ambigüedad DST en `instantFromWall` (hora que ocurre dos veces / que no existe) | Una zona con horario de verano podría resolver mal en la transición | Acotado y documentado en `zoned.ts`; los verticales de referencia (México) no usan DST desde 2022 |

---

## §9. Identidad: RBAC global portado + permisos por calendario

**Decidido: 2026-09-10 · Estado: implementado y verificado en vivo — Fase 3.**

### Lo portado de OmniUser (sin cambios de lógica)

El núcleo de auth de `dvlopmnt/login` es el proyecto de referencia para esto — se portó **con
toda su profundidad**, no una base recortada (feedback explícito del dueño):

- Registro público, **login en 3 pasos** (correo → contraseña → 2FA TOTP si la cuenta lo tiene).
- Refresh token opaco (no un JWT), solo su hash SHA-256 en la base, **rotación con ventana de
  gracia de 30 s** + **revocación en cascada** de todas las sesiones ante reuso fuera de esa
  ventana.
- **2FA real (RFC 6238)**: setup con QR, 10 códigos de recuperación de un solo uso (hasheados),
  secreto TOTP **cifrado en reposo** (AES-256-GCM, llave `TOTP_ENCRYPTION_KEY` distinta de
  `JWT_SECRET`).
- **Jerarquía de roles** (`roles.level` 0–5, `max_count`): quien gestiona cuentas solo asigna un
  rol de nivel estrictamente menor al suyo; director/super son cargos de una sola persona,
  forzado de verdad.
- **Detección de fuerza bruta** (login, 2FA, reuso de refresh token) con conteo en Redis y
  alerta por correo a admin/super, una por ventana.
- Anti-enumeración: mismo mensaje "credenciales inválidas" exista o no la cuenta; `forgot-password`
  responde igual siempre.

### Lo nuevo: modelo *fail-closed* (mejora sobre OmniUser)

OmniUser aplicaba `JwtAuthGuard` por controlador (`@UseGuards`). El checklist de seguridad lo
llama *fail-open*: un endpoint que olvide su guard queda público sin que nada lo delate.
**OmniAgenda lo invierte desde la Fase 3**: `JwtAuthGuard` es `APP_GUARD` global; **toda ruta
exige sesión** salvo las marcadas `@Public()` explícito (registro, login, refresh, logout,
forgot/reset-password, `/health`). `RolesGuard` también es global y no opina si la ruta no
declaró `@Roles(...)`. Orden real de los tres guards globales: Throttler → JwtAuth → Roles.

### Lo nuevo: permisos POR CALENDARIO (`calendar_members`)

El rol global sigue mandando en lo **sistémico** (crear usuarios, editar roles). Encima de eso,
una tabla `calendar_members` otorga a un usuario un rol **sobre un calendario concreto**:

| Rol de calendario | Puede |
|---|---|
| `viewer` | ver las reservas del calendario |
| `booker` | + crear/cancelar **sus propias** reservas |
| `manager` | + gestionar todas las reservas, horarios, ausencias y la membresía del calendario |

Reglas (en `CalendarAccessService`, exportado para que la Fase 4 lo use):

- Un rol global `admin`/`director`/`super` es **`manager` implícito en TODOS los calendarios**
  (no necesita fila).
- Cualquier otra cuenta solo tiene lo que `calendar_members` le otorgue — más, **solo para
  lectura**, lo que la `visibility` del calendario permita (`public`/`busy_only` → `viewer` sin
  membresía, vía `assertCalendarAccess(..., { allowByVisibility: true })`). Esto es la superficie
  pública deliberada de la §4.1, acotada.
- `@CalendarRole('manager')` + `CalendarAccessGuard` (por ruta, necesita el `:calendarId`) es el
  mecanismo declarativo; `assertCalendarAccess(...)` es la versión imperativa para los servicios.
- `CHECK (calendar_role IN ('viewer','booker','manager'))` a mano en la migración — conjunto
  cerrado, garantizado en la base.

### Verificación (2026-09-10, reinicio limpio `down -v`)

- 3 migraciones aplican desde cero; seed corre (roles + 6 cuentas de prueba + demo + membresías).
- `nest build` → **0 errores**; **31 pruebas Jest** verdes (6 archivos: 3 puros portados —
  crypto/totp/escapeHtml — + 2 de integración portados — roles/users service — + 1 nuevo —
  `calendar-access.service`, la matriz de permisos).
- **Barrido de control de acceso** (`omniagenda_backend/test/auth-sweep.sh`, método del
  checklist): **27/27 PASS** — toda ruta protegida da 401 sin sesión; las `@Public()` nunca dan
  401; `usuario` global recibe 403 en `/users` (RolesGuard); la matriz por calendario
  (admin global = manager implícito; `booker` cubre `viewer` pero no `manager`; no-miembro sin
  acceso a un calendario no público) se comporta como se diseñó.
- **2FA end-to-end por curl**: setup → confirm (10 códigos) → login pide 2FA → login/2fa con TOTP
  fresco emite sesión → `/auth/me` 200; código de recuperación: 1er uso 200, 2º uso del mismo 401.
- Los checks de la Fase 2 (`double_booking.sql` 6/6, `status-sync.mjs`) siguen verdes.

**Herramienta de runtime, no de test unitario:** el runner de Jest es solo para el backend
(NestJS DI necesita `emitDecoratorMetadata`, que `tsx`/esbuild no emite — por eso Jest+ts-jest
aquí y `node:test`+`tsx` en `omniagenda_core`). El cliente de Prisma 7 generado usa imports `.js`
estilo ESM; se resuelve con `moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" }` — misma cura
que OmniUser documentó.

### Pendiente (Fase 4+)

Los endpoints de reservas/horarios/disponibilidad que **consumen** `CalendarAccessService` y
`@omniagenda/core` en runtime (el cableado del paquete al backend se hace ahí). Frontend de
login (Fase 5). `RESEND_API_KEY` real de prueba (hoy placeholder — el flujo de correo es real
pero no entrega).

---

## §10. La API de agenda: el cableado del núcleo y el escritor único

**Decidido: 2026-09-10/11 · Estado: implementado y verificado en vivo — Fase 4.**

### Cablear `@omniagenda/core` al backend (pendiente desde la Fase 2)

El contexto de build del backend cambió de `./omniagenda_backend` a la **raíz del repo**
(`docker-compose.yml`), para que su `Dockerfile.dev` pueda copiar y construir
`omniagenda_core` como paso previo:

```dockerfile
WORKDIR /usr/src/omniagenda_core
COPY omniagenda_core/package*.json ./
RUN npm install
COPY omniagenda_core/ ./
RUN npm run build         # genera dist/, lo que el backend importa

WORKDIR /usr/src/app
COPY omniagenda_backend/package*.json ./
RUN npm install            # resuelve "@omniagenda/core": "file:../omniagenda_core"
```

`npm install` con un `file:` a un directorio crea un **symlink** (`node_modules/@omniagenda/core`
→ `/usr/src/omniagenda_core`), no una copia — vive en la imagen, no en el volumen montado, así
que cambiar el núcleo exige `docker compose build omniagenda_backend` (no hot-reload). Es un
costo aceptado: el núcleo es la parte más estable del proyecto.

**Cambio real al núcleo que esto forzó:** `omniagenda_core` pasó de `"type": "module"` (ESM) a
**CommonJS** — se quitó ese campo del `package.json` y `verbatimModuleSyntax` a `false` en su
`tsconfig`. Con `module: "nodenext"` y sin `"type": "module"`, `tsc` emite CJS y los
especificadores `.js` del código siguen resolviendo a los `.ts` de origen. Motivo: NestJS (CJS) y
Jest (vía `ts-jest`) importan el núcleo con `require()`; ESM puro habría exigido
`--experimental-vm-modules` también para el núcleo y complicado el `moduleNameMapper` ya
necesario para el propio cliente de Prisma 7. Las 57 pruebas del núcleo (`node:test`+`tsx`) no se
vieron afectadas — corren igual sobre CJS.

### El modelo, ciego al negocio, con permisos por calendario

6 módulos nuevos, todos gateados por `@CalendarRole(...)` + `CalendarAccessGuard` (o por rol
global donde el recurso es del sistema, no de un calendario):

| Módulo | Ruta | Acceso |
|---|---|---|
| `resources` | `/resources` | lectura: cualquier sesión · escritura: rol global `manager`+ |
| `calendars` | `/calendars` | lectura: propia (miembro/`public`/admin+) · creación: rol global `staff`+ (el creador queda `manager`) · edición/borrado: `manager` del calendario |
| `schedule-rules` | `/calendars/:id/schedule-rules` | lectura: `viewer` · escritura: `manager` |
| `time-off` | `/calendars/:id/time-off` | lectura: `viewer` · escritura: `manager` |
| `bookings` | `/calendars/:id/bookings` | lectura: `viewer` (+ visibilidad) · creación/movimiento propio: `booker` · cualquier operación: `manager` |
| `availability` | `/calendars/:id/availability` | `viewer` (+ visibilidad) |

### `BookingsService`: el escritor único

Cierra el pendiente de §1. Cada escritura de `bookings`/`booking_resources` pasa por **una** de
tres operaciones (`create`/`reschedule`/`changeStatus`), siempre dentro de `$transaction`, y con
**dos capas de defensa contra doble-reserva**:

1. **Pre-chequeo de aplicación** — `evaluateConflict` de `@omniagenda/core`, contra las
   `booking_resources` existentes que se traslapan (ventana ± colchón ± 24 h de margen). Da un
   mensaje claro y **ya considera lo que el llamador le pase** — el hueco del riesgo #1
   (ocurrencias recurrentes más allá del horizonte de materialización) se cierra aquí cuando la
   Fase 6 empiece a pasarle ocurrencias virtuales.
2. **La `EXCLUDE` de PostgreSQL, dentro de la transacción** — la garantía real contra la condición
   de carrera. Si dos peticiones pasan el pre-chequeo casi al mismo tiempo, **una de las dos
   pierde en la base**, la transacción entera hace `ROLLBACK` (no deja una fila huérfana en
   `bookings`) y el error se traduce a `409` (`translateWriteError`, matching sobre
   `no_overlapping_resource_bookings`/`23P01`).

Una reserva multi-recurso es atómica por construcción: los N renglones de `booking_resources` se
crean en el mismo `createMany` dentro de la transacción — si cualquiera choca, ninguno se guarda.

### La disponibilidad sigue siendo un dato personal

`AvailabilityService`/`BookingsService.list` implementan §4.1 en código: un calendario
`busy_only` visto por alguien que **no** es miembro real (solo entra por visibilidad) recibe los
bloques **sin** `title`/`created_by`/`source_*` — únicamente el rango de tiempo, el estado y qué
recursos ocupa. El endpoint de disponibilidad **nunca** devuelve las reservas en sí, solo los
huecos libres que resultan de restarlas.

### Verificación (2026-09-10/11, reinicio limpio total `down -v` + rebuild)

- `require('@omniagenda/core')` funciona dentro del contenedor del backend; `nest build` → **0
  errores**.
- **40 pruebas Jest** (7 archivos: los 6 de la Fase 3 + `bookings.service.test.ts` nuevo — mismo
  criterio de integración real, sin mocks de Prisma): transacción con rollback real ante
  traslape, mirror sincronizado, multi-recurso atómico, mover/cancelar, colchón, bloque
  no-bloqueante, ventana inválida.
- **`omniagenda_backend/test/agenda-e2e.sh`, 16/16 PASS** contra la API real por HTTP — el caso
  central: **una reserva solapada por la API real recibe `409`**; adyacentes conviven;
  multi-recurso atómico; mover a un hueco libre y a uno ocupado; cancelar libera el horario;
  disponibilidad calculada de verdad por `@omniagenda/core`; matriz de permisos por calendario en
  los endpoints de reservas.
- Las suites de Fases 2 y 3 (`double_booking.sql`, `status-sync.mjs`, `auth-sweep.sh`) siguen
  verdes tras el reinicio total.
- **Hallazgo de los propios scripts de verificación, corregido**: el flush de Redis usaba un
  patrón (`--scan --pattern "*login*"`) que no coincide con las llaves reales del throttler de
  `@nest-lab/throttler-storage-redis` — nunca limpiaba nada, y correr dos scripts seguidos hacía
  que el límite de 5 login/min tronara con `429` (no una falla de la app: el limitador
  funcionando). Corregido a `FLUSHDB` — seguro aquí porque Redis solo guarda contadores efímeros.

---

## §11. El negocio de demostración: por qué estética y no restaurante

**Decidido: 2026-09-11 · Estado: decisión cerrada + capacidad nueva del núcleo implementada y
verificada en vivo.**

### La pregunta real

Al terminar la Fase 4, `PLAN_DESARROLLO.md` §11 (pregunta #2) se volvió bloqueante: la API es
ciega al negocio, pero una pantalla (Fase 5) no puede serlo. El dueño preguntó, textualmente,
cuál de los dos candidatos — **restaurante multisucursal** o **estética multisucursal** — es un
caso de estudio "más completo", razonando que más funcionalidades ahora facilita adaptar mejor
después.

### Por qué "más funcionalidades" no es la métrica correcta

Ambos verticales son legítimamente ricos. La pregunta que sí decide algo es otra: **¿cuál de los
dos obliga al MOTOR a crecer una capacidad genuinamente nueva, en vez de solo ejercitar lo que ya
existe?** — porque esa es la métrica real de "qué tan bien vamos a poder adaptar esto después".

Verificado contra el código real antes de responder:

| | Restaurante multisucursal | Estética multisucursal |
|---|---|---|
| ¿Las mesas/estilistas se mueven entre sucursales? | No — una mesa vive en una sola sucursal para siempre | **Sí** — un estilista real trabaja días distintos en sucursales distintas |
| ¿El motor YA soporta que un recurso tenga horarios distintos en 2 calendarios? | (no aplica) | **Sí, desde la Fase 2** — `schedule_rules` ya es único por `(resource_id, calendar_id)` |
| ¿Le falta algo al motor para modelar el vertical? | No — "multisucursal" ahí es solo *más calendarios en paralelo* | **Sí** — el colchón de traslado **entre** calendarios, que hoy no existe en ninguna parte |
| Multi-recurso (unir mesas) | Ejercita algo que la Fase 4 **ya construyó** | — |
| Depósito al agendar | Poco natural para una reservación de mesa normal | Natural — mismo flujo que Espiral ya valida en producción |
| Turnos de personal | Más rico (cocina, meseros, hostess) | Más simple |

Restaurante gana en turnos y en la narrativa de lista de espera. Pero su rasgo distintivo
(multi-recurso, transacción atómica) **ya lo construyó la Fase 4** — lo demostraría, no lo haría
crecer. Estética exige una pieza que **no existe todavía**: generalizar
`artists.location_change_buffer_minutes` de Espiral (hoy atado a un negocio de tatuajes) en una
capacidad real del núcleo. Esa es la clase de generalización que justifica que OmniAgenda exista.

**Decisión del dueño (2026-09-11): estética multisucursal.** Restaurante multisucursal queda
anotado como caso de estudio futuro real, no descartado — solo fuera de este proyecto.

### La capacidad nueva: colchón ENTRE calendarios

Generaliza `artists.location_change_buffer_minutes` + `AppointmentsService.assertLocationBuffer`
de Espiral. Diferencia clave respecto al colchón general que ya existía desde la Fase 1
(`ConflictCandidate.bufferMinutes`, una **preferencia** — reportada como conflicto BLANDO):
cambiar de sucursal sin tiempo suficiente es una **imposibilidad física** — nadie se
tele-transporta — así que se reporta como conflicto **DURO**, igual que un traslape real.

**Dónde vive:**

- `resources.calendar_switch_buffer_minutes` (migración `20260911012816`, `CHECK >= 0`) — es una
  propiedad del **recurso**, no de quien agenda (igual que en Espiral: el artista lo configura
  una vez, no se decide por cita). `0` (default) = el recurso no viaja entre calendarios, o no
  importa si lo hace.
- `omniagenda_core`: `ResourceBooking`/`ConflictCandidate` ganaron un campo `calendarId`, y
  `ConflictCandidate` un `crossCalendarBufferMinutes`. `evaluateConflict` solo aplica este colchón
  cuando el vecino es de **otro** calendario que el de la reserva candidata; el colchón general
  sigue aplicando sin importar el calendario. **Cambio incompatible en los tipos públicos** →
  `omniagenda_core` subió a `0.2.0`.
- `BookingsService.preflightConflict`: calcula el valor efectivo como el **máximo** entre los
  recursos que la reserva involucra — simplificación deliberada, documentada, igual criterio que
  ya se usaba para el colchón general (un solo valor por reserva, no uno por recurso).

**Verificado en vivo (reinicio limpio total, `down -v` + `--build`):**
- Núcleo: **63 pruebas** (57 + 6 nuevas de colchón entre calendarios).
- `bookings.service.test.ts`: 3 pruebas nuevas de integración (recurso con colchón de 30 min:
  vecino de otra sucursal a 15 min → 409; a 45 min → ok; el mismo margen corto en la **misma**
  sucursal no dispara nada).
- `agenda-e2e.sh` §6.5, contra el seed real (estilista de demo, colchón de 45 min, atiende en
  Centro L–Sáb y Norte mar/jue): una reserva en Centro seguida de otra en Norte 15 minutos
  después → **409**; con 45 minutos de margen → **201**.
- Las suites completas (Jest 43/43, `auth-sweep.sh` 27/27, checks de Fase 2) siguen verdes.

### Lo que esto deja listo para la Fase 5

El seed ahora siembra **2 sucursales reales** ("Centro" y "Norte", ficticias) con un estilista que
trabaja en ambas — la interfaz de la Fase 5 tiene, desde el día uno, un caso real de multisucursal
que mostrar, no uno que haya que inventar después.

---

## §12. Fase 5a — cimientos de interfaz (login, sesión, panel protegido)

**Decidido: 2026-09-11 · Estado: implementado y verificado — con un límite real de verificación,
explicado abajo.**

### Un límite que hay que decir en voz alta antes de seguir

**No hay una herramienta de navegador disponible en esta sesión.** Todo lo que se puede verificar
por HTTP/build/logs SÍ se verificó de verdad (ver la lista abajo) — pero la calidad visual real
(¿se ve profesional?, ¿la animación se siente fluida?, ¿hay algo roto visualmente que curl no
puede ver?) **no está confirmada**. Mismo criterio ya aplicado en el proyecto `gallery` (memoria
del dueño): se construye real, se verifica lo verificable, y se marca explícito lo que falta
confirmar a simple vista. El dueño confirma esto último al abrir `http://localhost:3061`.

### Qué se construyó

La Fase 5 completa (`PLAN_DESARROLLO.md` §8) son las 5 vistas de calendario + arrastrar y soltar.
Ninguna de esas vistas puede existir sin lo que **sí** se construyó ahora — la Fase 5a, sus
cimientos:

- **Cliente de API real**, dos mitades (mismo patrón ya probado en OmniUser, reescrito desde cero
  para este proyecto — nunca se copió su código):
  - `lib/server-fetch.ts` — para Server Components. Reenvía las cookies httpOnly de la petición
    entrante hacia el backend por `INTERNAL_API_URL` (la red interna de Docker); un 401 real del
    backend es la única señal de "no hay sesión", nunca un estado duplicado en Next.
  - `lib/client-api.ts` — para Client Components (el formulario de login). Habla directo al
    backend por `NEXT_PUBLIC_API_URL` (el puerto expuesto al host) con `credentials:'include'`.
- **`proxy.ts`** (Next 16 renombró `middleware.ts`): chequeo optimista de la cookie `access_token`
  — protege `/agenda/*`, y saca de `/login` a quien ya tiene sesión. La autorización REAL la
  sigue haciendo el backend en cada request.
- **Login real de 2 pantallas** (`app/login/`): correo+contraseña primero; el código de 2FA
  aparece SOLO si `POST /auth/login/step2` responde `requiresTwoFactor:true` — el formulario
  reacciona a la API, nunca decide por su cuenta si una cuenta tiene 2FA.
- **`/agenda` protegido** (`app/agenda/layout.tsx` + `page.tsx`): confirma sesión + trae los
  calendarios reales del usuario + un selector de sucursal (`BranchSwitcher`, el vertical elegido
  en §11 es multisucursal) que vive en la URL (`?cal=`), nunca solo en estado de React. La página
  por default lista las reservas reales de los próximos 7 días — prueba end-to-end de que la
  cadena sesión→API→datos funciona; **no** es todavía la vista de calendario real (eso es 5b).
- **Lenguaje visual propio, CSS puro** (`globals.css`): tokens de color/duración/easing propios;
  animaciones (`oa-rise-in`, `oa-shake`, `oa-spin`) escritas solo con `transform`/`opacity`,
  **todas** con su versión sin movimiento detrás de `prefers-reduced-motion: reduce`
  (`PLAN_DESARROLLO.md` §9 — componentes 100% propios, cero librería de animación).

### Un detalle real de por qué esto funciona: las cookies ignoran el puerto

El backend (`:3060`) y el frontend (`:3061`) son **el mismo hostname** (`localhost`) en
desarrollo. Un navegador (y `curl`, verificado) decide a quién le manda una cookie por
**hostname + ruta**, nunca por puerto — así que una cookie httpOnly que puso el backend al
responder el login SÍ viaja de vuelta cuando el navegador visita el frontend después. Es lo que
hace que `serverFetch` (dentro del contenedor del frontend, leyendo `cookies()` de la petición
entrante) encuentre la sesión real sin ningún paso extra. Mismo patrón que ya probó OmniUser.

### Verificado en vivo (2026-09-11)

- `next build` (modo producción) → **compila limpio**, TypeScript sin errores, rutas clasificadas
  correctamente (`/` estática, `/login`/`/estado`/`/agenda` dinámicas, `proxy.ts` registrado) —
  la comprobación exacta que pide la lección #11 del Bridge.
- `GET /agenda` sin cookie → **307 a `/login?next=%2Fagenda`** (la protección real de `proxy.ts`).
- **Login real por curl** contra el backend (`:3060`) con una cuenta sembrada → cookies guardadas
  → esas MISMAS cookies contra el frontend (`:3061`) en `GET /agenda` → **200**, con el nombre
  real de la cuenta, las 2 sucursales reales y "Próximos 7 días" en el HTML devuelto.
- `GET /login` con sesión activa → **307 a `/agenda`** (protección inversa).
- `POST /auth/logout` real → la cookie se limpia → `GET /agenda` vuelve a dar **307 a `/login`**.
- Lo que **no** se verificó (requiere navegador): que el formulario de 2FA se revele
  correctamente en el DOM tras la respuesta del paso 2 (la lógica de React se revisó a mano, no
  se ejecutó), y toda la calidad visual/animación real.

### Confirmación visual del dueño (2026-09-11) — el límite anterior queda cerrado

El dueño abrió `http://localhost:3061` y confirmó: **"se ve bien"**. Con una observación
correcta y esperada: **"aún creo que no tiene nada, funcional pero da información del sistema y
permite entrar a la zona admin"**. Eso es exactamente lo que la Fase 5a debía ser — cimientos
(sesión real, panel protegido, selector de sucursal), nunca el producto real. La falta de
contenido sustantivo que el dueño notó es el trabajo que le toca a la Fase 5b, no un defecto de
lo ya construido. Con esta confirmación, **la Fase 5b queda desbloqueada**.

### Fase 5b — en construcción, una vista a la vez

Las 5 vistas de calendario (día/semana/mes/agenda/línea de tiempo) + arrastrar y soltar. Esta es
la parte que de verdad demuestra "animación de grado profesional" y la que llena de contenido
real el panel — 5a solo construyó el piso sobre el que se para. Orden: cimientos compartidos +
**Semana** (hecha, ver §14) → Día → Mes → Agenda (formaliza la lista que ya existía en 5a) →
Línea de tiempo.

---

## §13. Vínculo opcional recurso↔cuenta (`resources.user_id`)

**Decidido: 2026-09-11 · Estado: implementado y verificado en vivo (curl + Jest + rebuild
limpio).**

### El problema real: ¿el estilista puede entrar y ver SU agenda?

Surgió de una pregunta directa del dueño ("¿y habría rol para el estilista?") al ver el login
real de la Fase 5a. La respuesta correcta **no** es un rol nuevo — RBAC (`roles.level`) contesta
"¿qué puede hacer esta cuenta en el sistema?", una pregunta totalmente distinta a "¿qué recurso
agendable ES esta cuenta?". Mezclar las dos habría obligado a inventar un rol "estilista" que no
aporta ningún permiso real, solo una etiqueta.

### La decisión: un vínculo 1-a-1, opcional, ortogonal al RBAC

Generaliza `artists.user_id` de Espiral (ahí, una cuenta *artista* apuntaba a su fila en
`artists`). Aquí el mismo patrón se separa de cualquier nombre de negocio:

```prisma
model resources {
  // ...
  user_id String? @unique @db.Uuid
  users   users?  @relation(fields: [user_id], references: [user_id], onDelete: SetNull)
}
```

- **`String?`** — la gran mayoría de recursos (salas, estaciones, equipo) nunca tienen cuenta de
  login. Vincular es la excepción, no la regla.
- **`@unique`** — una cuenta representa como máximo UN recurso. Sin esto, dos recursos podrían
  reclamar la misma cuenta y `GET /me/schedule` no sabría cuál devolver.
- **`onDelete: SetNull`** — borrar la cuenta de login (ej. el estilista deja la empresa) **nunca**
  borra el recurso ni su historial de reservas. El recurso simplemente queda sin cuenta vinculada,
  tal como nace cualquier recurso nuevo.
- **Sin rol especial**: cualquier cuenta autenticada, del nivel que sea, puede representar un
  recurso. El vínculo lo crea un manager vía `PATCH /resources/:id { user_id }` — la misma ruta
  que ya existía para editar el recurso, sin endpoint nuevo.

### `GET /me/schedule` — la vista personal, sin riesgo de IDOR

`MeService.schedule(userId, from, to)` ancla la consulta SIEMPRE en `caller.userId` (extraído del
JWT), nunca en un parámetro de ruta — no existe ningún id manipulable por el cliente para pedir la
agenda de otro recurso. Si la cuenta no representa ningún recurso, responde **404** con un mensaje
que explica el porqué, nunca una lista vacía disfrazada de "no tienes nada" (mismo criterio de
"fail-closed con mensaje claro" que ya rige el resto de la Fase 3).

La consulta cruza **todos los calendarios** donde ese recurso tiene reservas — un estilista de 2
sucursales ve su agenda combinada con una sola cuenta, sin que nadie tenga que darle membresía de
calendario (`calendar_members`) en ninguna de las dos. Eso es lo que hace este vínculo
genuinamente distinto de `BookingsService.list` (acotado a un calendario, gateado por
`@CalendarRole`): resuelve "¿qué tengo yo, en cualquier lugar donde trabajo?", no "¿qué hay en
este calendario?".

### Validaciones reales en `ResourcesService.update`

- Vincular a una cuenta que no existe → **404** ("La cuenta a vincular no existe").
- Vincular a una cuenta que YA representa otro recurso → el `@unique` de Postgres dispara
  `P2002`, capturado y traducido a **409** ("Esa cuenta ya está vinculada a otro recurso") — la
  base de datos garantiza la unicidad, el servicio solo la traduce a un error legible, mismo
  patrón que el `EXCLUDE` de reservas.
- `user_id: null` desvincula explícitamente; `class-validator` con `@IsOptional()` ya trata `null`
  como "sin más validación" antes de llegar al `@IsUUID('4')`.

### Verificado en vivo (2026-09-11, rebuild limpio desde cero)

- Migración `20260911141304_link_resource_to_user_account` aplica limpio sobre una base de datos
  recién creada (`docker compose down -v` + `up --build` + `migrate deploy`).
- Seed (`prisma/seed.ts`, parte 4) vincula la cuenta `estilista+omniagenda@example.com` al recurso
  estilista sembrado, sin fallar en una corrida repetida (idempotente).
- Login real como `estilista` → `GET /me/schedule?from=...&to=...` → devuelve la reserva sembrada
  real, con el nombre correcto del calendario.
- Login real como `usuario` (sin recurso vinculado) → `GET /me/schedule` → **404** con el mensaje
  esperado.
- `PATCH /resources/:id` con un `user_id` ya vinculado a otro recurso → **409**; con un `user_id`
  inexistente → **404**; con `null` (desvincular) y luego con el id real de nuevo (re-vincular) →
  **200** en ambos.
- Jest: `test/resources.service.test.ts` (5 casos: vincular, conflicto por duplicado, 404 por
  cuenta inexistente, desvincular+re-vincular, `SetNull` real al borrar la cuenta) y
  `test/me.service.test.ts` (3 casos: 404 sin vínculo, agenda combinada de 2 calendarios reales,
  filtro correcto de rango `[from, to)`) — **51/51 tests del backend en verde**.
- `test/agenda-e2e.sh` §6.6 (4 casos nuevos contra el stack real) y `test/auth-sweep.sh` (27
  casos) sin regresión.

---

## §14. Fase 5b, primer incremento: cimientos de las 5 vistas + Vista de Semana

**Decidido: 2026-09-11 · Estado: implementado y verificado — cimientos completos, primera de las
5 vistas (Semana) funcional con arrastrar-y-soltar real. Día/Mes/Línea de tiempo aún no
construidas (marcadas honestamente como pendientes en la UI, nunca simuladas); Agenda formaliza
la lista que ya existía en la Fase 5a.**

### Arquitectura: estado en la URL, igual que el selector de sucursal

`?view=semana|dia|mes|agenda|linea&cal=...&date=...` — la vista y la fecha activas viven en la
URL, mismo criterio que `?cal=` de `BranchSwitcher` (Fase 5a): un enlace a "la vista de semana del
15 de diciembre en Sucursal Centro" se puede compartir o recargar tal cual, nunca solo estado de
React. `ViewSwitcher` y `DateNav` (nuevos) siguen ese patrón exacto.

### Por qué Pointer Events escritos desde cero, y no el HTML5 Drag & Drop nativo

El Drag & Drop nativo del navegador (`draggable="true"`, eventos `dragstart`/`dragover`/`drop`)
existe, pero su retroalimentación visual es tosca por diseño (un "fantasma" semitransparente que
el navegador dibuja, sin control real sobre su posición ni su física) — no puede cumplir el
requisito de "sensación física" de `PLAN_DESARROLLO.md` §9, y ninguna librería de terceros es
aceptable ahí tampoco. La alternativa: **Pointer Events** (`pointerdown`/`pointermove`/`pointerup`
+ `setPointerCapture`) manejados a mano en `week-view.tsx`, moviendo el bloque con
`transform: translate()` en tiempo real (nunca `top`/`left` en cada frame — serían recálculo de
layout, no composición en la GPU) y soltando en un horario "limpio" (redondeado a 15 min) al
soltar el puntero.

**El backend sigue siendo la única fuente de verdad.** El movimiento es optimista (el bloque se
ve en su nueva posición de inmediato), pero se confirma con `PATCH
/calendars/:id/bookings/:id` — si el backend responde con un conflicto real (`409`, la `EXCLUDE`
o el colchón entre calendarios) o sin permiso (`403`), el bloque **regresa** a su lugar con la
animación `oa-shake` que ya existía desde la Fase 5a. El frontend nunca decide por su cuenta que
un horario es válido.

### Alternativa de teclado — no decorativa

`PLAN_DESARROLLO.md` §2.D exige "teclado completo" (WCAG 2.1), no una casilla marcada sin
sustancia. Con un bloque enfocado (`tabIndex`, `role="button"`, `aria-label` que explica la
acción), las flechas mueven la reserva por el **mismo camino** que el arrastre con mouse
(optimista + `PATCH` + revertir si falla) — nunca queda como la única forma real de reprogramar
sea con mouse o touch. Un hallazgo real durante la construcción: envolver el bloque arrastrable en
OTRO `div` sin posición propia lo habría dejado colapsado a 0×0 — los punteros seguirían
funcionando (el evento burbujea por el DOM sin importar el tamaño visual del contenedor), pero el
foco de teclado habría caído en un elemento invisible, sin anillo de foco visible en ningún lugar
real. Se corrigió pasando los manejadores directo al elemento con posición y tamaño reales
(`BookingBlock` los recibe como props normales, sin envoltorio).

### Aritmética de calendario: `Intl`, no `@omniagenda/core`, y por qué

El frontend necesita etiquetas legibles con zona horaria real (nombre de día, hora, límites de
"esta semana" en la zona del calendario) — la MISMA primitiva de plataforma (`Intl`) que
`omniagenda_core/src/time/zoned.ts` envuelve para el backend, pero escrita de nuevo en
`lib/calendar-nav.ts` en vez de importar el paquete: traer `@omniagenda/core` al frontend habría
obligado a mover su build de Docker a la raíz del repo (el mismo cambio de infraestructura que ya
se hizo para el backend en la Fase 4), solo para un puñado de funciones de etiquetado — el
frontend no necesita la aritmética exacta de recurrencia que sí justifica el núcleo. Nunca se trata
de código de terceros: es un envoltorio delgado, propio, sobre una API nativa de la plataforma.
Separado en un segundo archivo puro (`lib/grid-math.ts`) el otro tipo de aritmética: convertir un
desplazamiento de arrastre en píxeles a minutos/columnas — deliberadamente sin DOM ni React, para
poder probarlo con `node:test` sin navegador.

### El frontend gana un runner de pruebas real

Hasta ahora `omniagenda_frontend` no tenía ningún test — la lógica de la Fase 5a era demasiado
poco (fetch + render) para justificarlo. La aritmética de calendario y de rejilla sí es lógica
real con casos límite reales (cruces de mes, redondeo de arrastre), así que se le da el MISMO
runner que ya usa `omniagenda_core` — `node:test` nativo + `tsx`, cero framework — en vez de traer
Jest solo para el frontend.

### Verificado (2026-09-11, rebuild limpio desde cero — `down -v` + `--build`)

- `tsc --noEmit` limpio; `next build` producción compila sin errores, rutas siguen clasificadas
  correctamente.
- **26 pruebas `node:test`** nuevas en `omniagenda_frontend/test/`: 10 de `calendar-nav.ts`
  (medianoche/inicio de semana/inicio de mes en zona real, ventanas de vista sin huecos) + 6 de
  `grid-math.ts` (redondeo de arrastre, conversión px↔minutos, recorte a la rejilla visible).
- Con el stack completo reconstruido desde cero (migraciones + seed desde vacío): login real por
  curl → `GET /agenda?view=week&cal=...&date=2026-12-15` → `200`, con la reserva real sembrada
  ("Corte y peinado (demo)") renderizada dentro de la rejilla y su `aria-label` de accesibilidad
  presente en el HTML devuelto.
- `?view=agenda` conserva el comportamiento real de la Fase 5a (la lista de reservas, ahora
  formalizada como una vista más); `?view=day|month|timeline` responden `200` con un aviso
  honesto de "todavía no construida" en vez de simular una vista que no existe.
- Suites existentes sin regresión tras el rebuild total: núcleo 63/63, backend Jest 51/51,
  `auth-sweep.sh` 27/27, `agenda-e2e.sh` 23/23, checks SQL de Fase 2.
- **Lo que sigue sin poder verificarse (sin navegador en esta sesión)**: la sensación física real
  del arrastre, que el `transform` se sienta a 60fps, y que el foco de teclado se vea correctamente
  en el DOM real — mismo límite ya declarado desde la Fase 5a, ahora aplicado a una superficie
  interactiva de verdad (antes solo aplicaba a formularios y navegación).

### Pendiente

Día, Mes, Línea de tiempo (en ese orden) — cada una reutilizando `BookingBlock`,
`calendar-nav.ts` y `grid-math.ts` ya construidos aquí.
