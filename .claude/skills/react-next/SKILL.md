---
name: react-next
description: "Trigger: React, Next, componente, hook, useEffect, useState, server component, client, 'use client', App Router, render, Suspense, params. Patrones React 19 + Next 15 para Only G."
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0"
---

# React + Next.js — Only G

## Activation Contract

Usar al crear o editar componentes, hooks, páginas o layouts (Next 15 App Router + React 19).

## Hard Rules

- **Server Components por defecto.** Añade `"use client"` solo si hay estado, efectos, eventos o APIs del navegador. Empuja el `"use client"` a las hojas; mantén los client components pequeños.
- **Sin lógica de datos/Firebase en componentes** → va en repos (`*-repo.ts`).
- **Deriva, no sincronices**: calcula en render desde props/estado. Evita `useEffect` solo para copiar props a estado.
- **`useEffect` solo para efectos externos** (listeners, subscripciones); SIEMPRE devuelve cleanup. Cancela async obsoletos con bandera (`let active = true`).
- **`useSearchParams`/`usePathname`** requieren `"use client"`; **`useSearchParams` debe ir dentro de `<Suspense>`** (si no, rompe el prerender).
- **`params` es `Promise`** en Next 15: `await params` en server components / `use(params)` en client.
- **`next/image`** con dimensiones (evita CLS); **`next/link`** para navegación interna (no `<a>`).
- **Reglas de hooks**: nada de hooks condicionales; `key` estable en listas (no índice si reordena).
- **Estados explícitos**: loading / vacío / error, no solo el happy path.

## Decision Gates

| Caso | Patrón |
|------|--------|
| Solo render de datos | Server Component (sin "use client") |
| Estado/efecto/evento | Client Component pequeño en la hoja |
| Leer query params | `"use client"` + `useSearchParams` dentro de `<Suspense>` |
| Datos derivados | Calcular en render, no `useEffect` |
| Suscripción/listener | `useEffect` con cleanup + bandera de cancelación |

## Output Contract

Componentes Server por defecto, client mínimos y en hojas, efectos limpiados, params con await, imágenes con `next/image`. Compila con `pnpm exec tsc --noEmit`.

## References

- `../../../AGENTS.md`
- `../../../src/features/auth/components/AuthProvider.tsx` — provider client con cleanup
