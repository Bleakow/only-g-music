import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminSolicitudDetail } from "@/features/admin/components/AdminSolicitudDetail";

export default async function AdminDetailPage({
  params,
}: {
  params: Promise<{ tipo: string; id: string }>;
}) {
  const { tipo, id } = await params;
  const t = tipo === "reserva" ? "reserva" : "cotizacion";
  return (
    <RequireRole roles={["admin"]} title="Panel de administración">
      <AdminSolicitudDetail tipo={t} id={id} />
    </RequireRole>
  );
}
