"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { GlassButton } from "@/components/ui/GlassButton";
import { ArrowLeftIcon } from "@/components/icons";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { UserMenu } from "@/features/auth/components/UserMenu";

const HERO_IMG =
  "https://storage.googleapis.com/only-g-music-745ca.firebasestorage.app/hero";

/**
 * Shell del panel admin: fondo de imagen COMPARTIDO por todas las pestañas +
 * botón de volver (izquierda) + campanita y avatar (derecha). SIN menú lateral:
 * la navegación vive en los "Accesos rápidos" del dashboard. El botón de volver
 * es contextual: desde el dashboard sale al sitio (`/`); desde una sección
 * interna vuelve al panel (`/admin`).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const onDashboard = pathname === "/admin";

  return (
    <div className="bg-ink relative isolate min-h-dvh text-white">
      {/* Fondo compartido: imagen del estudio a pantalla completa (fija) y
          atenuada, DETRÁS de todas las pestañas. `isolate` la mantiene por encima
          del bg-ink y deja que el backdrop-blur de las cards la frostee. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
      >
        <picture>
          <source
            media="(max-width: 640px)"
            srcSet={`${HERO_IMG}/admin-panel-mobile.png`}
          />
          <img
            src={`${HERO_IMG}/admin-panel.png`}
            alt=""
            className="h-full w-full object-cover"
          />
        </picture>
        <div className="from-ink/70 via-ink/40 to-ink/75 absolute inset-0 bg-gradient-to-b" />
      </div>

      <GlassButton
        href={onDashboard ? "/" : "/admin"}
        className="fixed top-4 left-4 z-[96] sm:top-5 sm:left-6"
      >
        <ArrowLeftIcon className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
        {onDashboard ? t("nav.home") : t("adminNav.back")}
      </GlassButton>

      {/* Topbar: campanita + avatar (fijos arriba a la derecha). */}
      <NotificationBell align="right" />
      <UserMenu align="right" />

      {children}
    </div>
  );
}
