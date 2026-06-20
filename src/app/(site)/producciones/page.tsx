import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Producciones — Only G Music",
  description: "Producción musical y audiovisual de Only G.",
};

export default function ProduccionesPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm uppercase tracking-[4px] text-white/50">
        Próximamente
      </p>
      <h1 className="mt-4 font-narrow text-5xl font-bold uppercase sm:text-7xl">
        Producciones
      </h1>
      <p className="mt-4 max-w-md text-white/60">
        Producción musical y audiovisual: del estudio a la pantalla.
      </p>
    </main>
  );
}
