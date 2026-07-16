"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Producer } from "@only-g/shared-types/producer";
import { formatLocation } from "@only-g/shared-types/location";
import { FacebookIcon, InstagramIcon, ArrowLeftIcon } from "@/components/icons";

/**
 * Card horizontal de un productor (foto retrato a la izquierda, datos a la
 * derecha). TODA la card enlaza a su página dedicada (link estirado inset-0);
 * los iconos de redes van POR ENCIMA (z-20 + stopPropagation) para abrir su red
 * sin disparar el enlace de la card. Sin anchors anidados → HTML válido.
 */
export function ProducerCard({ producer: p }: { producer: Producer }) {
  const t = useTranslations();
  const location = formatLocation(p.location) || p.origin;

  return (
    <article className="group hover:border-amethyst-400/40 relative flex h-44 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-colors hover:bg-white/[0.05] sm:h-48">
      {/* Link estirado: clic en cualquier parte de la card → página del productor. */}
      <Link
        href={`/productores/${p.id}`}
        aria-label={t("producers.viewProfile", { name: p.name })}
        className="absolute inset-0 z-10"
      />

      {/* Foto (retrato) a la izquierda. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={p.mainPhotoMobile || p.mainPhoto}
        alt=""
        className="h-full w-2/5 shrink-0 object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Datos + acciones. */}
      <div className="flex min-w-0 flex-1 flex-col justify-between p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="font-narrow truncate text-2xl font-bold text-white uppercase sm:text-3xl">
            {p.name}
          </h3>
          <p className="text-silver-300 mt-0.5 truncate text-sm">{p.role}</p>
          {location && (
            <p className="text-silver-400 truncate text-xs">{location}</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-silver-300 flex items-center gap-3">
            {p.socials.instagram && (
              <a
                href={p.socials.instagram}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={t("producers.instagramOf", { name: p.name })}
                className="relative z-20 transition hover:text-white"
              >
                <InstagramIcon className="size-5" />
              </a>
            )}
            {p.socials.facebook && (
              <a
                href={p.socials.facebook}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                aria-label={t("producers.facebookOf", { name: p.name })}
                className="relative z-20 transition hover:text-white"
              >
                <FacebookIcon className="size-5" />
              </a>
            )}
          </div>

          {/* Flecha: solo afordancia; el clic lo captura el link estirado. */}
          <span className="border-amethyst-400/60 text-amethyst-300 group-hover:bg-amethyst-500/20 flex size-9 shrink-0 items-center justify-center rounded-full border transition">
            <ArrowLeftIcon className="size-4 rotate-180" />
          </span>
        </div>
      </div>
    </article>
  );
}
