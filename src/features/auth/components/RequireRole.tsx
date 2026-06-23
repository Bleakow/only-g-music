"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "./AuthProvider";
import { RequireAuth } from "./RequireAuth";
import { hasAnyRole, type Role } from "@/domain/user";

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

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-silver-300">{t("common.loading")}</p>
      </main>
    );
  }

  if (!hasAnyRole(account, roles)) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-narrow text-4xl font-bold uppercase sm:text-5xl">
          {title ?? t("auth.noAccess")}
        </h1>
        <p className="mt-3 max-w-md text-silver-300">
          {message ?? t("auth.noAccessDesc")}
        </p>
        <Link
          href="/"
          className="mt-8 rounded-full border border-silver-300/40 px-8 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
        >
          {t("auth.backHome")}
        </Link>
      </main>
    );
  }

  return <>{children}</>;
}
