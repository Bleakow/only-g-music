---
name: gsap-animations
description: "Trigger: animación, scroll, GSAP, ScrollTrigger, transición, parallax, efecto hero, máscara. Patrones de animación GSAP en React/Next para Only G."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

# GSAP Animations — Only G

## Activation Contract

Usar al añadir o editar animaciones, efectos de scroll, transiciones o el reveal del hero.

## Hard Rules

- **Limpieza en React**: envuelve toda animación en `gsap.context(() => {...}, ref)` y devuelve `() => ctx.revert()` en el `useEffect`. Nunca dejes un ScrollTrigger sin limpiar.
- **Registra plugins una vez**: `gsap.registerPlugin(ScrollTrigger)` a nivel de módulo.
- **Anima solo `transform` y `opacity`** — nunca `width/height/top/left` (reflow + CLS).
- **Respeta `prefers-reduced-motion`**: reduce o desactiva la animación.
- **Duraciones** 150–400ms en micro-interacciones; `scrub` para efectos ligados al scroll.
- **ScrollTrigger** con `trigger` explícito + `start`/`end`. Para `scrub`, usa una "pista" de scroll (contenedor alto) con los hijos en `fixed`.
- **Easing**: `ease-out` al entrar, `ease-in` al salir.

## Decision Gates

| Caso | Patrón |
|------|--------|
| Reveal al hacer scroll | `timeline` + `scrollTrigger: { trigger, start, end, scrub }` |
| Efecto máscara del hero | `mask-size` animado vía CSS Module + timeline (ver `Hero.tsx`) |
| Entrada de lista/grid | `stagger` 30–50ms por item |
| Micro-interacción | `transform`/`opacity` 150–300ms |

## Execution Steps

1. Crea el `ref` del contenedor y registra el plugin.
2. En `useEffect`: crea la timeline dentro de `gsap.context`; selectores dentro del scope del ref.
3. Devuelve `() => ctx.revert()`.
4. Verifica con `prefers-reduced-motion` activado.

## Output Contract

Animación que se limpia al desmontar, anima solo `transform`/`opacity`, respeta reduced-motion y usa `trigger` explícito con scrub.

## References

- `../../../src/features/home/components/Hero.tsx` — ejemplo real (timeline + máscara)
- `../../../src/features/home/components/Hero.module.css` — máscara y gradientes
