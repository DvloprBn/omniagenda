# OmniAgenda — Plan de desarrollo

> Estrategia, alcance y decisiones que **no cambian seguido**. El día a día vive en
> [`ESTADO_PROYECTO.md`](./ESTADO_PROYECTO.md); el detalle técnico de cada decisión, en
> [`DOCUMENTO_VIVO_ARQUITECTURA.md`](./DOCUMENTO_VIVO_ARQUITECTURA.md).
>
> **v0.4 — 2026-09-11.** Estrategia cerrada; Fases 0 a 4 construidas y verificadas
> (ver `ESTADO_PROYECTO.md`). Siguiente: Fase 5 (interfaz) — bloqueada por la pregunta abierta #2
> (§11): el negocio de demostración concreto.

---

## §0. Origen y naturaleza

### §0.1 De dónde nace

No nace de una idea nueva, sino de una repetición ya medida. Al levantar el contexto de
`dvlopmnt/` y `projects/` el 2026-09-10 se encontró que **tres proyectos ya escribieron su propia
agenda por separado**, y un cuarto tenía planeado copiar la primera a mano:

| Proyecto | Qué agenda es | Recurso agendado | Regla de conflicto |
|---|---|---|---|
| **Espiral** (producción real) | Citas de tatuaje con depósito, presupuesto y sucursales | Artista | Bloqueo duro: `EXCLUDE USING gist` sobre `tstzrange` |
| **Dely Doggy** | Eventos (fiestas) + entregas locales | Empleado | Bloqueo duro sobre una **tabla espejo** compartida entre dos tablas de negocio distintas |
| **Asclepios** (estrategia, sin código) | Consulta + cirugía entre dos consultorios | Médico | Mixta: duro para consulta, blando para cirugía |
| **OmniAgenda** | El motor que debió existir antes que los tres | Cualquiera | **Configurable** |

Esa repetición es el problema real que este proyecto resuelve. Lo mismo que ya pasó con la
documentación —tres copias del Bridge que divergieron y hubo que sacar a una sola ruta externa—
estaba pasando con el código de agenda.

> **Tensión declarada con la regla del Bridge.** `Bridge/README.md` dice explícitamente: no
> modularizar antes de tener 3 tiendas reales. Esa regla se escribió para el **esqueleto completo
> de tienda** (OmniSkeleton). Para *agenda* específicamente ya hay 3 casos reales escritos, así
> que se considera cumplida. Queda registrado como desviación consciente, no como descuido.

### §0.2 La regla de `dvlopmnt/` (definida por el dueño, 2026-09-10)

> **Todo proyecto que vive en `dvlopmnt/` es de estudio, prueba o demostración.**
>
> - **Comparte los recursos de terceros del portafolio** — la misma cuenta de Stripe, la misma de
>   Resend, y las que hagan falta — en vez de dar de alta cuentas propias por proyecto.
> - **Guarda la mínima información posible**: solo lo necesario para demostrar que funciona y
>   cómo funciona. **Únicamente usuarios de prueba.** Nunca datos personales reales de nadie.
> - **Se publica bajo el dominio del portafolio** (`dvloprbn.dev`, todavía sin contratar), nunca
>   con dominio ni VPS propios. Esos son exclusivos de proyectos reales de cliente.
> - **Aunque sean proyectos completos**, su propósito es mostrar capacidad, no operar un negocio.

Aplica a OmniAgenda, y también a `gallery` y `login`/OmniUser, que ya vivían bajo ese criterio de
hecho aunque no estaba escrito en un solo lugar. **Este párrafo es ahora la referencia.**

> **Una sola regla mantiene esto seguro, y ya la cumples.** Compartir la cuenta de Stripe y la de
> Resend entre proyectos hermanos es correcto y conveniente — no hay ninguna razón para dar de alta
> una cuenta por demo. Lo único que hay que respetar es que, al ser cuentas compartidas, una llave
> filtrada en cualquier proyecto de estudio afectaría también al portafolio y a los demás hermanos.
> La regla que lo cierra por completo: **en `dvlopmnt/` solo se usan llaves de modo prueba**, nunca
> `sk_live_*`; los secretos viven fuera de git; y aplica la lección #10 del Bridge (un secreto
> seleccionado en el editor se filtra solo, sin que nadie lo pegue). Cumpliendo eso, el modelo de
> recursos compartidos no tiene ningún problema — y como estos proyectos nunca cobran dinero real,
> ya lo estás cumpliendo por diseño.

### §0.3 Lo que "estudio" NO significa

**No significa código de juguete.** Mismo criterio ya establecido en OmniUser: el resultado tiene
que ser cien por ciento funcional, al grado de poder servir de base real a un proyecto de cliente.
"Estudio" describe **los datos y el hospedaje**, jamás la profundidad de lo que se construye. No
hay atajos simulados, no hay integraciones fingidas, no hay "esto después".

### §0.4 La línea de negocio que el núcleo debe habilitar

El dueño lo fijó así (2026-09-10): el núcleo debe permitir **construir agendas reales de negocios
distintos**, no replicar ninguno en particular. Verticales nombradas explícitamente:

- **Restaurante** — reservación de mesa. Interesante porque la mesa es un recurso *no humano* y
  suele necesitar varios a la vez (unir dos mesas para 8 personas).
- **Estética / salón** — reservación con estilista, y **cobro en línea**. El dueño señaló que si
  la estética es grande y además vende producto, le podría convenir un paquete **agenda + tienda
  en línea + punto de venta**, o dos de tres, o uno de tres.
- **Clínica de tatuajes** — el caso que Espiral ya resuelve en producción, aquí generalizado.

Esa idea de **paquetes combinables** es una decisión estratégica de largo plazo, no alcance de
v1 — pero **sí condiciona el diseño desde hoy**: OmniAgenda tiene que poder vivir junto a una
tienda y a un POS sin tragárselos ni depender de ellos. Ver
[`CONTRATO_DE_INTEGRACION.md`](./CONTRATO_DE_INTEGRACION.md).

**Asclepios queda fuera de consideración** (decisión del dueño, 2026-09-10): no es proyecto web,
su estructura es muy distinta y su estrategia sigue cambiando. **Ninguna decisión de OmniAgenda se
toma pensando en él.** Consecuencia aceptada y registrada: si algún día Asclepios quiere esta
lógica, la reimplementa en su stack de escritorio.

---

## §1. Principios innegociables

1. **La base de datos garantiza, la aplicación propone.** Toda regla de "no se puede encimar" vive
   como restricción real de PostgreSQL, no solo como validación en el servicio. Un `if` en
   TypeScript pierde contra dos peticiones simultáneas; una restricción `EXCLUDE` no.
2. **Una sola fuente de verdad por regla.** Si una condición existe en la migración *y* en el
   código, se escribe **una constante compartida** y una prueba que verifica que ambas digan lo
   mismo. Este principio nació de una vulnerabilidad real en Espiral, no de la teoría — ver §3.
3. **Zona horaria explícita siempre.** Nunca `new Date().getHours()` ni
   `new Date(y, m, d)` a secas. El contenedor corre en UTC y el navegador de quien mira, no.
4. **El núcleo no conoce el negocio.** `omniagenda_core` no sabe qué es una cita de tatuaje ni una
   mesa de restaurante. Sabe de recursos, rangos y reglas.
5. **Seguridad desde el diseño, no como fase final.** Aunque nunca salga a producción real.
6. **Nada fabricado.** Ni datos de negocio, ni resultados de pruebas, ni "debería funcionar".
   Si no se verificó, se dice que no se verificó.
7. **Componentes propios siempre.** Nunca se pega código de terceros en este proyecto. Ver §9.

---

## §2. Stack

Idéntico al de los hermanos, a propósito: lo que se aprenda aquí se transfiere, y lo que ya se
sufrió allá no se vuelve a sufrir.

| Capa | Tecnología | Nota |
|---|---|---|
| Base de datos | **PostgreSQL 18** (`postgres:18-alpine`) | La misma de Espiral, Dely Doggy y OmniUser. `EXCLUDE USING gist` + `btree_gist` es requisito duro |
| Caché / rate limit | **Redis 8** (`redis:8-alpine`) | Licencia open source desde v8, mismo criterio ya usado en los hermanos |
| Backend | **NestJS 11 + Prisma 7** sobre **Node 24** | Igual que Espiral/Dely Doggy/OmniUser |
| Frontend | **Next.js 16 + React 19 + Tailwind 4** | ⚠️ Next 16 trae cambios de ruptura: leer `node_modules/next/dist/docs/` antes de codificar |
| Núcleo | **TypeScript puro**, sin Nest ni Prisma ni React | Ver §6.1 |
| Animación | **CSS puro**, cero librerías | Decisión ya validada en `gallery`: `motion` se probó y se quitó por bundle y rendimiento |
| Pagos | **Stripe** (modo prueba, cuenta del portafolio) | Ver §0.2 |
| Correo | **Resend** (cuenta del portafolio) | Ver §0.2 |
| Contenedores | Docker Compose, builds multi-etapa documentados | Ver §7 |

**Decisión de almacenamiento (dueño, 2026-09-10): solo PostgreSQL/web.** No se diseña para SQLite
ni para escritorio. Matiz acordado que no cuesta trabajo extra: los archivos del núcleo (§6.1)
**no importan Prisma ni Nest** — son funciones puras sobre tipos propios. No es construir para
otro motor; es no cerrarse la puerta gratis.

---

## §3. Qué se hereda ya probado (y por qué no se rediseña)

Cada renglón salió de código real leído el 2026-09-10, no de teoría.

| Patrón heredado | Fuente real | Por qué es no negociable |
|---|---|---|
| `EXCLUDE USING gist (recurso WITH =, tstzrange(inicio, fin) WITH &&) WHERE (…)` | `espiral_backend/prisma/schema.prisma`, migración `20260723192220` | Única garantía real contra doble-reserva. El pre-chequeo del servicio es defensa más débil |
| Constante compartida de estados que **no** bloquean + **prueba que lee el SQL de la migración** | `espiral/src/appointments/appointment-status.constants.ts` | Nació de una vulnerabilidad real (2026-09-03): el `EXCLUDE` ignoraba solo `cancelada` mientras la app filtraba distinto, así que una cita **rechazada** mataba el horario del artista para siempre — y el endpoint de solicitud era **anónimo** |
| Restricción **parcial** (`WHERE status <> …`) para que un bloque cancelado libere su horario | Misma migración | Sin el `WHERE`, cancelar por error y reagendar en el mismo hueco falla contra la propia restricción (bug real ya corregido allá) |
| Tabla espejo **polimórfica** (`source_type: event \| local_delivery`) con **un solo escritor** | `delyDoggy` `employee_assignments` + `EmployeeSchedulingService` | Es exactamente el mecanismo que permite que un mismo recurso no choque consigo mismo entre tablas de negocio distintas. **Es el núcleo conceptual de OmniAgenda** |
| Horario semanal por par (recurso, ubicación) en JSON + ausencias por rango de días, separados | `espiral` `artist_locations.weekly_hours` / `artist_time_off` | Patrón recurrente y excepción puntual son conceptos distintos; mezclarlos en una columna no funciona |
| Colchón de traslado entre ubicaciones | `espiral` `AppointmentsService.assertLocationBuffer` | Regla de negocio real que ninguna librería de calendario del mercado ofrece |
| Excluirse a sí mismo al reprogramar (`excludeAppointmentId`) | `espiral`, agregado 2026-08-19 | Sin eso, mover un bloque cerca de su posición actual se rechaza contra sí mismo |
| Cron que libera reservas vencidas + escala una sola vez (`*_escalated_at`, `*_reminder_sent_at`) | `espiral` `appointments.cron.ts`, `delyDoggy` `EventsCron` | Reservar sin pagar no puede bloquear un horario para siempre; y el aviso no puede repetirse en cada corrida |
| Cron envuelto en `try/catch` con captura a `system_errors` | `espiral` `appointments.cron.ts` | Un cron no pasa por ningún filtro HTTP: si truena, nadie se entera nunca |
| Aritmética de fecha con `Intl.DateTimeFormat` y zona explícita, del lado del navegador | `delyDoggy/src/lib/mexico-calendar.ts` | Servidor en UTC y navegador en otra zona posicionan los bloques en horas distintas |
| Vista de agenda **de solo lectura** que agrega dominios sin reimplementar sus reglas | `delyDoggy` `AgendaService` | El agregador no debe volver a decidir permisos: los delega en el servicio dueño de cada dominio |
| Bitácora de auditoría con un único punto de escritura | `espiral`/`delyDoggy` `audit_logs` | Formato consistente y trazabilidad real de quién movió qué cita |
| Jerarquía de roles real (`level`, `max_count`) + 2FA TOTP + anti-enumeración | `dvlopmnt/login` (OmniUser), 25 tests pasando | Base de auth ya construida y auditada; se porta, no se reinventa |
| Animación en CSS puro, `IntersectionObserver`, `prefers-reduced-motion` | `dvlopmnt/gallery` Fase 4 y 6 | `motion` ya se probó y se quitó: menos bundle, mejor rendimiento |
| `export const dynamic = 'force-dynamic'` en el layout raíz | Bridge lección #11 | `next build` se cuelga prerenderizando rutas que necesitan backend. Pasó **dos veces** (Espiral y Dely Doggy) |
| `NEXT_PUBLIC_*` como `build.args`, nunca solo `environment:` | Bridge lección #1 | Se resuelven en tiempo de build; en `environment:` llegan vacías al navegador |

---

## §4. Seguridad

Se corre completo el
[`CHECKLIST_SEGURIDAD_PRELANZAMIENTO.md`](../../DocumentacionProyecto/Bridge/CHECKLIST_SEGURIDAD_PRELANZAMIENTO.md)
del Bridge. Además, una agenda tiene superficies que un e-commerce no tiene:

### §4.1 La disponibilidad es un dato personal
Un endpoint público de disponibilidad revela **cuándo una persona real no está en su casa o en su
negocio**. Reglas de diseño, desde el día uno:
- Lo público expone **huecos libres**, nunca la lista de bloques ocupados con su detalle.
- Cada calendario decide su nivel de exposición: `privado` / `ocupado-sin-detalle` / `público`.
- El título y la nota de un bloque **nunca** viajan en una respuesta pública, aunque el bloque sí.

### §4.2 El endpoint público de reserva es un vector de denegación de servicio *de agenda*
Es la vulnerabilidad exacta que ya ocurrió en Espiral: `POST /appointments/public` era anónimo, y
como una solicitud `rechazada` seguía ocupando el horario, cualquiera podía quemar la agenda de un
artista. Mitigaciones desde el diseño:
- Estados que **no** bloquean, alineados con la restricción de la base (§3, renglón 2).
- Expiración automática por cron de toda reserva no confirmada.
- Rate limit dedicado por identidad *y* por recurso agendado, por debajo del límite global.
- Máximo de reservas pendientes simultáneas por solicitante.

### §4.3 Enlaces de suscripción `.ics` son URLs-capacidad
Quien tenga el enlace ve la agenda completa, para siempre, sin iniciar sesión. Por lo tanto:
token de alta entropía, revocable, **uno por calendario y por destinatario** (para poder revocar
solo el filtrado), y excluido de los logs de acceso del proxy.

### §4.4 IDOR entre calendarios
La categoría #2 del checklist, multiplicada aquí por el modelo de compartir. Toda consulta filtra
por el sujeto del token, nunca por el identificador que manda el cliente en la URL.

### §4.5 Dinero
El cobro en línea (depósitos/anticipos) hereda entero el bloque "Dinero y condiciones de carrera"
del checklist: escritura condicionada con verificación de conteo, webhook idempotente, y la
lección #9 del Bridge (un identificador externo reutilizado puede dejar de existir del lado del
proveedor — el `retrieve()` va en `try/catch` con captura del error específico).

### §4.6 Modelo *fail-closed* desde el primer módulo
Guard de autenticación global (`APP_GUARD`) + decorador `@Public()` explícito **desde la Fase 3**,
no después. El checklist es claro: invertirlo cuando ya hay muchos módulos cuesta mucho más, y
mientras tanto un endpoint que olvide su guard queda público sin que nada lo delate.

---

## §5. Alcance de la v1

El dueño eligió los **cuatro** dominios (2026-09-10):

| # | Dominio | Qué significa | Caso real que lo justifica |
|---|---|---|---|
| 1 | **Citas de servicio** | Un cliente reserva tiempo con un profesional | Estética, clínica de tatuajes (Espiral ya lo hace) |
| 2 | **Eventos con recursos múltiples** | Un bloque exige varios recursos libres a la vez | Restaurante (mesa + mesero), fiesta (salón + personal) |
| 3 | **Turnos de personal** | Quién trabaja cuándo: rotación y cobertura | Toda la operación de los tres verticales |
| 4 | **Tareas y recordatorios** | Bloques que no ocupan ningún recurso | Lo que convierte una agenda de negocio en un planner |

Más, del contexto de negocio (§0.4): **5. cobro en línea** (depósito/anticipo con Stripe) y
**6. punto de venta**, este último como *posible* paquete complementario.

> ### Mi postura, dicha completa
> Cuatro dominios más cobro es **el alcance más amplio posible** para una v1, y es más de lo que
> Espiral construyó en su Etapa 1. No voy a proponerte recortarlo: es tu decisión y hay una razón
> real detrás (el núcleo tiene que ser genérico de verdad, y un motor probado contra un solo
> dominio siempre termina acoplado a ese dominio).
>
> Lo que sí hago es **separar dos cosas distintas**:
> - **El modelo de datos y el núcleo soportan los 6 desde el día uno.** No se retrofitea después.
>   Esto es exactamente tu regla de "construir la capacidad real ahora en vez de parchear
>   producción luego".
> - **La construcción de la interfaz y las reglas de cada dominio se ordena en fases** (§8). Eso
>   no es recortar alcance: es el orden en que se escribe, y el orden importa porque cada fase se
>   verifica de verdad antes de la siguiente.
>
> **El punto de venta es el único que marco como abierto**, porque tú mismo lo pusiste como
> "quizá". Cuando toque, Espiral ya tiene un POS real con cortes de caja (`cash_register_sessions`,
> `register_session_transfers`) que sirve de base. Queda como decisión pendiente, no como
> pendiente olvidado — ver §11.

### §5.1 Lo que la v1 aporta y **ningún** proyecto hermano tiene hoy

1. **Recurrencia real (RFC 5545).** Lo único parecido que existe es `recurring_expenses` de
   Espiral, y su propio comentario dice *"un RRULE completo tipo iCal sería sobreingeniería aquí"*
   — correcto para gastos, insuficiente para una agenda.
2. **Multi-recurso.** Hoy los tres proyectos agendan **un** recurso por bloque.
3. **Conflicto configurable** (duro / blando) por calendario.
4. **Zona horaria como dato**, no `America/Mexico_City` incrustado en dos archivos.
5. **Exportación y suscripción `.ics`.**
6. **Lista de espera** ("avísame si se libera").
7. **Recordatorios** con anti-duplicado de primera clase, no resuelto ad-hoc por columna.

---

## §6. Arquitectura

```
omniagenda_core/       TypeScript PURO — sin Nest, sin Prisma, sin React.
                       Álgebra de intervalos · expansión de RRULE · cálculo de
                       disponibilidad · reglas de conflicto · zona horaria.
                       100% cubierto por pruebas unitarias, cero dependencias
                       de infraestructura. ES LO QUE SE REPLICA.
        ↑
omniagenda_backend/    NestJS 11 + Prisma 7 + PostgreSQL 18 + Redis 8.
                       Persistencia, autorización, cron, correo, Stripe, ICS.
                       Aquí vive el EXCLUDE: la app propone, el motor garantiza.
        ↑
omniagenda_frontend/   Next.js 16 + React 19 + Tailwind 4. CSS puro para animar.
                       Vistas día/semana/mes/agenda/línea de tiempo, arrastrar
                       y soltar, tema por CSS custom properties.
```

### §6.1 Por qué el núcleo es aparte y puro

Porque es lo único que se replica. Un núcleo que importa Prisma solo corre donde corre Prisma; uno
que importa Nest arrastra un framework completo. Puro TypeScript significa además que **cada regla
de tiempo se prueba sin levantar base de datos** — decenas de casos borde de traslape y
recurrencia en milisegundos.

### §6.2 El modelo central

Generalización directa de `employee_assignments` de Dely Doggy:

| Tabla | Qué es |
|---|---|
| `resources` | Cualquier cosa agendable: persona, mesa, sala, equipo, vehículo |
| `calendars` | Un tablero: "Mesas de la terraza", "Agenda de Ana", "Turnos de cocina" |
| `schedule_rules` | Patrón semanal por (recurso, calendario) + `RRULE` |
| `time_off` | Excepciones por rango: vacaciones, día festivo, mantenimiento |
| `bookings` | El bloque real: N recursos × 1 rango de tiempo |
| `booking_resources` | **Aquí vive el `EXCLUDE`**, por recurso — no por reserva |
| `booking_resources.source_type` + `source_id` | El puente al proyecto anfitrión |

**La clave de que sea replicable:** OmniAgenda nunca conoce el negocio del anfitrión. Una estética
conserva su propia tabla de servicios y precios; solo delega **el horario**. Es lo que Dely Doggy
ya hace bien con `employee_assignments`, elevado a producto. Ver
[`CONTRATO_DE_INTEGRACION.md`](./CONTRATO_DE_INTEGRACION.md).

### §6.3 Distribución del núcleo

**Paquete npm versionado** (decisión del dueño, 2026-09-10). En corto: en vez de copiar la carpeta
del núcleo dentro de cada proyecto que lo use, se publica con número de versión y cada proyecto
declara cuál usa. Es el mismo principio que ya te obligó a sacar el Bridge a una ruta externa
—una sola fuente, nunca copias que divergen— aplicado al código en lugar de a la documentación.

**Mecanismo concreto, resuelto en la Fase 1 (2026-09-10):**

- El núcleo es el paquete `@omniagenda/core`, con `version`, `exports`, `types` y `files` ya
  declarados en su `package.json` — listo para `npm publish` el día que haga falta.
- **Dentro de este repo:** cuando el backend lo necesite (Fase 2), lo consume como **dependencia
  local** apuntando a `omniagenda_core`, y su `Dockerfile` copia `omniagenda_core/dist` al
  contexto de build. En Fase 0/1 el backend **no** lo importa todavía.
- **Publicar a un registro real (privado):** solo cuando exista un **segundo consumidor** (otro
  proyecto). No se monta infraestructura de publicación para un solo usuario.
- **Pruebas del núcleo:** `node:test` nativo + `tsx`. Cero framework de testing — la elección más
  coherente con "TypeScript puro, sin dependencias de infraestructura".

---

## §7. Infraestructura y puertos

Puertos verificados contra los seis proyectos que ya corren en este host (Inari, Espiral, Dely
Doggy, OmniUser, dvlopr-bn, gallery) el 2026-09-10:

| Servicio | Puerto host | Ya ocupados por otros |
|---|---|---|
| PostgreSQL | **5439** | 5433 Inari · 5434 Espiral · 5435 Dely · 5436 OmniUser · 5437 dvlopr-bn · 5438 gallery |
| Redis | **6384** | 6379 Espiral · 6380 Dely · 6381 OmniUser · 6383 gallery |
| Backend (API) | **3060** | 3000 Inari · 3010 Espiral · 3020 Dely · 3030 OmniUser · 3040 dvlopr-bn · 3050 gallery |
| Frontend | **3061** | 3001 · 3011 · 3021 · 3031 · 3041 · 3051 |
| Prisma Studio | **5523** (solo `127.0.0.1`) | 5520 Dely · 5521 OmniUser · 5522 dvlopr-bn |
| Portal de docs (MkDocs) | **8100** (solo `127.0.0.1`) | 8094 Dely · 8096 OmniUser · 8098 gallery |
| Compodoc | **8101** (solo `127.0.0.1`) | 8095 · 8097 · 8099 |

Reglas heredadas del checklist, sin excepción: PostgreSQL y Redis **sin puertos publicados a la
red**, solo `127.0.0.1`; el portal de documentación también solo local (un mapa de la arquitectura
interna es OWASP API8); en producción el único puerto público es el del proxy inverso.

---

## §8. Fases

Cada fase se **verifica de verdad** antes de la siguiente — nunca "arrancó sin errores".

| # | Fase | Entregable | Cómo se verifica |
|---|---|---|---|
| **0** ✅ | Infraestructura y documentación | Docker Compose completo, esta documentación, `.env.example` | `docker compose up` real, los 4 servicios sanos — **hecho y verificado 2026-09-10**, ver `ESTADO_PROYECTO.md` §1 |
| **1** ✅ | `omniagenda_core` | Álgebra de intervalos, `RRULE`, disponibilidad, conflicto. **Sin base de datos** | **hecho 2026-09-10** — 57 pruebas `node:test` en ~185 ms, `tsc` limpio, riesgo #1 cerrado. Ver `ESTADO_PROYECTO.md` §1 |
| **2** ✅ | Persistencia + la garantía real | Schema Prisma, migración con el `EXCLUDE` escrito a mano, `btree_gist` | **hecho 2026-09-10** — 6 modelos, `EXCLUDE` + 3 `CHECK` aplicados; `double_booking.sql` 6/6 PASS contra Postgres en vivo; `status-sync.mjs` PASS. Ver `ESTADO_PROYECTO.md` §1 |
| **3** ✅ | Identidad y permisos | Auth portada de OmniUser + permisos por calendario, `APP_GUARD` fail-closed | **hecho 2026-09-10** — 31 pruebas Jest + `auth-sweep.sh` 27/27 + 2FA e2e. Ver `ESTADO_PROYECTO.md` §1 y `DOCUMENTO_VIVO_ARQUITECTURA.md` §9 |
| **4** ✅ | API de agenda | Reservar, mover, cancelar, multi-recurso, conflicto duro/blando, turnos, tareas | **hecho 2026-09-11** — 40 pruebas Jest + `agenda-e2e.sh` 16/16 (doble-reserva real → 409). Ver `ESTADO_PROYECTO.md` §1 y `DOCUMENTO_VIVO_ARQUITECTURA.md` §10 |
| **5** | Interfaz y animación | Las 5 vistas, arrastrar y soltar, lenguaje visual propio | Medición real de fotogramas, `prefers-reduced-motion`, teclado completo |
| **6** | Recordatorios, `.ics`, lista de espera | Cron, correo real, suscripción de calendario | Correo real recibido; el `.ics` abre en un cliente real |
| **7** | Cobro en línea | Depósito/anticipo con Stripe en modo prueba | Pago de prueba real de punta a punta |
| **8** | Auditoría de seguridad | Checklist completo + `PRUEBAS_SEGURIDAD.md` propio | Cada prueba con comando exacto y resultado real fechado |
| **9** | Integración real | Montar OmniAgenda en un proyecto anfitrión de demostración | Que funcione sin tocar el núcleo |
| **10** | Despliegue | Bajo el dominio del portafolio | Compose de producción comparado variable por variable contra el de desarrollo |

---

## §9. Qué significa "animación de grado profesional"

Definido por el dueño (2026-09-10), en sus términos:

1. **Impresionantes.** Que se noten y que se sientan, no transiciones tímidas de plantilla.
2. **Que no se rompan en ningún ambiente.** Funcionan en cualquier navegador y tamaño; degradan de
   forma limpia, nunca a una pantalla rota.
3. **Innovadoras**, aunque partan de ejemplos ajenos. La referencia inspira; no se calca.
4. **Nunca reutilizar código de terceros.** *"No sabemos qué pueden tener"* — todo componente se
   escribe desde cero aquí. El código que comparta el dueño (Uiverse y demás) es material de
   estudio y referencia visual, jamás material a pegar. Es también una regla de **seguridad de
   cadena de suministro**, no solo de estilo: CSS ajeno puede traer llamadas a recursos externos,
   y un fragmento con JavaScript puede traer cualquier cosa.
5. **Progresión.** Cada iteración sube el nivel de lo que se puede mostrar. Existe la idea a
   futuro de **vender componentes** desde el portafolio; no es el objetivo de este proyecto, pero
   sí una razón más para que cada componente sea original y esté bien escrito.

**Vara de medida (referencias, no modelos a copiar):** el nivel de fluidez de Fantastical, Notion
Calendar, Amie o Motion — transiciones continuas entre vistas, arrastrar y soltar con sensación
física, cambio de mes sin salto. **Lenguaje visual:** se construye desde el material del dueño en
`dvlopmnt/Components/inspiracion/` (cards luminosas, spinners, textos animados), reescrito.

**Restricciones técnicas, no negociables:**
- Solo `transform` y `opacity` en animaciones continuas (nunca `width`, `top`, `box-shadow`).
- `prefers-reduced-motion: reduce` respetado en **todo** movimiento.
- Presupuesto real de rendimiento: no se acepta una animación que no se midió.
- Cero librerías de animación. `gallery` ya probó `motion` y lo quitó por bundle y rendimiento.

---

## §10. Decisiones cerradas

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-09-10 | ✅ Nombre: **OmniAgenda** | Encaja con la familia real (OmniUser, OmniSkeleton); "Omni" comunica muchos usos y "Agenda" se entiende sin explicar. Carpeta sigue siendo `dvlopmnt/Planner/` |
| 2026-09-10 | ✅ Forma: **núcleo replicable + aplicación anfitriona real** | La app demuestra que el motor sirve; el núcleo es lo que se porta. Es lo único que prueba de verdad que es replicable |
| 2026-09-10 | ✅ Almacenamiento: **solo PostgreSQL/web** | Diseñar para dos motores encarece cada fase. Matiz: los archivos del núcleo no importan Prisma ni Nest (no cuesta extra) |
| 2026-09-10 | ✅ Naturaleza: **estudio/portafolio**, dominio `dvloprbn.dev`, sin VPS propio | Regla de hospedaje del dueño: dominio y servidor propios son exclusivos de proyectos reales de cliente |
| 2026-09-10 | ✅ Regla general de `dvlopmnt/`: estudio, recursos compartidos del portafolio, solo usuarios de prueba | Definida por el dueño; aplica a todo proyecto de esa carpeta, no solo a este (§0.2) |
| 2026-09-10 | ✅ Alcance v1: los **4 dominios** (citas, eventos multi-recurso, turnos, tareas) + cobro en línea | El motor tiene que ser genérico de verdad; probarlo contra un solo dominio lo acopla a ese dominio |
| 2026-09-10 | ✅ Distribución: **paquete npm versionado** | Copiar carpetas diverge — ya ocurrió con las 3 copias del Bridge. El mecanismo concreto se decide en Fase 1 |
| 2026-09-10 | ✅ **No** se migran las agendas de Espiral ni Dely Doggy | Espiral está en producción real con dinero de por medio; migrarla arriesga mucho a cambio de nada visible para el negocio |
| 2026-09-10 | ✅ **Asclepios queda fuera de consideración** | No es proyecto web, estructura muy distinta, estrategia aún cambiante. Ninguna decisión de aquí lo toma en cuenta |
| 2026-09-10 | ✅ Animación: CSS puro, componentes 100% propios, referencias solo como vara | Ver §9 |
| 2026-09-10 | ✅ **Fase 0 construida y verificada** — stack de 4 servicios levantado de verdad, `/health` toca Postgres y Redis, frontend en verde | El dueño dio luz verde explícita tras entender la estrategia. Detalle en `ESTADO_PROYECTO.md` |
| 2026-09-10 | ✅ **Fase 1 construida y verificada** — `omniagenda_core` con 57 pruebas verdes (tiempo, zona horaria, RRULE, disponibilidad, conflicto). Riesgo #1 (horizonte de materialización) cerrado en diseño con una constante única | TypeScript puro, `node:test` + `tsx`, sin framework. Distribución §6.3 resuelta. Commits locales; el dueño creará el repo público |
| 2026-09-10 | ✅ **Fase 2 construida y verificada** — 6 modelos + migración con `EXCLUDE USING gist` y 3 `CHECK` escritos a mano; doble-reserva rechazada por PostgreSQL en vivo (6/6); `status-sync.mjs` confirma que la migración y `@omniagenda/core` dicen lo mismo | El cableado backend↔`@omniagenda/core` se movió a la Fase 4 (donde se usa de verdad). Seed con datos ficticios (repo público) |
| 2026-09-10 | ✅ **Fase 3 construida y verificada** — auth de OmniUser portada con toda su profundidad (login 3 pasos, 2FA TOTP, jerarquía de roles, fuerza bruta) + modelo **fail-closed** (`APP_GUARD` global + `@Public()`) + capa **nueva** de permisos por calendario (`calendar_members`, viewer/booker/manager) | Mejora sobre OmniUser: fail-closed desde ahora. Runner del backend = Jest (DI necesita decorator metadata; `tsx` no lo emite). `@omniagenda/core` se cablea en Fase 4 |
| 2026-09-11 | ✅ **Fase 4 construida y verificada** — `@omniagenda/core` cableado en runtime (núcleo pasó a CommonJS); `bookings` como escritor único con `evaluateConflict` + `EXCLUDE` en transacción; `resources`/`calendars`/`schedule-rules`/`time-off`/`availability`; doble-reserva por la API real → 409 en vivo | Contexto de build del backend = raíz del repo (para incluir el núcleo). Pregunta abierta #2 (§11) se vuelve bloqueante para la Fase 5 |
| 2026-09-10 | 🟡 **Punto de venta**: posible paquete complementario, no alcance de v1 | El dueño lo planteó como "quizá". Espiral ya tiene un POS real que serviría de base |

---

## §11. Preguntas abiertas

1. **¿Entra el punto de venta y en qué fase?** Hoy marcado como paquete complementario futuro.
2. **¿Cuál es el negocio de demostración de la Fase 9?** El anfitrión que prueba que el motor se
   integra sin tocarse. Restaurante y estética son los candidatos: el restaurante ejercita
   multi-recurso, la estética ejercita cobro en línea.
3. **¿`dvloprbn.dev` ya está contratado?** El dueño lo da como el dominio del portafolio, pero
   señaló que todavía no hay dominio real. Define el subdominio de despliegue de la Fase 10.
4. **¿El repositorio será público?** OmniUser sí lo será, y eso cambió decisiones reales ahí
   (correos placeholder en la semilla, nunca el correo real del dueño).
5. **Mecanismo concreto del paquete npm** (registro privado / workspaces / `npm link`) — se
   decide en la Fase 1.
