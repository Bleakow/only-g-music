import { getTranslations } from "next-intl/server";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { SolicitudDetail } from "@/features/solicitudes/components/SolicitudDetail";
import { PedidoDetail } from "@/features/pedidos/components/PedidoDetail";

export default async function SolicitudDetailPage({
  params,
}: {
  params: Promise<{ locale: string; tipo: string; id: string }>;
}) {
  const { tipo, id } = await params;
  const t = await getTranslations("guards");
  return (
    <RequireAuth
      title={t("requestTitle")}
      message={t("requestMessage")}
    >
      {tipo === "pedido" ? (
        <PedidoDetail id={id} />
      ) : (
        <SolicitudDetail
          tipo={tipo === "reserva" ? "reserva" : "cotizacion"}
          id={id}
        />
      )}
    </RequireAuth>
  );
}
