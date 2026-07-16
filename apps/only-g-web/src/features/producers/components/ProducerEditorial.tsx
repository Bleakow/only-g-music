"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Producer } from "@only-g/shared-types/producer";
import { FacebookIcon, InstagramIcon, ExpandIcon } from "@/components/icons";

// Spans para la galería asimétrica (estilo editorial).
const GALLERY_LAYOUT = [
  "sm:col-span-7",
  "sm:col-span-5 sm:mt-24",
  "sm:col-span-6 sm:col-start-4",
];

function PhotoButton({
  src,
  alt,
  onOpen,
  className = "",
  iconSize = "size-4",
  ariaLabel,
}: {
  src: string;
  alt: string;
  onOpen: (src: string) => void;
  className?: string;
  iconSize?: string;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(src)}
      aria-label={ariaLabel}
      className={`reveal group relative block overflow-hidden rounded-xl ring-1 ring-white/10 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 transition-colors duration-300 group-hover:bg-black/20" />
      <span className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
        <ExpandIcon className={iconSize} />
      </span>
    </button>
  );
}

/**
 * Editorial de un productor (bio + redes + galería) con su propio lightbox.
 * COMPARTIDO entre la vitrina del home (ProducersShowcase, tras el stage fijo) y
 * la página dedicada (ProducerProfile) — cada contexto lo envuelve con su layout.
 */
export function ProducerEditorial({ producer: p }: { producer: Producer }) {
  const t = useTranslations();
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Lightbox: Escape cierra + bloquea scroll de fondo.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  return (
    <>
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 sm:grid-cols-2 sm:items-end sm:gap-12">
          {p.photos[0] && (
            <PhotoButton
              src={p.photos[0]}
              alt={p.name}
              onOpen={setLightbox}
              className="aspect-[3/4]"
              ariaLabel={t("producers.expandPhoto", { name: p.name })}
            />
          )}

          <div className="reveal sm:pb-8">
            <p className="text-silver-100 [&::first-letter]:font-narrow [&::first-letter]:text-amethyst-300 text-xl leading-relaxed sm:text-[1.6rem] sm:leading-[1.6] [&::first-letter]:float-left [&::first-letter]:mr-3 [&::first-letter]:text-7xl [&::first-letter]:leading-[0.7] [&::first-letter]:font-bold">
              {p.bio}
            </p>

            <div className="mt-8 flex gap-3">
              {p.socials.facebook && (
                <a
                  href={p.socials.facebook}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("producers.facebookOf", { name: p.name })}
                  className="text-silver-100 flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/30 backdrop-blur-sm transition hover:border-white hover:text-white"
                >
                  <FacebookIcon className="size-5" />
                </a>
              )}
              {p.socials.instagram && (
                <a
                  href={p.socials.instagram}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t("producers.instagramOf", { name: p.name })}
                  className="text-silver-100 flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/30 backdrop-blur-sm transition hover:border-white hover:text-white"
                >
                  <InstagramIcon className="size-5" />
                </a>
              )}
            </div>
          </div>
        </div>

        {p.photos.length > 1 && (
          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-12">
            {p.photos.slice(1).map((photo, i) => (
              <PhotoButton
                key={photo}
                src={photo}
                alt={p.name}
                onOpen={setLightbox}
                iconSize="size-3.5"
                className={`aspect-[3/4] ${GALLERY_LAYOUT[i] ?? "sm:col-span-4"}`}
                ariaLabel={t("producers.expandPhoto", { name: p.name })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/92 p-4 sm:p-10"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label={t("producers.close")}
            className="absolute top-5 right-5 flex size-11 items-center justify-center rounded-full border border-white/25 text-white transition hover:border-white hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
