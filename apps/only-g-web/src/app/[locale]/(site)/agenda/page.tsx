import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

/**
 * `/agenda` quedó CONSOLIDADA en `/comprar` (compra directa con carrito, que ya
 * incluye la elección de fecha/horas cuando el pedido lleva una sesión). Esta
 * ruta solo redirige — preserva `?servicio` para el preseleccionado.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string }>;
}) {
  const { servicio } = await searchParams;
  const locale = await getLocale();
  redirect({
    href: servicio ? `/comprar?servicio=${servicio}` : "/comprar",
    locale,
  });
}
