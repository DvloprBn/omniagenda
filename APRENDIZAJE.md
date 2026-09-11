# Bitácora de aprendizaje — OmniAgenda

> Registro de los conceptos que se explican durante este proyecto, con el archivo y la línea real
> donde vive el ejemplo. Mismo criterio que `espiral/APRENDIZAJE.md`, `delyDoggy/APRENDIZAJE.md` y
> `login/APRENDIZAJE.md`.
>
> **2026-09-10 — el archivo arranca vacío a propósito.** Todavía no se ha explicado nada porque
> todavía no se ha construido nada. Abajo está el **índice de lo que viene**, para que el dueño
> sepa qué va a aprender y en qué fase, y para que ninguna explicación importante se dé de
> palabra y se pierda.

---

## Conceptos pendientes, por fase

### Fase 0 — Infraestructura
- Por qué `NEXT_PUBLIC_*` se resuelve en tiempo de *build* y no de arranque (lección #1 del Bridge,
  costó un despliegue real en Espiral).
- Qué hace realmente un build multi-etapa de Docker y por qué el contenedor final es más pequeño.
- Por qué PostgreSQL y Redis **nunca** publican puerto a la red, ni en desarrollo.

### Fase 1 — El núcleo  ✅ construido 2026-09-10

Los conceptos ya tienen código real que leer. Pendiente: sesión de repaso guiado con el dueño
sobre estos cuatro archivos.

- **Álgebra de intervalos** — `omniagenda_core/src/time/interval.ts`. Un rango es semiabierto
  `[start, end)`; `overlaps` usa `a.start < b.end && b.start < a.end` (con `<`, nunca `<=`), que
  es lo que deja agendar `[09:00,10:00)` y `[10:00,11:00)` seguidas sin que "choquen". Ver la
  prueba `overlaps: adyacentes NO se traslapan`.
- **Operaciones de conjuntos de intervalos** — `omniagenda_core/src/time/interval-set.ts`.
  `subtract` es la pieza clave: un "hueco" en medio parte un intervalo en dos. Toda la
  disponibilidad se calcula restando conjuntos.
- **Zona horaria sin librería** — `omniagenda_core/src/time/zoned.ts`. Cómo `Intl.DateTimeFormat`
  con `timeZone` + `formatToParts` convierte entre "hora de pared" e "instante", y por qué el
  método de "suponer UTC, medir el offset real, corregir" resuelve el caso normal (y qué pasa
  exactamente en la transición de horario de verano).
- **RFC 5545 / `RRULE`** — `omniagenda_core/src/recurrence/rrule.ts`. "Todos los martes salvo el
  24 de diciembre" = una regla (`FREQ`, `BYDAY`, `EXDATE`), no mil filas. Por qué la recurrencia
  avanza en *reloj de pared* y no en saltos de 24 h (una prueba lo verifica cruzando un cambio
  de horario).
- **Ocurrencia virtual vs. materializada + el horizonte** — `omniagenda_core/src/recurrence/horizon.ts`.
  Por qué el `EXCLUDE` de Postgres (Fase 2) no puede ver lo que no es una fila real, y la
  compensación de elegir 90 días.
- **Conflicto duro vs. blando** — `omniagenda_core/src/conflict/conflict.ts`. Qué rechaza la base
  y qué solo se avisa; el colchón de traslado; no chocar consigo misma al reprogramar.
- Por qué un módulo sin dependencias se prueba en milisegundos (57 pruebas, ~185 ms) y uno
  acoplado al ORM, no.

### Fase 2 — La base de datos como garantía
- **`EXCLUDE USING gist` y `tstzrange`**: cómo PostgreSQL impide un traslape que la aplicación
  jamás podría impedir sola, y por qué hace falta la extensión `btree_gist`.
- **Restricción parcial** (`WHERE`) y el bug real que aparece cuando falta.
- **Condición de carrera**: por qué dos peticiones simultáneas pasan las dos el mismo `if`.
- **`timestamptz` vs `date`**: la distinción que ya desalineó nómina real en Espiral.

### Fase 3 — Identidad y permisos  ✅ construido 2026-09-10

Auth portada de OmniUser (`dvlopmnt/login`) con toda su profundidad + una capa nueva de permisos
por calendario. Pendiente: sesión de repaso guiado.

- **Modelo *fail-closed*** — `omniagenda_backend/src/app.module.ts` (los 3 `APP_GUARD`) +
  `src/auth/guards/jwt-auth.guard.ts` (respeta `@Public()`). Por qué invertirlo tarde cuesta caro
  (lo dice el checklist).
- **Login en 3 pasos** — `src/auth/auth.service.ts` (`loginStep1/2/3`). Por qué el paso 1 no
  revela si la cuenta existe; por qué el "challenge token" entre paso 2 y 3 nunca sirve de sesión.
- **Refresh token con rotación + ventana de gracia** — `AuthService.refresh`. Por qué 2 pestañas
  renovando a la vez no deben tronar, pero un token reusado 1 minuto después sí revoca todo.
- **2FA (TOTP, RFC 6238)** — `src/two-factor/two-factor.service.ts` + `src/common/utils/totp.util.ts`
  + `crypto.util.ts` (por qué el secreto TOTP se *cifra* y no se *hashea*, a diferencia de una
  contraseña).
- **Jerarquía de roles** — `src/users/users.service.ts` (`assertCanManageRole`): un admin no puede
  tocar a otro admin ni exceder el `max_count` de director/super.
- **Permisos por calendario (nuevo)** — `src/calendar-access/calendar-access.service.ts`. viewer <
  booker < manager; admin global = manager implícito; `allowByVisibility` para lectura pública.
- **Fuerza bruta** — `src/security-events/security-events.service.ts`: por qué el conteo vive en
  Redis (ventana deslizante) y solo el cruce del umbral se persiste.

### Fase 4 — API de agenda  ✅ construido 2026-09-11

- **Transacción y atomicidad** — `omniagenda_backend/src/bookings/bookings.service.ts` (`create`):
  por qué una reserva de dos recursos se guarda completa o no se guarda ninguna
  (`$transaction` + `createMany`).
- **Defensa en dos capas contra la condición de carrera** — el mismo archivo: por qué un
  pre-chequeo en la aplicación (`evaluateConflict`, mensaje claro) NUNCA basta solo, y por qué la
  `EXCLUDE` de la base dentro de la misma transacción es la que de verdad decide cuando dos
  peticiones llegan casi al mismo tiempo (`translateWriteError` traduce la violación a un 409
  legible).
- **CommonJS vs. ESM** — por qué `omniagenda_core` cambió de `"type":"module"` a CommonJS para
  que NestJS/Jest lo puedan `require()`, y qué significa en la práctica "un paquete se compila a
  un formato u otro según `package.json`, no según cómo se escribió el código fuente".
- **El "escritor único"** como patrón: por qué solo `BookingsService` toca
  `booking_resources`, nunca otro módulo directo — mismo principio que
  `EmployeeSchedulingService` de Dely Doggy.
- Pendiente para más adelante: **idempotencia** — por qué un webhook de pago (Fase 7) puede
  llegar dos veces.

### Fase 5 — Interfaz y animación
- Por qué solo `transform` y `opacity` animan a 60fps, y qué hace el navegador con `width`.
- `prefers-reduced-motion`: la animación como decisión de accesibilidad, no de gusto.
- Layout shift (CLS) y por qué un esqueleto de carga más corto que la página real **es** el
  problema (lección #8 del Bridge, medida en producción real).

### Fase 7 — Cobro en línea
- Por qué un identificador de Stripe guardado puede dejar de existir del lado de Stripe
  (lección #9 del Bridge — tumbó la pantalla de pago de un cliente real).

### Fase 8 — Seguridad
- Cómo se verifica el control de acceso **contra la aplicación corriendo**, y por qué inventariar
  endpoints con un analizador de código dio 208 falsos positivos en Espiral.

---

## Entradas reales

*(Ninguna todavía. La primera se escribe cuando se explique el primer concepto de la Fase 0.)*
