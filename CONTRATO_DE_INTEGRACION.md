# Contrato de integración — cómo un proyecto anfitrión monta OmniAgenda

> Documento **nuevo**, sin equivalente en los proyectos hermanos. Existe porque OmniAgenda es el
> primer proyecto pensado desde el día uno para ser **montado dentro de otro**.
>
> **v0.1 — 2026-09-10. Contrato de diseño: nada implementado todavía.** Cada afirmación aquí es
> una promesa de diseño que la Fase 9 tiene que probar en un anfitrión real.

---

## 1. La regla que hace posible todo lo demás

> **OmniAgenda no conoce el negocio del anfitrión, y el anfitrión no conoce las entrañas de
> OmniAgenda.**

Una estética conserva su tabla de servicios, sus precios y su catálogo. Un restaurante conserva su
menú. Lo único que delegan es **el tiempo**: quién está ocupado, cuándo, y si se puede o no.

El puente son dos columnas en `booking_resources`:

```
source_type   'cita_estetica' | 'reservacion_mesa' | 'turno_cocina' | lo que el anfitrión decida
source_id     el identificador de la fila del anfitrión
```

OmniAgenda **nunca** interpreta esos valores: los guarda, los devuelve y los usa para agrupar.
Es exactamente lo que Dely Doggy ya hace bien con `employee_assignments.source_type`
(`event | local_delivery`), elevado a contrato explícito.

---

## 2. Las tres formas de montarlo

| Forma | Qué es | Cuándo conviene |
|---|---|---|
| **A. Solo el núcleo** | El anfitrión instala `omniagenda_core` como paquete y usa sus funciones puras (traslape, `RRULE`, disponibilidad) contra **sus propias tablas** | El anfitrión ya tiene su modelo de datos y solo quiere las reglas de tiempo bien hechas |
| **B. Núcleo + tablas** | El anfitrión adopta también el esquema de OmniAgenda (`resources`, `bookings`, `booking_resources`) dentro de su propia base | Un proyecto nuevo que quiere agenda completa sin escribirla |
| **C. Servicio aparte** | OmniAgenda corre como su propio backend y el anfitrión le habla por HTTP | Cuando la agenda la comparten varias aplicaciones |

**La v1 apunta a A y B.** La forma C queda documentada pero no se construye hasta que exista un
caso real que la pida: implica autenticación entre servicios y una superficie de red más, que no
se paga sin necesidad.

---

## 3. Lo que el anfitrión **debe** aportar

1. **Su propia autenticación.** OmniAgenda recibe un sujeto ya autenticado; no emite sesiones para
   el anfitrión. (La app anfitriona de demostración sí trae la suya, portada de OmniUser.)
2. **La decisión de permisos de negocio.** OmniAgenda responde "¿este recurso está libre?"; el
   anfitrión responde "¿esta persona tiene derecho a reservarlo?".
3. **La zona horaria de cada calendario.** No hay valor por defecto oculto.
4. **El significado de sus `source_type`.** OmniAgenda no los valida contra ninguna lista.

## 4. Lo que OmniAgenda **garantiza**

1. **Que dos bloques `blocking` del mismo recurso no se encimen jamás** — garantizado por
   PostgreSQL, no por código de aplicación.
2. **Que la disponibilidad calculada respete** horario semanal, ausencias, colchones entre
   ubicaciones y bloques ya existentes.
3. **Que una serie recurrente se expanda igual** en el servidor y en el navegador (mismo núcleo,
   mismo código).
4. **Que ninguna respuesta pública filtre el detalle de un bloque ajeno** (ver
   `PLAN_DESARROLLO.md` §4.1).

## 5. Lo que OmniAgenda **nunca** hace

- Cobrar por su cuenta. El cobro en línea de la v1 es de la **app anfitriona de demostración**,
  no del motor. El motor solo entiende "este bloque expira si no se confirma antes de tal hora".
- Mandar correo en nombre del anfitrión sin que este configure su remitente.
- Guardar datos clínicos, financieros o personales del anfitrión más allá de un identificador y
  un título opcional.
- Interpretar `source_type`.

---

## 6. Verificación pendiente

Todo este documento es **contrato de diseño**. La prueba real es la **Fase 9**: montar OmniAgenda
en un proyecto anfitrión de demostración y comprobar que funciona **sin tocar el núcleo**. Si hay
que modificar el núcleo para que el anfitrión funcione, el contrato estaba mal y se corrige aquí,
no en el anfitrión.
