---
name: design-ux
description: "Trigger: diseñar/revisar UI, pantalla, componente, estilo, color, tipografía, layout, accesibilidad, mobile. Sistema de diseño de Only G (Next + Tailwind, estética GTA VI)."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

# Design / UX — Only G

## Activation Contract

Usar al diseñar o revisar cualquier UI: páginas, componentes, color, tipografía,
espaciado, layout, interacción o accesibilidad. Omitir en lógica de backend pura.

## Hard Rules

- **Mobile-first**: diseña a 375px y escala. Usa `min-h-dvh` (no `100vh`). Nunca scroll horizontal.
- **Estética**: oscura, cinematográfica, tipografía grande (fuentes **OGM**), reveals guiados por scroll. Referencia: landing de GTA VI.
- **Tokens primero**: usa los `@theme` de `globals.css` (`font-sans`, `font-narrow`). No hardcodear hex; define tokens semánticos.
- **Tailwind para estilo**; CSS Modules solo para máscaras, gradientes con sombras o animación compleja.
- **Accesibilidad (no negociable)**: contraste ≥4.5:1 texto normal (3:1 grande); focus visible (jamás quitar el outline); touch ≥44×44px; `aria-label` en botones de solo icono; no transmitir información solo por color.
- **Iconos**: SVG inline desde `src/components/icons` (heredan `currentColor`). Nunca emojis como iconos.
- **Imágenes**: `next/image` con `width`/`height` declarados (evita CLS); formatos webp/avif.
- **Una sola CTA primaria** por pantalla; las secundarias visualmente subordinadas.

## Decision Gates

| Necesito | Acción |
|----------|--------|
| Marcar jerarquía | Tamaño + espaciado + contraste, no solo color |
| Animar algo | Ver skill `gsap-animations` |
| Estado hover/active/disabled | Distinto y on-style; disabled = opacity ~0.4 + sin acción |
| Texto largo | 35–60 chars/línea en móvil; `line-height` 1.5 |

## Execution Steps

1. Define el tipo de pantalla y su jerarquía (qué ve el usuario primero).
2. Aplica tokens y mobile-first; valida en 375 / 768 / 1024.
3. Revisa contra las reglas de accesibilidad antes de dar por hecho.

## Output Contract

UI mobile-first, con tokens, accesible (contraste/focus/touch), una CTA primaria, sin layout shift.

## References

- `../../../AGENTS.md` — convenciones del proyecto
- `../../../src/app/globals.css` — tokens `@theme`
