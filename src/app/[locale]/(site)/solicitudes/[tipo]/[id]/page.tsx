import { getTranslations } from "next-intl/server";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { SolicitudDetail } from "@/features/solicitudes/components/SolicitudDetail";

export default async function SolicitudDetailPage({
  params,
}: {
  params: Promise<{ locale: string; tipo: string; id: string }>;
}) {
  const { tipo, id } = await params;
  const tipoNorm = tipo === "reserva" ? "reserva" : "cotizacion";
  const t = await getTranslations("guards");
  return (
    <RequireAuth
      title={t("requestTitle")}
      message={t("requestMessage")}
    >
      <SolicitudDetail tipo={tipoNorm} id={id} />
    </RequireAuth>
  );
}
