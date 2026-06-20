---
name: typescript
description: "Trigger: TypeScript, tipos, type, interface, genéricos, type-safety, any, unknown, inferencia, tipado, dominio. Buenas prácticas de TypeScript para Only G."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

# TypeScript — Only G

## Activation Contract

Usar al escribir o revisar TypeScript: tipos, interfaces, genéricos, modelado de dominio o cualquier código `.ts`/`.tsx`.

## Hard Rules

- **`strict` siempre.** Nunca desactivar `strictNullChecks` ni silenciar el compilador con `// @ts-ignore` (usa `@ts-expect-error` con motivo si es inevitable).
- **Prohibido `any`.** Usa `unknown` + narrowing, genéricos o tipos precisos. Un `any` aislado y comentado es la única excepción.
- **Prefiere la inferencia**: no anotes lo que TS ya deduce. SÍ anota las fronteras públicas (params, retornos de repos/API).
- **Uniones de literales, no `enum`**: `type Role = "cliente" | "admin"`. Coincide con el dominio del proyecto.
- **`import type { … }`** para imports solo-tipo (evita runtime innecesario).
- **`satisfies`** para validar forma sin perder el tipo literal; **`as const`/`readonly`** para datos inmutables.
- **Evita `!` (non-null)**: prefiere guardas, `?.` y `??`. Si lo usas, que el porqué sea obvio.
- **Estados imposibles fuera del sistema**: modela con uniones discriminadas (`{ status: "ok"; data } | { status: "error"; error }`).
- **Dominio puro** en `src/domain`: tipos sin imports de UI ni Firebase.

## Decision Gates

| Necesito | Acción |
|----------|--------|
| Valor de origen desconocido | `unknown` + narrowing, nunca `any` |
| Conjunto cerrado de valores | Unión de literales (no enum) |
| Objeto que debe cumplir forma | `satisfies Tipo` |
| Quitar opcionalidad puntual | Guarda/early-return, no `!` |

## Output Contract

Código sin `any`, con tipos en las fronteras, uniones discriminadas para estados, y dominio puro. Compila con `pnpm exec tsc --noEmit` sin errores.

## References

- `../../../AGENTS.md` — convenciones del proyecto
- `../../../src/domain` — ejemplos de tipos de dominio puros
