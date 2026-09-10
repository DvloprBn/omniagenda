# OmniAgenda — Documento vivo de arquitectura

> El **detalle técnico** de cada decisión: qué se decidió, por qué, qué se descartó y qué se
> aprendió. La estrategia vive en [`PLAN_DESARROLLO.md`](./PLAN_DESARROLLO.md); el día a día en
> [`ESTADO_PROYECTO.md`](./ESTADO_PROYECTO.md).
>
> **v0.1 — 2026-09-10.** Todas las secciones de abajo son **decisiones de diseño previas al
> código**. Ninguna está verificada contra un sistema corriendo todavía, y así se marca cada una.
> Conforme se construya, cada sección gana su nota de verificación real.

---

## §1. El `EXCLUDE` va sobre el recurso, no sobre la reserva

**Decidido: 2026-09-10 · Estado: diseño, sin implementar.**

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

---

## §2. `blocking` como columna: el conflicto duro y el blando conviven

**Decidido: 2026-09-10 · Estado: diseño, sin implementar.**

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

**Decidido: 2026-09-10 · Estado: diseño, sin implementar.**

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

**Decidido: 2026-09-10 · Estado: diseño, sin implementar.**

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

**Decisión abierta hasta la Fase 1:** el `EXCLUDE` **no puede ver ocurrencias virtuales** — la
base solo conoce filas reales. Un bloque recurrente que debe bloquear tiene que materializarse
dentro de un horizonte (por ejemplo, los próximos 90 días) por un cron. Ese horizonte es un
número que hay que elegir con cuidado y medir; queda registrado como riesgo conocido, no
resuelto.

---

## §5. Zona horaria como dato del calendario

**Decidido: 2026-09-10 · Estado: diseño, sin implementar.**

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

**Decidido: 2026-09-10 · Estado: diseño, sin implementar.**

`omniagenda_core` no importa Prisma, ni Nest, ni React. Recibe datos ya cargados y devuelve
decisiones. Tres razones concretas:

1. **Es lo único que se replica.** Un núcleo que importa Prisma solo corre donde corre Prisma.
2. **Se prueba sin base de datos.** Decenas de casos borde de traslape, colchones y recurrencia
   en milisegundos, sin contenedor.
3. **La puerta queda abierta gratis.** El dueño decidió *solo PostgreSQL/web*, y así se construye
   — pero no importar el ORM no cuesta trabajo extra y evita cerrar una puerta sin necesidad.

Lo que **sí** vive en el backend y no en el núcleo: el `EXCLUDE`, las transacciones, los permisos,
el cron, el correo y Stripe.

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
| 1 | Horizonte de materialización de series recurrentes (§4) | El `EXCLUDE` no ve ocurrencias virtuales | Abierto — se define y mide en Fase 1/2 |
| 2 | Costo de expandir `RRULE` en calendarios grandes | Una vista de mes con muchas series puede volverse cara | Abierto — se mide, no se supone |
| 3 | Arrastrar y soltar contra conflicto duro | La animación tiene que poder "rebotar" limpio cuando la base rechaza | Abierto — Fase 5 |
| 4 | Cuentas de Stripe/Resend compartidas del portafolio | Una llave filtrada compromete a todos los hermanos | Mitigado por diseño: solo claves de prueba, secretos fuera de git |
| 5 | Cuatro dominios en v1 | Es el alcance más amplio de cualquier proyecto tuyo hasta hoy | Aceptado por el dueño; se ordena por fases (`PLAN_DESARROLLO.md` §5) |
