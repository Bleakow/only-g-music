import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { SolicitudDetail } from "@/features/solicitudes/components/SolicitudDetail";

export default async function SolicitudDetailPage({
  params,
}: {
  params: Promise<{ tipo: string; id: string }>;
}) {
  const { tipo, id } = await params;
  const t = tipo === "reserva" ? "reserva" : "cotizacion";
  return (
    <RequireAuth
      title="Tu solicitud"
      message="Inicia sesión para ver esta solicitud."
    >
      <SolicitudDetail tipo={t} id={id} />
    </RequireAuth>
  );
}
