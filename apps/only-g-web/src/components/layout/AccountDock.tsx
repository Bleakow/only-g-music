"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { UserMenu } from "@/features/auth/components/UserMenu";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { DockIconButton } from "@/components/ui/DockIconButton";
import { IconButton } from "@/components/ui/IconButton";
import { ChatIcon, NoteIcon } from "@/components/icons";
import { openChat } from "@/features/conversations/lib/open-conversation";
import { glassSurfaceSoft } from "@/components/ui/glass";
import { onIntroReady } from "@/components/loaders/intro-ready";

// URL de la app hermana G Notes (handoff SSO). Override con NEXT_PUBLIC_GNOTES_URL;
// si no, la URL estable de App Hosting en prod o localhost en desarrollo.
const GNOTES_URL =
  process.env.NEXT_PUBLIC_GNOTES_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://g-notes--only-g-music-745ca.us-east4.hosted.app");

// Cápsula y dock móvil comparten el MISMO material de cristal que el dropdown
// (glassSurfaceSoft ~ glassSurfaceMenu) para que todo "pegue" y no contraste.
const CAPSULE = `${glassSurfaceSoft} flex items-center gap-0.5 rounded-full px-1.5 py-1`;
const MOBILE_DOCK = `${glassSurfaceSoft} flex items-center gap-1.5 rounded-full px-2 py-1`;

/**
 * Dock de cuenta/acciones GLOBAL (solo con sesión). Unifica avatar + campana +
 * chat + G Notes.
 *
 * - Desktop: cápsula glass con iconos PELADOS (solo el avatar con círculo), a la
 *   izquierda de la hamburguesa. Orden izq→der: Campana · Chat · Notas · Avatar.
 * - Móvil: avatar suelto arriba-izquierda + dock circulado abajo (oculto en
 *   perfiles).
 *
 * Al terminar el loader, la cápsula ENTRA con un fade + pop (como un bloque, para
 * no arriesgar ocultar iconos). Se oculta con el menú grande (`ogm:menu`) o el
 * visor de fotos (`ogm:viewer`).
 */
export function AccountDock() {
  const { user } = useAuth();
  const t = useTranslations();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMenu = (e: Event) =>
      setMenuOpen((e as CustomEvent<boolean>).detail);
    const onViewer = (e: Event) =>
      setViewerOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener("ogm:menu", onMenu as EventListener);
    window.addEventListener("ogm:viewer", onViewer as EventListener);
    return () => {
      window.removeEventListener("ogm:menu", onMenu as EventListener);
      window.removeEventListener("ogm:viewer", onViewer as EventListener);
    };
  }, []);

  // Señal de "el loader terminó" (se reinicia en cada recarga completa).
  const [intro, setIntro] = useState(false);
  useEffect(() => onIntroReady(() => setIntro(true)), []);

  // Entrada (DESKTOP): la cápsula se DESPLIEGA hacia la izquierda desde el avatar.
  // Reveal por `clip-path` anclado a la derecha: arranca mostrando solo el avatar
  // (pill pequeña) y crece hacia la izquierda descubriendo el resto. `clearProps`
  // borra el clip al terminar → los botones SIEMPRE están en el DOM a opacidad
  // plena; ninguno puede quedar tapado (a prueba del bug del chat). El `round
  // 9999px` mantiene las esquinas redondeadas en cada fotograma del crecimiento.
  // `gsap.context` + revert = seguro ante el doble-montaje de StrictMode.
  const hasUser = Boolean(user);
  useEffect(() => {
    if (!intro || !hasUser) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      if (capsuleRef.current) {
        const w = capsuleRef.current.offsetWidth;
        const avatarSlot = 50; // avatar (~44px) + padding derecho (~6px)
        const leftInset = w > avatarSlot ? ((w - avatarSlot) / w) * 100 : 0;
        gsap.fromTo(
          capsuleRef.current,
          { clipPath: `inset(0px 0px 0px ${leftInset}% round 9999px)` },
          {
            clipPath: "inset(0px 0px 0px 0% round 9999px)",
            duration: 0.75,
            ease: "power3.out",
            delay: 0.1,
            clearProps: "clipPath",
          },
        );
      }
      if (mobileRef.current) {
        gsap.from(mobileRef.current, {
          autoAlpha: 0,
          y: 14,
          duration: 0.5,
          delay: 0.1,
          ease: "power2.out",
        });
      }
    });
    return () => ctx.revert();
  }, [intro, hasUser]);

  if (!user || menuOpen || viewerOpen) return null;

  const isProfile = /^\/(artistas\/[^/]+|artista\/)/.test(pathname);
  // El avatar suelto de móvil SOLO va en el inicio: en páginas internas (que
  // tienen su propio botón "atrás" arriba-izquierda) se solaparían.
  const isHome = pathname === "/";

  async function openGNotes() {
    if (!GNOTES_URL) return;
    // Hand-off SSO: el ID token viaja en el FRAGMENTO (#…), no al servidor ni al
    // Referer. G Notes lo canjea por su sesión. Si falla, salta y pide login.
    try {
      const token = await user!.getIdToken();
      window.location.href = `${GNOTES_URL}/#sso=${encodeURIComponent(token)}`;
    } catch {
      window.location.href = GNOTES_URL;
    }
  }

  const noteBadge = (
    <span className="bg-amethyst-500 pointer-events-none absolute -top-0.5 -right-0.5 rounded-full px-1.5 py-px text-[0.5rem] font-bold tracking-wide text-white uppercase shadow-[0_2px_8px_rgba(124,58,237,0.6)]">
      {t("gnote.badge")}
    </span>
  );

  return (
    <>
      {/* DESKTOP: cápsula pelada, abajo-izquierda del menú. Orden izq→der:
          Campana · Chat · Notas · Avatar (avatar como ancla derecha). */}
      <div ref={desktopRef} className="fixed top-6 right-28 z-[105] hidden sm:block">
        <div ref={capsuleRef} className={CAPSULE}>
          <NotificationBell docked bare align="right" />
          <DockIconButton aria-label={t("chat.open")} onClick={openChat}>
            <ChatIcon className="size-5" />
          </DockIconButton>
          {GNOTES_URL && (
            <div className="relative">
              <DockIconButton
                aria-label={t("gnote.aria")}
                title={t("gnote.soon")}
                onClick={openGNotes}
              >
                <NoteIcon className="size-5" />
              </DockIconButton>
              {noteBadge}
            </div>
          )}
          <UserMenu docked align="right" avatarSize={34} />
        </div>
      </div>

      {/* MÓVIL: avatar suelto arriba-izquierda — SOLO en el inicio (en páginas
          internas solaparía el botón "atrás" de la cabecera). */}
      {isHome && (
        <div className="fixed top-4 left-6 z-[105] sm:hidden">
          <UserMenu docked align="left" avatarSize={44} />
        </div>
      )}

      {/* MÓVIL: dock circulado centrado abajo; oculto en perfiles. */}
      {!isProfile && (
        <div
          ref={mobileRef}
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 sm:hidden"
        >
          <div className={MOBILE_DOCK}>
            <NotificationBell docked align="right" />
            <IconButton aria-label={t("chat.open")} onClick={openChat}>
              <ChatIcon className="size-6" />
            </IconButton>
            {GNOTES_URL && (
              <div className="relative">
                <IconButton
                  aria-label={t("gnote.aria")}
                  title={t("gnote.soon")}
                  onClick={openGNotes}
                >
                  <NoteIcon className="size-5" />
                </IconButton>
                {noteBadge}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
