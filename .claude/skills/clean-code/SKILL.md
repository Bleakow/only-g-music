---
name: clean-code
description: "Trigger: buenas prácticas, patrones, patrón de diseño, refactor, arquitectura, clean code, SOLID, naming, deuda técnica, repository, capas. Principios y patrones para Only G."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

# Clean Code & Patrones — Only G

## Activation Contract

Usar al diseñar estructura, refactorizar, decidir abstracciones o nombrar. Aplica de forma transversal a cualquier código.

## Hard Rules

- **YAGNI**: nada de abstracciones especulativas "por si acaso". Se crea cuando hay un consumidor real (en este repo: repos/paquetes nacen con su fase).
- **Responsabilidad única**: una unidad, una razón para cambiar. Funciones cortas, nombradas por intención.
- **Separación por capas**: dominio puro (`src/domain`) ← repos (data-access) ← features/UI. La UI **no** contiene lógica de negocio ni acceso a datos.
- **Repository pattern**: un `*-repo.ts` por dominio; la implementación puede cambiar (semilla → Firestore) sin tocar la UI.
- **No tragues errores en silencio**: manéjalos con sentido o propágalos. Una sesión válida no debe romperse por un fallo de capa de datos, pero el fallo se registra/comunica.
- **Idempotencia** en operaciones repetibles (p. ej. `ensureX` no duplica).
- **Nombres reveladores**; sin abreviaturas crípticas; mismo idioma/estilo que el código vecino.
- **DRY con criterio**: extrae cuando algo se repite y *significa lo mismo*; no acoples por parecido casual.
- **Organización por feature**, no por tipo de archivo.

## Decision Gates

| Situación | Acción |
|-----------|--------|
| "Quizá lo necesitemos luego" | No lo construyas (YAGNI) |
| Acceso a datos | Repo, nunca en el componente |
| Lógica repetida 3+ veces igual | Extrae a función/módulo |
| Función que hace 2 cosas | Divídela |
| Error atrapado | Manéjalo o propágalo, nunca lo silencies sin razón |

## Output Contract

Código en capas (dominio → repo → UI), sin abstracciones especulativas, funciones de responsabilidad única, nombres claros, errores no silenciados.

## References

- `../../../AGENTS.md` — convenciones y estrategia de repos
- `../../../src/features` — organización por feature
