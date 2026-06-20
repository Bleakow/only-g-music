# Only G Music

Web-app **mobile-first** de la productora musical **Only G Music**: vitrina de
artistas, cotizaciones y reservas con disponibilidad y **pago manual**, perfiles
de artista premium (likes, QR, reproductores YouTube/Spotify), panel de gestión
con finanzas y **consola del productor**. Estética oscura y cinematográfica
(inspiración GTA VI), scroll-driven.

> La biblia del proyecto (arquitectura, roadmap, convenciones y decisiones) vive
> en **[AGENTS.md](AGENTS.md)**. Este README es solo el arranque.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Lenguaje | TypeScript (strict) |
| Estilos | Tailwind v4 |
| Backend / DB | Firebase (Auth · Firestore · Storage · Cloud Functions) |
| Animación | GSAP + ScrollTrigger |
| Gestor de paquetes | **pnpm** (la web) · **npm** (solo `functions/`) |

## Requisitos

- **Node 20+**
- **pnpm** (`corepack enable` o `npm i -g pnpm`)
- Un proyecto de **Firebase** (este usa `only-g-music-745ca`). El plan **Blaze**
  solo hace falta para desplegar Cloud Functions.

## Puesta en marcha (local)

```bash
pnpm install
cp .env.example .env.local      # rellena con tu firebaseConfig (valores públicos)
pnpm dev                        # http://localhost:3000
```

> ⚠️ Las imágenes de `public/hero/` (placeholders / fotos de terceros) **no están
> en el repo** por copyright. Algunas imágenes semilla de artistas/productores se
> verán rotas hasta que coloques las tuyas. El fondo de marca del hero sí está.

## Scripts

```bash
pnpm dev      # desarrollo
pnpm build    # build de producción (type-check + lint)
pnpm start    # servir el build
pnpm lint     # eslint
pnpm format   # prettier --write .
```

## Estructura

```
src/
  app/          Rutas (App Router), layout, globals.css
  features/     Cada dominio autocontenido (home, artists, auth, booking, admin, console…)
  components/   ui/ (Button, Modal…) · icons/ (SVGs inline)
  lib/firebase/ ÚNICO punto de acceso a Firebase
  domain/       Tipos + lógica pura (portable)
functions/      Cloud Functions (su propio paquete, npm)
firestore.rules · storage.rules
```

## Firebase

El acceso a datos pasa **siempre** por repos (`*-repo.ts`); la UI nunca toca
Firebase directo. La seguridad real son las **reglas** (la config del cliente es
pública por diseño).

### Reglas

```bash
firebase deploy --only firestore:rules,storage:rules
```

### Cloud Functions (requiere Blaze)

```bash
cd functions && npm install      # npm, NO pnpm (es su propio paquete)
cd .. && firebase deploy --only functions
```

## Roles

`cliente · artista · productor · admin` (acumulables; regla de oro: *"tiene el
rol"*, nunca *"es el rol"*). Solo `cliente` se auto-asigna al registrarse; el
resto se otorgan por consola / Admin SDK. Detalle en [AGENTS.md](AGENTS.md).
