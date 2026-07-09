import { ProducerProfile } from "@/features/producers/components/ProducerProfile";

/**
 * Página dedicada de un productor. Los datos (Firestore) se cargan en cliente
 * dentro de ProducerProfile, igual que la vitrina del home. La ruta aporta URL
 * propia, navegación atrás y carga perezosa (solo este productor).
 */
export default async function ProducerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProducerProfile id={id} />;
}
