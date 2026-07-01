# AGENTS.md — Only G (plataforma de productora musical)

> Biblia del proyecto para agentes de IA. Las reglas aquí **mandan** sobre los
> defaults. Si algo contradice el código real, gana el código: avísalo.

## Qué es esto

Web-app **mobile-first** para una productora musical que gestiona artistas,
eventos y producciones. Inspiración de diseño: la landing oficial de **GTA VI**
(Rockstar) — oscura, cinematográfica, scroll-driven. Los artistas se presentan
al estilo de los personajes del juego.

A futuro: cuentas de fans, contenido exclusivo, tienda de merch y, posiblemente,
una app móvil nativa. La arquitectura se mantiene **portable** (lógica desacoplada
de la UI) para no reescribir cuando llegue ese día.

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Lenguaje | TypeScript (strict) |
| Estilos | Tailwind v4 (vía `@tailwindcss/postcss`) |
| Backend / DB | Firebase (Auth + Firestore + Storage) — proyecto `only-g-music-745ca` |
| Animación | GSAP + ScrollTrigger |
| PWA | manifest + metadata mobile-first |
| Gestor de paquetes | **pnpm** (nunca npm ni yarn) |

## Comandos

```bash
pnpm dev      # desarrollo (http://localhost:3000)
pnpm build    # build de producción (type-check + lint incluidos)
pnpm start    # servir el build
pnpm lint     # eslint
pnpm format   # prettier --write .
```

> pnpm bloquea scripts de build de dependencias por seguridad. Los aprobados
> viven en `pnpm-workspace.yaml` bajo `allowBuilds:` (NO en `package.json`).

## Estructura

```
src/
  app/                  Rutas (App Router), layout, globals.css
  features/<dominio>/    Cada dominio autocontenido (home, artists, auth, events…)
    components/
  components/
    ui/                 Piezas reutilizables (Button, Modal…)
    icons/              SVGs inlineados como componentes (para currentColor)
  lib/
    firebase/           ÚNICO punto de acceso a Firebase
    gsap/               Utilidades de animación
  domain/               Tipos + validaciones puras (portables a futuro nativo)
public/
  fonts/  logo/  hero/  icons/   manifest.webmanifest
```

## Estrategia de repositorios y paquetes

**Un solo repo git (monorepo)** vía pnpm workspaces — NO repos git separados. Los
nuevos paquetes y repositorios se crean **a medida que avanza cada fase**, con un
consumidor real, nunca de forma especulativa (sin carpetas vacías "por si acaso").

- **Paquetes del workspace** (cada uno cuando llegue su fase):
  - `apps/web` — la app Next actual (se reestructura a `apps/web` recién cuando exista un 2º paquete; hoy vive en la raíz).
  - `apps/functions` — Cloud Functions (**Fase 5**: auto-inicio de sesión a 30 min, push FCM, limpieza TTL).
  - `packages/domain` — tipos puros compartidos (extraer de `src/domain` cuando functions/mobile lo consuman).
  - `apps/mobile` — app nativa (**Fase 9**, solo si hace falta).
- **Repository pattern (data-access)**: un `*-repo.ts` por dominio, creado al construir su feature
  (`user-repo`, `quote-repo`, `booking-repo`, `session-repo`…). La UI nunca toca Firebase directo.

## Convenciones (no negociables)

- **La UI nunca llama a Firebase directo.** Todo acceso pasa por `src/lib/firebase/`.
  Esto mantiene la lógica portable y testeable.
- **Organización por feature**, no por tipo de archivo.
- **Tailwind primero** para estilos. CSS Modules solo para lo que Tailwind no
  expresa bien (animaciones complejas, máscaras, gradientes con sombras).
- **`"use client"` solo cuando haga falta** (estado, efectos, GSAP). Mantén los
  client components pequeños; el resto, Server Components.
- **Iconos**: inlineados en `components/icons/` para colorearlos con `currentColor`
  desde Tailwind. No usar `<img>` para SVGs que deban heredar color.
- **Secrets**: las `NEXT_PUBLIC_FIREBASE_*` van en `.env.local` (gitignored).
  El config de Firebase es público por diseño; la seguridad real son las
  **reglas** de Firestore/Storage.
- **Design tokens**: centralizados en `src/app/globals.css` bajo `@theme`
  (fuentes OGM, animaciones). No hardcodear valores que ya son tokens.
- **Aislamiento de roles (invariante de seguridad)**: `productor` ≠ `admin`. Un
  `productor` sin `admin` NUNCA accede a finanzas/ingresos/cobros ni lee reservas
  ajenas. Toda función de dinero va gateada por `isAdmin()` en **reglas** (no solo
  en UI). Como las reglas de Firestore son a nivel de **documento, no de campo**,
  el productor **nunca lee `bookings`** (llevaría el `amount`): consume la
  proyección **`sessions`** (`Sesion` en `src/domain/booking.ts`, sin datos
  financieros). Separar el dinero del dato operativo es de diseño, no de confianza.

## Lenguaje de diseño

Oscuro, cinematográfico, tipografía grande (fuentes de marca **OGM**). Reveals
guiados por scroll (GSAP ScrollTrigger). Mobile-first siempre: diseña para el
celular y escala hacia arriba. Limpia los `ScrollTrigger` con `gsap.context` y
`ctx.revert()` al desmontar.

## Roadmap

Estructura: **fundación común** → **dos tracks paralelos** (Captación · Operativo) →
**convergencia interna** (admin · consola productor) → **transversales** → **futuro**.
Tres decisiones lo fijan: pago **manual** (QR + comprobante + confirmación humana,
*payment-ready* para pasarela futura), **captación y operativo en paralelo**, y
**backend híbrido escalonado** (reglas+roles → Route Handlers → Cloud Functions).

### Completadas

0. ✅ Cimientos (Next + Firebase + hero con scroll).
1. ✅ Vitrina pública + perfiles de artista (estilo GTA VI). *Núcleo completo; pendiente contenido real del cliente.*
2. ✅ Auth + perfiles de usuario — **correo + Google + Facebook**, modelo de cuenta, reglas Firebase. **Roles múltiples**: `roles: Role[]` (`cliente | productor | admin | artista`). Regla: *"tiene el rol"*, nunca *"es el rol"*. *(Pendiente del cliente: desplegar `firestore.rules`.)*
3. ✅ Área de cuenta — UI de perfil (`UserMenu`, `/cuenta`, guard `RequireAuth`) + **edición de perfil** (`EditProfileModal`: nombre + avatar; `updateUserProfile` sobre `users/{uid}` sin tocar `roles` + `updateAuthProfile` sincroniza Firebase Auth + `refreshAccount`).

### Fase 4 — Fundación transversal *(desbloquea todo lo demás)*

- ✅ **4.1 Auth hardening**: reset de contraseña (modo en `/login`), verificación de email (al registrarse + reenvío en `/cuenta`), guards unificados (`RequireAuth` + `?next=`) y nuevo **`RequireRole`** sobre `hasAnyRole`.
- ✅ **4.2 `Sede` como entidad de primera clase**: `Sede {id, nombre, ciudad, direccion, qrPagoUrl?, horario, slots, productores[]}` en `src/domain/sede.ts` + `sedes` (data placeholder) + `sedes-repo`. Unificado: el wizard y `BookingCalendar` ya consumen la misma entidad (antes estaba duplicada). `quote.ts` usa `SedeId`.
- ✅ **4.3 Seam de notificaciones**: catálogo de eventos PURO (`src/domain/notification.ts`) +
  `notify()` desacoplado. **Implementación NATIVA Firebase** (no Novu — decisión por costo/control:
  10k eventos/mes gratis pero vendor + techo; nativo ≈ gratis a esta escala y el seam deja Novu como
  upgrade sin tocar llamadores). Hecho: **campanita in-app** (`NotificationBell`, Firestore +
  `onSnapshot`, badge en vivo, tabs no-leídas/todas, tiempo relativo, deep link al panel, i18n por
  evento es/en); **disparo desde Functions** en los 11 eventos (pago confirmado, sesión agendada,
  premium activado, cotización nueva/respondida, comprobante por revisar, perfil creado, mensaje
  nuevo) + **crons** (gasto recurrente por confirmar → /admin/gastos; perfil premium por renovar);
  **push web FCM** (token + `firebase-messaging-sw.js`, nudge DATA-only → la campanita muestra el
  detalle traducido; botón "activar push" no intrusivo). *Deploy: `firebase deploy --only
  functions,firestore:rules`. VAPID en `.env.local`. Pendiente menor: si se quiere texto del push
  por idioma, resolver server-side (hoy es nudge genérico).*
- ✅ **4.4 Observabilidad mínima**: NATIVO (no Sentry — consistente con 4.3; Sentry queda como
  upgrade). **Analytics de embudo** con Firebase Analytics (ya configurado): `src/domain/analytics.ts`
  (catálogo) + `track()` (`lib/firebase/analytics.ts`, lazy + guard, no-op SSR); cableados
  `quote_submitted` y `artist_profile_submitted` (más eventos = one-liner). **Errores**: `error-log.ts`
  (persiste a `errorLogs`, dedup + tope) + `GlobalErrorListener` (window.onerror/unhandledrejection) +
  `app/[locale]/error.tsx` (límite de error de ruta con reintento); reglas `errorLogs` (auth crea,
  admin lee). *Con esto la **Fase 4 (fundación transversal) queda COMPLETA**.*

### Fase 4.5 — Internacionalización (i18n) · **PRIORITARIA** *(foundational — antes de seguir creciendo)*

Estructura sólida de traducciones + cambio de idioma. **Se prioriza ahora porque la deuda
de cadenas crece lineal con la app**: montar el *seam* hoy hace que todo código nuevo nazca
con `t('clave')` en vez de español hardcodeado. Estado actual: ~68 componentes con texto
pegado y 22 rutas (campo virgen, sin librería i18n). Idiomas: **ES (base) + EN**, estructura
para N.

> **Decisiones de arquitectura**:
> - **Librería `next-intl`** (estándar de Next 15 App Router; soporta Server Components de
>   verdad, a diferencia de `react-i18next`; `next-i18next` es del Pages Router viejo).
> - **Routing `[locale]` visible**: `/es/...` · `/en/...` (URLs indexables + `hreflang`;
>   mejor SEO, engancha con la Fase 7). Toda la app cuelga de `app/[locale]/`.
> - **Catálogos** `messages/{es,en}.json` namespaced por feature, con **claves semánticas**
>   (`admin.finanzas.total`), NUNCA el texto como clave.
> - **Formato local-aware**: `formatCOP` ya usa `Intl` (ok); `fechaCorta`/`MONTHS_SHORT`
>   pasan a formateadores por locale.

- ✅ **4.5a — Infraestructura**: `next-intl` + segmento `[locale]` (todas las rutas movidas con
  `git mv` bajo `app/[locale]/`) + `src/middleware.ts` (detección/redirección; `/` → `/es`) +
  `src/i18n/{routing,navigation,request}.ts` + catálogos `messages/{es,en}.json` (namespace `nav`/
  `language`) + plugin en `next.config.ts`. Layout `[locale]/layout.tsx` con `<html lang>` por locale
  + `NextIntlClientProvider` + `setRequestLocale`. **Navegación migrada** a los primitivos de
  next-intl (`@/i18n/navigation`: `Link`/`useRouter`/`usePathname` — `useSearchParams`/`notFound`
  siguen de `next/navigation`). **Selector de idioma** `LanguageSwitcher` (ES/EN) en el menú; SiteMenu
  ya consume el catálogo (prueba de concepto). Verificado: `/es` y `/en` 200, `<html lang>` correcto,
  catálogo conmuta (Destacados↔Featured). *Pendiente menor pasado a 4.5b: helpers de fecha/número
  por locale.* ⚠️ Gotcha pnpm 11: `pnpm add` dejó build-scripts sin aprobar en `pnpm-workspace.yaml`
  (placeholders) → `ERR_PNPM_IGNORED_BUILDS` rompía `pnpm dev`; arreglado con `allowBuilds: true`.
- ✅ **4.5b — Extracción incremental**: COMPLETA. La migración se hizo de forma incremental
  feature por feature (la regla "todo texto nuevo al catálogo" la fue cerrando con cada fase);
  el remate final migró los últimos ~20 strings (aria-labels + textos del perfil de artista:
  `ArtistProfileLoader`, `ProfileAudioPlayer`, `SocialPalette`, `GalleryBento`, `PhotoViewer`,
  `GlassModal`, `SiteMenu`). 77/102 componentes ya usaban next-intl; el resto eran sin texto.
  *Quedan a propósito fuera: placeholders neutrales al idioma (URLs, números) y el
  `metadata.title` estático de `artistas/[slug]` → pertenece a 4.5c (SEO).*
- ✅ **4.5c — SEO multi-idioma**: COMPLETA. `metadataBase` + `openGraph` en el layout raíz;
  **hreflang/canonical POR PÁGINA** vía helper `src/lib/seo.ts` (`alternatesFor` + `SITE_URL`
  de `NEXT_PUBLIC_SITE_URL`) en home + páginas públicas (artistas/servicios/producciones/
  eventos/agenda); **`artistas/[slug]` pasó a `generateMetadata` dinámico** (título por artista
  vía REST de Firestore + descripción i18n + alternates); **`sitemap.ts`** (rutas públicas × es/en
  con alternates) y **`robots.ts`** (disallow de privadas; `/*/artista/` con barra para NO bloquear
  los perfiles públicos `/artistas/{slug}`). *Pendiente menor (fase 7): JSON-LD `MusicGroup`/
  `MusicArtist`, y perfiles dinámicos en el sitemap (requiere listar premium-visibles vía REST).
  **Con esto la Fase 4.5 (i18n) queda COMPLETA.***

> **⚠️ Convivencia**: 4.5a es incompatible con desarrollo de features en paralelo (mueve
> todo `app/`). Congelar el árbol o correr en worktree y mergear con el repo quieto.
> **Regla nueva desde 4.5a**: todo texto nuevo va al catálogo, NUNCA hardcodeado en el JSX.

### Track Captación (público que convierte)

5. ✅ **Perfiles que venden**: ✅ CTA "Cotizar con [artista]" en `/artistas/[slug]` → `/cotizar?colaborador=slug` (pre-llena el colaborador en el wizard); ✅ CTA "Edita tu perfil"/"Ajustes" para el dueño; ✅ social links muertos (`"#"`) ocultos; ✅ **insignia (Plata/Oro/Diamante) en el hero del perfil público** (`InsigniaBadge` cableado, derivada de `puntos`, lidera la fila de badges); ✅ retirada la maquinaria muerta de la semilla (`ProfileSource`/`artistToProfile`/`seedNotice`). **Código de la fase COMPLETO.** *Pendiente NO-código: bios/tracks/fotos reales + activar premium/curaduría desde admin (contenido y operación del cliente).*
6. **Portfolio + prueba social**: `/producciones` y `/eventos` con contenido real (casos, reproductor) + testimonios/reseñas.
7. **SEO y descubrimiento**: metadata por ruta, OG images, sitemap, structured data (`MusicGroup`), SSG/ISR en artistas/servicios.

### Track Operativo (ciclo end-to-end)

8. 🔨 **Modelo del ciclo de servicio**: ✅ entidades **`Reserva`**/**`Sesion`** + **máquina de estados pura** en `src/domain/booking.ts` (`canReservaTransition`, `nextReservaStates`, `isReservaActiva`) y `quote.ts` (`canQuoteTransition`, `nextQuoteStates`); ✅ `booking-repo` (`createReserva`, `getReservaById`, `listReservasByUser`); ✅ reglas de `bookings` (crea propio `pendiente_pago`, solo avanza a `pago_en_revision`; resto server-authoritative). *Pendiente: migrar `services` a Firestore (cuando exista admin/datos reales).*
9. ✅ **Reservas reales con disponibilidad** (1 productor/sede): el **productor define su disponibilidad mensual** (plantilla semanal + excepciones por fecha; **plantilla por defecto** Lun–Sáb aplicable con 1 clic; adelantable a meses/todo el año; **aviso estricto** si no la define). El calendario muestra día **libre / parcial (color medio) / lleno / cerrado**, **bloquea slots tomados** (anti-doble-reserva), consume el `?servicio=`, **persiste la reserva** (precio fijo → directa) + confirmación. *Hecho: dominio `availability.ts` + `availability-repo` + reglas; entidades/repos/reglas de `bookings` (fase 8); **editor del productor `/disponibilidad`** (plantilla semanal + excepciones por día + plantilla por defecto + adelantar 2/3 meses + aviso si no definida; gateado `RequireRole`); **calendario de reservas** integrado (consume disponibilidad → colorea libre/parcial/lleno/cerrado, slots tomados con duración multi-hora, **anti-doble-reserva vía transacción + agregado `daySlots`**, consume `?servicio=`, persiste la reserva en `pendiente_pago`). Pendiente real: pago/comprobante (fase 11) y "mis reservas" (fase 12).*
10. ✅ **Ciclo de cotización completo**: el estudio **responde en el hilo** (propuesta: precio + alcance), el cliente ve el estado y **acepta/rechaza ahí**; `aceptada` → **genera `Reserva`** con el monto (server-authoritative). *Hecho: el admin envía la propuesta y guarda `proposedPrice` en el quote (`setQuoteProposal`); el cliente acepta/rechaza desde `SolicitudDetail` (reglas: dueño solo `cotizada→aceptada/rechazada`, sin tocar el precio); **CF `onQuoteAccepted`** crea una `Reserva` tipo `proyecto` (sin slot) con el precio propuesto, idempotente vía `bookingId`. El ingreso entra a finanzas vía `reservasATransacciones` al confirmarse (no se duplica).*
11. 🔨 **Pago manual + confirmación**: `Reserva(pendiente_pago)` → **QR/datos de la sede** + **se abre un hilo** (chat cliente↔admin) → cliente **sube el comprobante en el hilo** → `pago_en_revision` → **productor/admin confirma** → `confirmada`. Reservas no pagadas **expiran** y liberan el slot. *Casi completa (auditoría): ✅ hilo de soporte por reserva, ✅ subir comprobante → `pago_en_revision` (`marcarPagoEnRevision` + reglas), ✅ expiración + liberar slot (`expireUnpaidBookings` cron). Pendiente: **poblar `qrPagoUrl`** de las sedes (dato, la UI ya lo consume) y, opcional, mover la confirmación del admin a server-side (hoy `updateBookingEstado` client-side gateado por `isAdmin`).*
12. 🔨 **"Mi cuenta" del cliente**: **mis cotizaciones** y **mis reservas**; cada una abre su **detalle con el hilo (chat) + estado** y queda **guardada y accesible días después**; **entregables descargables**. Cierra los callejones sin salida del embudo. *(Hecho: `/solicitudes` lista + `/solicitudes/[tipo]/[id]` detalle con **hilo en vivo** (`onSnapshot`) + **subir comprobante** (pendiente_pago→pago_en_revision); link en el menú de usuario. Pendiente: aceptar propuesta→genera reserva (server, fase 10), entregables, timeline visual.)*

> **Hilo unificado por solicitud**: cada `quote`/`booking` tiene una subcolección `messages` (chat cliente↔admin: `mensaje | propuesta | comprobante | sistema`) + adjuntos en Storage. Es la **fuente de verdad** (WhatsApp/email solo **notifican**, seam fase 4.3). El mismo mecanismo sirve para responder cotizaciones y para recibir comprobantes de pago.

### Convergencia — operación interna

13. 🔨 **Panel admin** (rol `admin`): gestión de contenido (artistas/servicios/producciones en Firestore), gestión de cotizaciones/reservas/pagos (responder hilos, confirmar pagos), **alta de artistas vinculada a un usuario** (autocompleta nombre/redes/tracks). **Finanzas/ingresos**: **tabla de transacciones** (cliente · servicio · fecha · monto · estado) + **estadísticas** (ingresos por mes comparados, mejores clientes), **derivadas de las reservas `confirmada`/`completada`** (una sola fuente de verdad; denormalizar nombre/email del cliente en la reserva para la tabla). *(Hecho 13a: bandeja `/admin` + `/admin/[tipo]/[id]` para responder el hilo como estudio, **enviar propuesta**, cambiar estado y **confirmar pago**; reglas `isAdmin()`. Hecho 13b: **`/admin/finanzas`** — ingreso total + ingresos por mes (barras) + mejores clientes + tabla de transacciones, derivado de reservas confirmadas (`finanzas.ts` puro); cliente denormalizado en `Reserva`. Pendiente: gestión de contenido (servicios/artistas a Firestore), alta de artistas.)*
14. 🔨 **Consola del productor** (rol `productor`). Lee la proyección **`sessions`** (sin `amount`/finanzas), NUNCA `bookings` directo — el productor no ve cobros (ver *Aislamiento de roles* en Convenciones).
    - ✅ **14a (sin Blaze)**: dominio `Sesion` + `SesionEstado` + máquina de estados + gracia de auto-inicio (`GRACIA_AUTO_INICIO_MIN`, `debeAutoIniciar`, `sesionDesdeReserva`) en `booking.ts`; `sessions-repo` (`createSesion`, `subscribeSessionsByProductor` con `onSnapshot`, `start/end/cancelSesion`, `getSesionByReserva`); reglas `sessions` (lee admin/productor-asignado/cliente; el productor solo cambia estado/tiempos de SU sesión); el admin **asigna el UID del productor y crea la sesión** al confirmar (en `AdminSolicitudDetail`); consola **`/consola`** (cola en vivo, temporizador, **auto-inicio a 30 min client-side** mientras la consola esté abierta); link en el menú. *Limitación MVP: no hay registro de productores (sedes con `productores: []`) → el admin pega el UID a mano; el auto-inicio solo dispara con la consola abierta.*
    - 🔨 **14b (Blaze, en curso)**: ✅ **andamiaje Cloud Functions** (`firebase.json`, `.firebaserc`, `functions/` con TS, 2ª gen). ⚠️ instalar **desde dentro de `functions/`** (`cd functions && npm install`), NUNCA `npm --prefix functions install` desde la raíz: un quirk de npm con `--prefix` sobre un paquete anidado le mete `only-g-web: file:..` (rompería el deploy). `functions/` usa **npm** (excepción a la regla pnpm; es su propio mundo de deploy). ✅ `onBookingConfirmed` deriva la proyección `sessions` al confirmar (id de sesión = id de reserva → idempotente); ✅ `onBookingCreatedAmountGuard` fuerza el precio del perfil server-side; el admin **asigna el UID del productor** (`setBookingProductor`) y el server crea la sesión. ✅ **`expireUnpaidBookings`** (cron 60 min): expira reservas `pendiente_pago` con +48h y **libera sus slots** en `daySlots`. ✅ **`autoStartSessions`** (cron 10 min): auto-inicia sesiones `programada` pasada la gracia de 30 min, **server-authoritative** (funciona con la app cerrada). Las funciones viven en `southamerica-east1` (región de Firestore). *Pendiente: chat efímero por sesión TTL 15 días, push FCM, validar montos de reservas de estudio (necesita servicios en Firestore), grant automático de rol artista+premium (opción no elegida aún), aviso de renovación de perfiles. Reestructura a `apps/web` diferida.* **Cada deploy lo hace el cliente con `firebase deploy --only functions` (el de los cron habilita Cloud Scheduler la 1ª vez). Deploy inicial (triggers) YA hecho y verde.**

### Fase 15 — Perfiles de Artista *(absorbe el pendiente de fase 13: artistas a Firestore + alta vinculada a usuario)*

Producto: el artista paga un **perfil full** (CV) que se muestra en la vitrina y
genera URL/QR compartible. Al registrarse elige **"solo explorar"** vs **"soy
artista"** (datos privados: nombre real + fecha nac. + trayectoria + foto
**obligatoria**). El perfil lo crea admin o el propio artista **tras confirmar el
pago**; **persiste 2 meses** y se renueva. Tiene **like** estilo red social.

> **Decisión de arquitectura — DOS EJES ORTOGONALES** (no mezclar mérito y dinero):
> 1. **Insignia/Nivel** (`plata → oro → diamante`): reputación GANADA por actividad
>    (likes recibidos, colaboraciones, y bonus al pagar). **Permanente.** Desbloquea
>    descuentos/funciones. Fuente de verdad: `puntos` (la insignia se DERIVA).
> 2. **Premium**: entitlement PAGADO (`{activo, since, expiresAt}`). **Expira a 2
>    meses.** Es lo que hace VISIBLE el perfil en la vitrina. El pago da puntos,
>    pero NO compra la insignia (así la insignia conserva su significado social).

> **Privacidad por diseño — DOS DOCUMENTOS**: `users/{uid}` (PRIVADO: `realName`,
> `birthDate`, `artistSlug`) vs `artistProfiles/{slug}` (PÚBLICO: identidad
> artística, fotos, tracks, socials, `puntos`, `premium`). El nombre real nunca
> sale del doc privado. Likes = subcolección `likes/{uid}` (un doc por usuario; el
> conteo se DERIVA del tamaño, sin contador que inflar).

- ✅ **15a — Foundation pública (sin Blaze)**: dominio `artist-profile.ts`
  (insignia/nivel, premium/expiry, trayectoria — todo **puro**) + `artist-profile-repo`
  (CRUD + like toggle + conteo derivado) + reglas (`artistProfiles` lectura pública;
  cliente no toca `uid/puntos/premium`; `esArtista()`). **Perfil público full** hecho:
  `ArtistProfileView` (hero con insignia + "verificado" premium + años de trayectoria,
  bio, redes, galería, **reproductores YT/Spotify con selector elegido por el
  visitante**, **like** con UI optimista, **compartir + QR** vía lib `qrcode`).
  **Canción de fondo del perfil** (`ProfileAudioPlayer`): onda reactiva al sonido
  (Web Audio AnalyserNode; **sintética animada** si el bucket no tiene CORS),
  play/pausa/repetir, barra seekable y **mini-player que se acopla a una esquina al
  hacer scroll** (efecto pom/pam). El artista sube la canción en el editor
  (`entryTrackUrl`, audio en Storage). Onda REAL = requiere **CORS del bucket**
  (`cors.json` en la raíz + `gcloud storage buckets update gs://<bucket> --cors-file=cors.json`).
  `ProfileTrack` lleva `youtubeUrl?`/`spotifyUrl?` (el visitante elige plataforma);
  embeds puros en `embeds.ts`; mapper `profile-display.ts` adapta la semilla al modelo
  (la ruta `/artistas/[slug]` ya usa la vista nueva con `source="seed"`). *Pendiente
  (pasa a 15b): leer perfiles reales de Firestore con fallback a semilla + migrar la
  vitrina/grid + `images.remotePatterns` para fotos de Storage.*
- ✅ **15b — Onboarding (sin Blaze)**: ✅ alta de artista `/artista/nuevo` (datos
  privados `realName`/`birthDate` en `users/{uid}` + foto obligatoria + `artistDraft`)
  que **reusa el pago manual** vía `bookings` con `tipo:'perfil_artista'` (`profile-order.ts`,
  `PRECIO_PERFIL`) → redirige al hilo a subir comprobante; ✅ **editor del perfil**
  `/artista/perfil` (`RequireRole artista`; crea/edita `EditableProfile`, prellena del
  draft; el cliente no toca puntos/premium); ✅ **vista pública lee Firestore** con
  fallback a semilla (`ArtistProfileLoader`) + `images.remotePatterns` para Storage; ✅
  **admin `/admin/perfiles`** activa/renueva premium (2 meses, `setPremium`+`activarPremium`);
  ✅ entradas en menú/vitrina. ✅ **vitrina/grid lee perfiles reales** de Firestore con
  fallback a semilla (`ArtistsShowcase` + `profileToArtist`, premium vigente). ✅ **toggle
  explorar/artista en el registro** (`/login`: enruta a `/artista/nuevo` si elige artista;
  el rol sigue otorgándose tras el pago, no en el registro). **Grant del rol `artista` =
  MANUAL en consola Firebase** (sin Blaze; se automatiza en 15c). *15b cerrado salvo esa
  automatización del rol.*
- ✅ **15c — Blaze**: ✅ **puntos server-authoritative** (Functions `onLikeAdded`/`onLikeRemoved`
  ajustan `puntos` del perfil al dar/quitar like; `onBookingConfirmed` otorga `PUNTOS_PAGO_PERFIL`
  al confirmar el pago del perfil, idempotente vía flag `puntosOtorgados`) → la insignia se gana
  de verdad. ✅ **expiración**: el vencido ya se oculta de la vitrina (`perfilVisible` filtra
  `premiumEstado!=='activo'`) + **aviso de renovación** en el editor (chip Vence en Nd / Vencida +
  botón Activar/Renovar que reusa el pago de perfil). ✅ **OG images dinámicas** por perfil
  (`artistas/[slug]/opengraph-image.tsx` — lee el perfil público vía REST de Firestore, tarjeta
  con nombre/género/acento, fallback de marca). *Deploy de Functions: cliente con `firebase deploy --only functions`.*
- 🔨 **15d — Editor in-place (rediseño UX del perfil)**. Decisiones: el perfil se
  construye **WYSIWYG sobre plantilla fija** (no formulario) con slots clickeables y
  **auto-guardado**; **construir borrador → pagar para publicar** (`published` + premium
  vigente = `perfilPublicado`); **galería bento** (tamaños 1×1/2×1/2×2 + reordenar,
  `GALLERY_LIMIT=6`, escalado uniforme sin deformar); **foto con ajuste** (zoom/pan/rotar,
  transform guardada, no recorte); **registro con pre-carga** (nombre artístico,
  trayectoria, foto opcional) para que la plantilla nazca con base.
    - ✅ **15d-1 (fundación)**: `SocialPlatform` extendido (Facebook/TikTok/Threads) +
      `SOCIAL_PLATFORMS`; iconos nuevos; `SOCIAL_META` compartido (`features/artists/lib/socials.ts`);
      **paleta de redes** `SocialPalette` (botón `+` → iconos circulares de las redes que
      faltan) integrada en el editor y en el perfil público; flag `published` + `GALLERY_LIMIT`
      + `perfilPublicado()` en el dominio.
    - ✅ **15d-2 (editor in-place)**: `ProfileBuilder` reemplaza el formulario — plantilla
      WYSIWYG con slots (foto principal con dropzone/cambiar, nombre·frase·género·ciudad·año
      como inputs in-situ sobre el hero, bio, redes con `SocialPalette`, canción con dropzone
      + reproductor, galería con límite, temas) y **auto-guardado** debounced (indicador
      Guardando/Guardado ✓). Subidas vía `uploadUserFile` directo (`UploadButton`, sin chips).
      Reusa los fixes (load-once, synced/refreshAccount, ignoreUndefinedProperties). El form
      `ProfileEditor` se eliminó.
    - ✅ **15d-3 (ajuste de foto)**: `PhotoTransform` (scale/x/y/rotation) + `photoTransformCss`
      en el dominio; en el builder, modo "Ajustar" sobre el hero (arrastrar = pan, sliders de
      zoom y rotación, girar 90°, restablecer) que guarda la transform vía auto-save; aplicada
      también al hero del perfil público. Sin recorte/re-subida (CSS transform, reversible).
    - ✅ **15d-4 (galería bento ordenable)**: `GalleryItem {url, span}` (sq/wide/tall/big) +
      `GALLERY_SPAN_CLASS`; reordenar con **dnd-kit** (`GalleryBento`, press-and-hold en móvil,
      pista "✥ Mover") + botón ⤢ para ciclar tamaño; visor **lightbox** (`PhotoViewer`, swipe/Esc,
      portal a body); botón de editar junto al título "Galería".
    - ✅ **15d-5 (publicación)** — *con cambio de criterio*: la pre-carga del registro ya existía
      (`artistDraft`); se implementó "borrador sin rol" (reglas por propiedad del slug + guard
      `RequireAuth` en `/artista/perfil`). **PAGAR = PUBLICAR**: se descartó el flag manual
      `published`/`perfilPublicado`; la vitrina muestra premium vigente (`perfilVisible`),
      ordenada por curaduría admin.
    - ✅ **Curaduría admin + diseño** (fuera del plan original): campos `orden`/`featured`
      (solo-admin en reglas) + UI en `/admin/perfiles` (↑/↓ ordenar, ★ destacados máx 4); el menú
      "Destacados" lee `getFeaturedProfiles`. Sistema **Liquid Glass** propio (`components/ui/glass`,
      `GlassButton`/`GlassCard`/`GlassModal`) aplicado a botones/contenedores/reproductor.

⚠️ "Sonar canción al entrar": el autoplay con sonido lo **bloquea el navegador**;
se resuelve con botón flotante "▶ Sonando: [tema]" que arranca al primer tap.

### Fase 16 — Módulo Contable *(operación interna; extiende la 13b `/admin/finanzas`)*

Capa de **gestión + reportes para inversores**, NO libros legales. La app es fuente de
verdad de los ingresos que nacen en ella + **libro manual** para el resto + capa de
presentación. Los libros legales (DIAN/NIIF/partida doble/factura electrónica) los lleva
un **contador con software certificado** (Siigo/Alegra); la app **reconcilia, no
reemplaza**. Estados financieros **simplificados** (el dueño no maneja contabilidad).

> **Decisión — DOS DISCIPLINAS, no mezclar**: *contabilidad de gestión* (dashboards de
> flujo, ya en 13b) vs *contabilidad financiera* (P&L + Balance). El módulo hace ambas en
> versión presentable, NUNCA libros certificados. Ecuación que siempre cuadra: **Activos =
> Pasivos + Patrimonio**.

> **Tres lados del libro** (todos PUROS en `src/domain/contabilidad.ts`, como `finanzas.ts`):
> 1. **Ingresos (automáticos)** — derivados de `Reserva` confirmada+ (reusa `finanzas.ts`);
>    se añade dimensión **stream/fuente** (sesión · perfil_artista · *futuro:* suscripción ·
>    merch) y agrupación por **sede**/**productor** (datos ya en `Reserva`). Seam listo para
>    que subs/merch escriban igual y enciendan los dashboards solos.
> 2. **Gastos (manuales)** — `movimientos` append-only: categoría (nómina/arriendo/servicios/
>    equipos/marketing/software/impuestos), monto, fecha, `recurrencia` (único/mensual/anual),
>    sede?, comprobanteUrl?.
> 3. **Activos · Pasivos · Patrimonio (manual)** — `activos` (foco **activos fijos/PP&E**:
>    equipos de producción/grabación, cómputo, instrumentos, mobiliario, inmueble — con
>    `valorAdquisicion`, `fechaAdquisicion`, `fotoUrl?`, `sede?`, y opcional `vidaUtilMeses` +
>    `valorResidual` → depreciación lineal → valor en libros); `pasivos` (préstamos/cuentas
>    por pagar); Patrimonio = Activos − Pasivos (+ capital aportado).

> **Aislamiento de rol (invariante)**: TODO es admin-only. Respeta que el productor NUNCA
> ve cobros/finanzas. Opción: rol `contador` (ve finanzas, no opera). Reglas Firestore:
> colecciones financieras (`movimientos`/`activos`/`pasivos`) solo admin. **Append-only +
> auditoría** (`createdBy`/`createdAt`): no se borra, se reversa. COP (`formatCOP`); IVA
> diferido (campo opcional, lo define el contador).

- ✅ **16a — Bienes/activos (foundation)**: dominio `contabilidad.ts` puro + `activos-repo` +
  reglas; UI **inventario de bienes** (tabla/galería con valor, foto, sede, valor en libros).
  *Hecho: entidad `Activo` + depreciación lineal + valor en libros (puros, `ahora` inyectado);
  `activos-repo` append-only con baja lógica + auditoría; reglas `activos` admin-only;
  `/admin/bienes` (resumen + desglose por categoría + alta `AddActivoModal` + baja con motivo).*
- ✅ **16b — Gastos + Estado de Resultados**: `movimientos-repo`; **panel de flujos** extendido
  (ingresos por stream/sede/productor + **rango de fechas** + gráficos, sobre `/admin/finanzas`);
  **P&L** (ingresos − gastos por periodo).
  *Hecho: dominio `Movimiento` + `estadoResultados` (puro); `movimientos-repo` append-only con
  anulación lógica; `/admin/gastos` (gestión + desglose por categoría); **P&L en `/admin/finanzas`**
  con selector de periodo (mes/año/todo/custom) → utilidad + margen + gastos por categoría.*
- ✅ **16c — Balance + export**: `pasivos-repo`; **Balance General simplificado** (Activos =
  Pasivos + Patrimonio, cuadrando); **exportar PDF/CSV** para contador/inversores.
  *Hecho: dominio `Pasivo` + `balanceGeneral` (Patrimonio derivado, cuadra por construcción);
  `pasivos-repo` append-only con liquidación lógica; `/admin/balance` (hoja de balance + gestión
  de pasivos); **export** `contabilidad-export.ts` puro → CSV (números crudos + BOM) y PDF vía
  impresión del navegador (`balanceToHTML` → window.print). jsPDF queda como upgrade futuro.*

> **No hace**: libros legales DIAN, factura electrónica, partida doble. Depende solo de
> `Reserva`/`finanzas` (✅ ya existe); NO de suscripciones/merch (alimentan el seam después).

### Transversales (cuando aplique, no una fase única)

- **Legal/cumplimiento**: Habeas Data (Ley 1581), términos, **política de cancelación/reembolso** (manual). Antes de operar con datos + dinero reales.
- **Entregables vs chat efímero**: el producto final (mezcla/master) necesita **almacenamiento durable ligado a la cuenta**, distinto del TTL de 15 días del chat.

### Futuro

15. Tienda de merch *(pospuesto)*.
16. *(opcional)* Pasarela de pago real (Wompi/Mercado Pago) cuando el volumen lo justifique — el flujo ya quedó *payment-ready* desde la Fase 11.
17. App nativa *(solo si hace falta, y lo último de todo)*.

### Máquina de estados del ciclo (spine del negocio)

```
A cotizar:   Solicitud(pendiente) → [estudio] cotizada → [cliente] aceptada / rechazada
Precio fijo: /servicios → agendar ──────────────────────────┐
                                                            ▼
                                              Reserva(pendiente_pago)
                              → [sube comprobante] pago_en_revision
                              → [productor/admin confirma] confirmada
                              → en_curso → completada → entregables
                              → cancelada / expirada (libera slot)
```

Transiciones como **funciones puras en `src/domain`** (`canTransition`, `nextStates`),
compartidas por cliente y servidor.

> **Secuencia recomendada**: 4 → 8 → (5 ∥ 9) → 10 → 11 → 12 → (6/7) → 13 → 14.

## Skills del proyecto

En `.claude/skills/`. Se activan automáticamente por contexto:

| Skill | Cuándo se usa |
|-------|---------------|
| `design-ux` | Diseñar o revisar UI: pantallas, componentes, color, tipografía, layout, accesibilidad. |
| `gsap-animations` | Animaciones, efectos de scroll, transiciones, el reveal del hero. |
| `typescript` | Tipos, interfaces, genéricos, modelado de dominio, type-safety. |
| `react-next` | Componentes, hooks, Server/Client, App Router, Suspense (React 19 + Next 15). |
| `tailwind` | Estilos con Tailwind v4: tokens `@theme`, responsive, variantes de estado. |
| `infra-firebase` | Firestore/Storage/Auth/Functions, reglas de seguridad, índices, TTL, deploy. |
| `clean-code` | Buenas prácticas, patrones, refactor, capas, repository, naming, YAGNI/SOLID. |
