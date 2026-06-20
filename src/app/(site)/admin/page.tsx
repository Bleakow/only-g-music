"use client";

import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminDashboard } from "@/features/admin/components/AdminDashboard";

export default function AdminPage() {
  return (
    <RequireRole
      roles={["admin"]}
      title="Panel de administración"
      message="Esta sección es solo para administradores."
    >
      <AdminDashboard />
    </RequireRole>
  );
}
