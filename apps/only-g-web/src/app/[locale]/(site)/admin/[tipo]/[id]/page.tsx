import { getTranslations } from "next-intl/server";
import { RequireRole } from "@/features/auth/components/RequireRole";
import { AdminSolicitudDetail } from "@/features/admin/components/AdminSolicitudDetail";

export default async function AdminDetailPage({
  params,
}: {
  params: Promise<{ locale: string; tipo: string; id: string }>;
}) {
  const { tipo, id } = await params;
  const tipoNorm = tipo === "reserva" ? "reserva" : "cotizacion";
  const t = await getTranslations("guards");
  return (
    <RequireRole roles={["admin"]} title={t("adminTitle")}>
      <AdminSolicitudDetail tipo={tipoNorm} id={id} />
    </RequireRole>
  );
}
