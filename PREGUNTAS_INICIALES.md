# Preguntas iniciales — OmniAgenda

> Cuestionario real con el dueño, **2026-09-10**, antes de escribir una sola línea de código.
> Mismo criterio que `delyDoggy/PREGUNTAS_INICIALES.md`: se conserva la respuesta del dueño lo más
> cerca posible de sus palabras, para que una decisión no se reinterprete meses después.

---

## Ronda 1 — las cuatro que más cambiaban el trabajo

### 1. ¿Qué forma debe tener el proyecto?
**Respuesta: núcleo + aplicación anfitriona real.**
Un núcleo embebible (`omniagenda_core`) más una app de agenda completa que lo consume. La app
demuestra que funciona; el núcleo es lo que se replica.

### 2. ¿El núcleo debe ser portable a SQLite/escritorio, o solo PostgreSQL/web?
**Respuesta: solo PostgreSQL/web.**
> *Consecuencia registrada:* el caso de escritorio (Asclepios) no podrá reutilizar el motor.
> El dueño lo confirmó por separado en la ronda 2. Matiz acordado que no cuesta trabajo extra:
> los archivos del núcleo no importan Prisma ni Nest.

### 3. ¿Cómo se llama el proyecto?
**Respuesta: OmniAgenda.** (Alternativas presentadas y descartadas: *Kairós*, *Mosaico*.)
La carpeta sigue siendo `dvlopmnt/Planner/`, que el dueño ya había fijado.

### 4. ¿Qué naturaleza tiene?
**Respuesta: proyecto de estudio / portafolio.**

---

## Ronda 2 — alcance y forma de trabajo

### 5. ¿Qué cubre la v1?
**Respuesta: los cuatro dominios.** Citas de servicio · eventos con recursos múltiples · turnos de
personal · tareas y recordatorios.

### 6. ¿Cómo se distribuye el núcleo?
**Respuesta: paquete npm versionado.**
> El dueño añadió: *"No estoy seguro de entender esta pregunta, pero si no mal recuerdo en la
> documentación misma ya está una solución para esto."* — Es correcto: el principio es el mismo
> que obligó a sacar el Bridge a una sola ruta externa (una fuente, nunca copias que divergen),
> aplicado al código. Explicado en `PLAN_DESARROLLO.md` §6.3.

### 7. ¿Se migran las agendas de Espiral y Dely Doggy?
**Respuesta: no, solo proyectos nuevos.**
> El dueño no interpretó la pregunta como de migración, y en su lugar pidió registrar una regla
> más importante que no estaba escrita en ningún lado — ver §9 abajo.

### 8. ¿Qué es "animación de grado profesional"?
**Respuesta (literal del dueño):**
> *"Que las animaciones sean impresionantes y que funcionen en todos los ambientes, que no se
> rompan, que sean innovadoras aunque usemos otros ejemplos. **Nunca reutilizar código, no sabemos
> qué pueden tener, siempre debes escribir tus propios componentes** y utilizar el código que te
> comparta solo como ejemplo. Ir mejorando en cuanto a lo que podemos mostrar y trabajar; quién
> sabe, quizá podamos vender por componentes."*

Desarrollado en `PLAN_DESARROLLO.md` §9.

---

## Ronda 3 — respuestas abiertas del dueño

### 9. La regla de la carpeta `dvlopmnt/` (petición explícita de registrarla)
> *"Todos los proyectos de la carpeta development son de estudio o prueba o demo, por lo que
> vivirán y compartirán recursos como Stripe, Resend y algunos más, del portafolio. Aunque sean
> proyectos completos no deberán guardar mucha información, únicamente para poder mostrar que sí
> funcionan y cómo funcionan, solo usuarios de prueba."*

Registrado como regla general —no solo de este proyecto— en `PLAN_DESARROLLO.md` §0.2, con su
consecuencia de seguridad: compartir cuentas **amplía** el radio de daño de una llave filtrada.

### 10. La línea de negocio que el núcleo debe habilitar
> *"Es un producto de estudio pero debe tener un core que permita replicar o utilizarlo de base
> para la construcción de una agenda real. Ej: reservaciones de diferentes tipos, restaurantes,
> estéticas, clínicas de tatuajes… Este sí es un sistema web con cobro en línea y quizá hasta un
> POS — no digo la tienda en línea, pero si es muy grande la estética y tiene productos podría
> convenirle un paquete del tipo: agenda súper pro, tienda en línea y punto de ventas. O solo dos
> de tres, o uno de tres."*

Registrado en `PLAN_DESARROLLO.md` §0.4. El POS quedó como decisión abierta (§11).

### 11. Asclepios
> *"Yo creo que este proyecto no deberías tomarlo en cuenta, porque para comenzar este no es un
> proyecto web y tiene una estructura muy diferente a los demás, y aún está en desarrollo su
> estrategia, aún pueden cambiar muchas cosas."*

**Ninguna decisión de OmniAgenda se toma pensando en Asclepios.**

### 12. Dominio
> *"Vive dentro del portafolio, aún no hay dominio real, pero quedó `dvloprbn.dev`."*

Confirmado: es el dominio del portafolio (el mismo bajo el que se planea publicar `gallery`).
Todavía **no contratado** — queda como pregunta abierta #3 de `PLAN_DESARROLLO.md` §11.

---

## Preguntas que siguen abiertas

Ver `PLAN_DESARROLLO.md` §11. En resumen: si entra el POS y cuándo · cuál es el negocio de
demostración de la Fase 9 · si `dvloprbn.dev` ya está contratado · si el repositorio será público ·
el mecanismo concreto del paquete npm.
