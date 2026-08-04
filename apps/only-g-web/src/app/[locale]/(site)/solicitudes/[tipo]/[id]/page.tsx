import { getTranslations } from "next-intl/server";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { SolicitudDetail } from "@/features/solicitudes/components/SolicitudDetail";
import { PedidoDetail } from "@/features/pedidos/components/PedidoDetail";
import { ValeDetail } from "@/features/pases/components/ValeDetail";
import { esValeId } from "@only-g/shared-types/pase";

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
      ) : tipo === "vale" && esValeId(id) ? (
        // El id del vale es su tipo ("produccion" | "video"): hay uno por
        // usuario, no una colección — `esValeId` filtra cualquier otra cosa.
        <ValeDetail vale={id} />
      ) : (
        <SolicitudDetail
          tipo={tipo === "reserva" ? "reserva" : "cotizacion"}
          id={id}
        />
      )}
    </RequireAuth>
  );
}
