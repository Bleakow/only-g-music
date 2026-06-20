import Link from "next/link";
import type { Artist } from "@/domain/artist";
import { ArtistCard } from "@/features/artists/components/ArtistCard";

const SERVICES = [
  {
    title: "Producción musical",
    desc: "Del demo al máster. Estudio, mezcla y un sonido con sello propio.",
  },
  {
    title: "Vídeos musicales",
    desc: "Dirección, rodaje y postproducción con mirada cinematográfica.",
  },
  {
    title: "Eventos en vivo",
    desc: "Giras, shows y experiencias que conectan con la gente.",
  },
];

export function HomeSections({ featured }: { featured: Artist[] }) {
  return (
    <main>
      {/* Artistas destacados */}
      <section className="px-6 py-24 sm:px-12">
        <div className="mb-10 flex items-end justify-between gap-4">
          <h2 className="font-narrow text-4xl font-bold uppercase sm:text-6xl">
            Nuestros artistas
          </h2>
          <Link
            href="/artistas"
            className="shrink-0 text-sm uppercase tracking-[2px] text-white/60 transition-colors hover:text-white"
          >
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((artist) => (
            <ArtistCard key={artist.slug} artist={artist} />
          ))}
        </div>
      </section>

      {/* Servicios */}
      <section className="px-6 py-24 sm:px-12">
        <h2 className="font-narrow text-4xl font-bold uppercase sm:text-6xl">
          Lo que hacemos
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {SERVICES.map((service) => (
            <div
              key={service.title}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-8"
            >
              <h3 className="font-narrow text-2xl font-bold uppercase">
                {service.title}
              </h3>
              <p className="mt-3 text-white/60">{service.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
