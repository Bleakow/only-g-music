import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminPerfiles } from "@/features/admin/components/AdminPerfiles";

export default function AdminPerfilesPage() {
  return (
    <RequireRole
      roles={["admin"]}
      title="Perfiles"
      message="Esta sección es solo para administradores."
    >
      <AdminPerfiles />
    </RequireRole>
  );
}
