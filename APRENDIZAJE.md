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

### El negocio de demostración y el colchón entre calendarios  ✅ 2026-09-11

- **Cómo elegir entre dos diseños igual de "completos" en apariencia** —
  `DOCUMENTO_VIVO_ARQUITECTURA.md` §11: la pregunta que de verdad decide no es "¿cuál tiene más
  funcionalidades?" sino "¿cuál obliga al motor a **crecer** una capacidad nueva, en vez de solo
  ejercitar lo que ya existe?".
- **Imposibilidad física vs. preferencia, como categorías de diseño** —
  `omniagenda_core/src/conflict/conflict.ts`: por qué el mismo concepto ("necesito X minutos de
  margen") se modela distinto según lo que representa — un colchón que se puede ignorar es
  BLANDO, uno que nadie puede violar (el tiempo real que toma trasladarse) es DURO, aunque el
  código que los evalúa sea casi idéntico.
- **Generalizar sin perder el caso original** — `resources.calendar_switch_buffer_minutes`: el
  mismo problema que Espiral resolvió como `artists.location_change_buffer_minutes` (atado a un
  negocio de tatuajes), ahora como una propiedad genérica de cualquier recurso.

### Fase 5a — Cimientos de interfaz  ✅ construido 2026-09-11

- **Cookies y hostname vs. puerto** — verificado con curl usando el mismo cookie-jar contra
  `:3060` y `:3061`: el navegador decide a quién manda una cookie por hostname, nunca por
  puerto. Es lo que hace que backend y frontend en desarrollo, aunque sean dos "sitios"
  distintos en la práctica, compartan la sesión sin ningún truco.
- **Dos clientes de API, uno para cada lado del render** —
  `omniagenda_frontend/src/lib/server-fetch.ts` (Server Components, reenvía cookies a mano) vs.
  `lib/client-api.ts` (Client Components, `credentials:'include'`) — por qué no es el mismo
  código: cada uno corre en una máquina distinta (el contenedor del frontend vs. el navegador
  del usuario) y llega al backend por una URL distinta.
- **El chequeo optimista de `proxy.ts`**: por qué basta con mirar si la cookie EXISTE (nunca
  validar el JWT ahí) para decidir un redirect — la autorización real siempre la hace el backend.

### Vínculo recurso↔cuenta  ✅ construido 2026-09-11

- **RBAC contesta una pregunta distinta a "identidad de recurso"** — el rol global
  (`roles.level`) responde "¿qué puede hacer esta cuenta en el sistema?"; "¿qué recurso agendable
  ES esta cuenta?" es una pregunta ortogonal, y mezclarlas habría obligado a inventar un rol
  "estilista" que no aporta ningún permiso real, solo una etiqueta. Reconocer que dos preguntas
  que *suenan* parecidas piden modelos distintos es la parte que vale la pena recordar.
- **`onDelete: SetNull` como decisión de negocio, no solo de sintaxis** —
  `resources.user_id`: borrar la cuenta de login de alguien que deja la empresa nunca debe borrar
  su historial de reservas ni el recurso que representaba. El motor de base de datos hace cumplir
  esto solo, sin lógica de aplicación que se pueda olvidar.
- **Un `@unique` de Postgres como la garantía real, el código solo la traduce** — mismo patrón
  que el `EXCLUDE` de reservas: `ResourcesService.update` no "revisa primero si ya está
  vinculada" (eso tiene una ventana de carrera); deja que la base de datos rechace el duplicado
  (`P2002`) y traduce ese error a un 409 legible.
- **Ancorar siempre en el token, nunca en un parámetro de ruta** — `GET /me/schedule` no tiene
  ningún `:id` que un cliente pueda manipular; toda la consulta parte de `caller.userId`. Es la
  diferencia entre "esta ruta no necesita permisos especiales" y "esta ruta es insegura".

### Fase 5b — Vista de Semana y arrastrar-y-soltar  ✅ 1er incremento construido 2026-09-11
- Por qué solo `transform` y `opacity` animan a 60fps, y qué hace el navegador con `width`.
- `prefers-reduced-motion`: la animación como decisión de accesibilidad, no de gusto.
- Layout shift (CLS) y por qué un esqueleto de carga más corto que la página real **es** el
  problema (lección #8 del Bridge, medida en producción real).
- **Por qué el Drag & Drop nativo del navegador no sirve aquí** — su "fantasma" semitransparente
  es del navegador, no de la aplicación: no hay control real sobre su posición ni su física.
  Pointer Events (`pointerdown`/`pointermove`/`pointerup` + `setPointerCapture`) da control total
  a cambio de escribir la lógica a mano — el intercambio correcto cuando "sensación física" es un
  requisito real, no decorativo.
- **Un wrapper sin posición propia colapsa a 0×0** — un hallazgo real de esta construcción: los
  eventos de puntero en el bloque visible SÍ burbujean hasta un `div` contenedor sin tamaño (el
  DOM no filtra eventos por superposición visual), pero el FOCO de teclado de ese mismo `div`
  caería en un elemento invisible. La lección: el elemento interactivo (con `tabIndex`, `role`,
  los manejadores) tiene que ser el mismo elemento que tiene la posición y el tamaño reales.
- **Optimista, pero el backend decide** — mover un bloque se ve de inmediato (mejor sensación),
  pero el movimiento se revierte si el `PATCH` real responde con un conflicto (`409`) o sin
  permiso (`403`). El patrón ya usado en toda la Fase 4 (la `EXCLUDE` de Postgres como última
  palabra) se repite aquí del lado de la interfaz: la UI propone, el servidor garantiza.
- **Teclado no es un checkbox, es una ruta funcional completa** — la alternativa de teclado usa
  el MISMO camino de datos que el arrastre con mouse (optimista + `PATCH` + revertir), en vez de
  ser una implementación paralela más simple que se desincroniza con el tiempo.
- **Una rejilla "de horario de oficina" es una decisión de UX, no una que el motor deba imponer**
  — cortar la vista a 07:00–21:00 parecía razonable, pero escondía datos reales sin avisar. La
  corrección (24h completas) fue el primer caso real de este proyecto de "el dueño prueba algo
  interactivo de verdad y encuentra un límite arbitrario que el código no debería tener".
- **Datos de demostración "suficientes" son parte de construir la funcionalidad, no un adorno
  posterior** — una sola reserva sembrada, 3 meses en el futuro, hacía que la Fase 5b se viera
  vacía al abrirla en el día real. El dueño lo dijo explícito: el seed de demostración se queda
  como está hasta producción (nunca hay que "limpiarlo" antes de entregar) — mismo espíritu que ya
  regía el resto del seed (datos ficticios, repo público), extendido a "suficientes para probar
  cada vista", no solo "el mínimo que hace pasar una prueba".

### Fase 7 — Cobro en línea
- Por qué un identificador de Stripe guardado puede dejar de existir del lado de Stripe
  (lección #9 del Bridge — tumbó la pantalla de pago de un cliente real).

### Fase 8 — Seguridad
- Cómo se verifica el control de acceso **contra la aplicación corriendo**, y por qué inventariar
  endpoints con un analizador de código dio 208 falsos positivos en Espiral.

---

## Entradas reales

*(Ninguna todavía. La primera se escribe cuando se explique el primer concepto de la Fase 0.)*
