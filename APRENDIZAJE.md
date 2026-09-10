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

### Fase 1 — El núcleo
- **Álgebra de intervalos**: qué significa exactamente que dos rangos se traslapen, y por qué
  `inicio < otroFin && fin > otroInicio` es la condición correcta (y `<=` es un error clásico que
  hace imposible agendar dos citas seguidas).
- **RFC 5545 / `RRULE`**: cómo se guarda "todos los martes salvo el 24 de diciembre" en una línea.
- **Ocurrencia virtual vs. materializada** y por qué no se guardan mil filas por adelantado.
- Por qué un módulo sin dependencias se prueba en milisegundos y uno acoplado al ORM, no.

### Fase 2 — La base de datos como garantía
- **`EXCLUDE USING gist` y `tstzrange`**: cómo PostgreSQL impide un traslape que la aplicación
  jamás podría impedir sola, y por qué hace falta la extensión `btree_gist`.
- **Restricción parcial** (`WHERE`) y el bug real que aparece cuando falta.
- **Condición de carrera**: por qué dos peticiones simultáneas pasan las dos el mismo `if`.
- **`timestamptz` vs `date`**: la distinción que ya desalineó nómina real en Espiral.

### Fase 3 — Identidad y permisos
- Modelo *fail-closed* con `APP_GUARD` + `@Public()`, y por qué invertirlo tarde cuesta caro.
- Jerarquía de roles por `level` y por qué un admin no debe poder tocar a otro admin.
- Qué es un IDOR y por qué filtrar por el identificador de la URL en vez de por el del token es
  la vulnerabilidad más común de una API.

### Fase 4 — API
- Transacción y atomicidad: por qué una reserva de dos mesas se guarda completa o no se guarda.
- Idempotencia: por qué un webhook de pago puede llegar dos veces.

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
