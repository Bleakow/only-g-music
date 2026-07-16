"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "./AuthProvider";
import { RequireAuth } from "./RequireAuth";
import { hasAnyRole, type Role } from "@only-g/shared-types/user";

/**
 * Guard de ruta por ROL. Primero exige sesión (vía RequireAuth) y luego que la
 * cuenta tenga al menos uno de los roles indicados. Pieza de fundación para el
 * panel admin (rol `admin`) y la consola del productor (rol `productor`).
 */
export function RequireRole({
  roles,
  children,
  title,
  message,
}: {
  roles: Role[];
  children: ReactNode;
  title?: string;
  message?: string;
}) {
  return (
    <RequireAuth>
      <RoleGate roles={roles} title={title} message={message}>
        {children}
      </RoleGate>
    </RequireAuth>
  );
}

function RoleGate({
  roles,
  children,
  title,
  message,
}: {
  roles: Role[];
  children: ReactNode;
  title?: string;
  message?: string;
}) {
  const { account, loading } = useAuth();
  const t = useTranslations();

  // Sin texto "Cargando": el vinilo (overlay inicial / loading.tsx) ya cubre la
  // carga. Un lienzo oscuro mientras resuelve la sesión evita el flash de texto
  // al desvanecerse el loader.
  if (loading) {
    return <div className="bg-ink min-h-dvh" aria-hidden="true" />;
  }

  if (!hasAnyRole(account, roles)) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-narrow text-4xl font-bold uppercase sm:text-5xl">
          {title ?? t("auth.noAccess")}
        </h1>
        <p className="text-silver-300 mt-3 max-w-md">
          {message ?? t("auth.noAccessDesc")}
        </p>
        <Link
          href="/"
          className="border-silver-300/40 text-silver-100 hover:border-silver-100 mt-8 rounded-full border px-8 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
        >
          {t("auth.backHome")}
        </Link>
      </main>
    );
  }

  return <>{children}</>;
}
