---
name: tailwind
description: "Trigger: Tailwind, estilos, clases, @theme, tokens, responsive, hover, focus, variantes, dark, CSS. Estilos con Tailwind v4 para Only G."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

# Tailwind v4 — Only G

## Activation Contract

Usar al estilar con Tailwind: clases, tokens, responsive, variantes de estado o configuración de tema.

## Hard Rules

- **Tailwind v4**: la configuración es por **CSS** con `@theme` en `globals.css` (NO `tailwind.config.js`). Tokens del proyecto: `silver-*`, `amethyst-*`, `ink`/`ink-soft`, `font-sans`, `font-narrow`.
- **Tokens primero**: usa clases de token (`text-silver-300`, `bg-ink`, `border-amethyst-300`). Evita valores arbitrarios `[...]` salvo casos puntuales (sombras/gradientes específicos). **Nunca hardcodees un color que ya es token.**
- **Mobile-first**: la base es móvil; escala con `sm: md: lg:`. No uses `max-*` como estrategia principal.
- **Variantes de estado, no JS**: `hover: focus-visible: active: disabled: data-[…]: aria-[…]:` para estilos condicionales.
- **`focus-visible` siempre visible**: nunca `outline-none` sin un reemplazo con contraste suficiente (`ring` con opacidad alta).
- **CSS Modules solo** para lo que Tailwind no expresa bien (máscaras, gradientes con sombras, animación compleja).
- **Evita `@apply` masivo**: compón clases en el JSX o extrae un componente.
- **Clases condicionales legibles** (plantillas o helper tipo `clsx`); no concatenar strings frágiles.

## Decision Gates

| Necesito | Acción |
|----------|--------|
| Un color/medida del tema | Clase de token, no `[#hex]` |
| Estilo en hover/focus/disabled | Variante (`hover:`, `focus-visible:`…) |
| Estado activo de un toggle | `data-[active=true]:` |
| Máscara/gradiente complejo | CSS Module |

## Output Contract

UI con tokens (sin hex hardcodeado), mobile-first, estados vía variantes, focus visible. CSS Modules solo donde Tailwind no llega.

## References

- `../../../src/app/globals.css` — tokens `@theme`
- `../../../AGENTS.md`
