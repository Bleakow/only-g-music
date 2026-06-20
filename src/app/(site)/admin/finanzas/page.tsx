"use client";

import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminFinanzas } from "@/features/admin/components/AdminFinanzas";

export default function AdminFinanzasPage() {
  return (
    <RequireRole
      roles={["admin"]}
      title="Finanzas"
      message="Esta sección es solo para administradores."
    >
      <AdminFinanzas />
    </RequireRole>
  );
}
