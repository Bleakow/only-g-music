import type { Metadata } from "next";
import Link from "next/link";
import { services } from "@/features/services/data/services";
import { isQuoteOnly, priceLabel, hasVariants } from "@/domain/service";

export const metadata: Metadata = {
  title: "Servicios — Only G Music",
  description:
    "Grabación, mezcla, masterización, producción y renta de estudio en Barranquilla y Bogotá.",
};

export default function ServiciosPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 pb-24 pt-28 sm:px-12">
      <header className="mb-12">
        <p className="text-sm uppercase tracking-[4px] text-amethyst-300">
          Contratación
        </p>
        <h1 className="mt-3 font-narrow text-5xl font-bold uppercase sm:text-7xl">
          Servicios
        </h1>
        <p className="mt-3 max-w-xl text-silver-300">
          Tarifas para Barranquilla (Atlántico) y Bogotá. Los servicios con
          precio fijo se agendan directo; los proyectos a medida se cotizan.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {services.map((s) => {
          const variants = hasVariants(s);
          const quote = variants || isQuoteOnly(s);
          return (
            <div
              key={s.slug}
              className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-white/20"
            >
              {s.image && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={s.image}
                  alt=""
                  className="h-52 w-full object-cover sm:h-60"
                />
              )}
              <div className="flex flex-1 flex-col p-6">
                <h2 className="font-narrow text-2xl font-bold uppercase text-white">
                  {s.name}
                </h2>
                <p className="mt-2 flex-1 text-silver-300">{s.description}</p>
                <p className="mt-4 text-lg font-semibold text-amethyst-200">
                  {variants ? "Varias opciones" : priceLabel(s)}
                </p>

                {quote ? (
                  <Link
                    href={`/cotizar?servicio=${s.slug}`}
                    className="mt-5 inline-flex justify-center rounded-full border border-amethyst-400/60 px-6 py-2.5 text-sm font-semibold uppercase tracking-[2px] text-amethyst-200 transition hover:border-amethyst-300 hover:bg-amethyst-500/10 hover:text-white"
                  >
                    {variants ? "Elegir opciones" : "Solicitar cotización"}
                  </Link>
                ) : (
                  <Link
                    href={`/agenda?servicio=${s.slug}`}
                    className="mt-5 inline-flex justify-center rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-6 py-2.5 text-sm font-semibold uppercase tracking-[2px] text-ink transition hover:shadow-[0_0_18px_rgba(139,92,246,0.5)]"
                  >
                    Agendar
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-xs text-silver-500">
        * Tarifas de referencia (placeholder). Se ajustarán con los precios
        reales de Only G.
      </p>
    </main>
  );
}
