import type { Metadata } from "next";
import { BookingCalendar } from "@/features/booking/components/BookingCalendar";
import { RequireAuth } from "@/features/auth/components/RequireAuth";

export const metadata: Metadata = {
  title: "Agenda — Only G Music",
  description:
    "Reserva tu sesión en nuestras sedes de Barranquilla (Atlántico) y Bogotá.",
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string }>;
}) {
  const { servicio } = await searchParams;
  return (
    <RequireAuth
      title="Inicia sesión para agendar"
      message="Necesitas una cuenta para reservar tu sesión en el estudio."
    >
      <main className="min-h-dvh px-6 pb-24 pt-28 sm:px-12">
        <header className="mb-10 text-center">
          <p className="text-sm uppercase tracking-[4px] text-amethyst-300">
            Reserva
          </p>
          <h1 className="mt-3 font-narrow text-5xl font-bold uppercase sm:text-7xl">
            Agenda tu cita
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-silver-300">
            Elige servicio, sede, fecha y hora. Sesiones en Barranquilla
            (Atlántico) y Bogotá.
          </p>
        </header>

        <BookingCalendar servicioSlug={servicio} />
      </main>
    </RequireAuth>
  );
}
