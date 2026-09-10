# @omniagenda/core

Motor de agenda **replicable**. TypeScript puro — **sin Nest, sin Prisma, sin React**.

Recibe datos ya cargados y devuelve decisiones: ¿se traslapan estos dos rangos?
¿qué huecos quedan libres? ¿esta serie recurrente cae en esta fecha? ¿este
bloque entra en conflicto, y el conflicto es duro o blando?

## Estado

**Fase 0 — esqueleto.** Solo `package.json`, `tsconfig.json` y un `src/index.ts`
casi vacío, para fijar la forma del paquete. La lógica real se escribe en la
**Fase 1** (ver [`../PLAN_DESARROLLO.md`](../PLAN_DESARROLLO.md) §8), dirigida por
pruebas.

## Por qué es un paquete aparte

Es lo único que se replica a otros proyectos. Un núcleo que importa Prisma solo
corre donde corre Prisma; uno que importa Nest arrastra un framework entero.
Puro, además, se prueba sin levantar base de datos. Ver
[`../DOCUMENTO_VIVO_ARQUITECTURA.md`](../DOCUMENTO_VIVO_ARQUITECTURA.md) §6.

El mecanismo de distribución concreto (registro npm privado / workspaces /
`npm link`) se decide en la Fase 1 — ver `PLAN_DESARROLLO.md` §6.3.
