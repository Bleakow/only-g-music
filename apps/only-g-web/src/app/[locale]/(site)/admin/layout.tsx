"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminShell } from "@/features/admin/components/AdminShell";

/**
 * Layout del panel admin: exige rol `admin` UNA vez (las páginas ya no necesitan
 * su propio guard) y monta el shell (sidebar + topbar) alrededor de cada página.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("guards");
  return (
    <RequireRole
      roles={["admin"]}
      title={t("adminTitle")}
      message={t("adminMessage")}
    >
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  );
}
