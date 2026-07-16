"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { Artist } from "@only-g/shared-types/artist";
import styles from "./ArtistCard.module.css";
import { ArrowLeftIcon } from "@/components/icons";

export function ArtistCard({ artist }: { artist: Artist }) {
  const t = useTranslations();
  const cardRef = useRef<HTMLAnchorElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  // Móvil (sin hover): autoplay tipo "preview" cuando la card está centrada.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    if (!window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.intersectionRatio >= 0.6),
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Reproduce/pausa el vídeo según el estado activo (hover desktop / scroll móvil).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      video.currentTime = 0;
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [active]);

  // Etiqueta meta: el género del cantante o, si no hay (beatmaker puro, que nace
  // sin género), su disciplina — para no pintar un span de acento vacío.
  const disc = artist.disciplines ?? [];
  const metaLabel =
    artist.genre ||
    (disc.includes("beatmaker") && !disc.includes("artista")
      ? t("roles.beatmaker")
      : "");

  return (
    <Link
      ref={cardRef}
      href={`/artistas/${artist.slug}`}
      data-active={active}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={`${styles.card} group relative block aspect-[4/5] overflow-hidden rounded-xl bg-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
    >
      {artist.video ? (
        <video
          ref={videoRef}
          src={artist.video}
          poster={artist.image}
          muted
          loop
          playsInline
          preload="metadata"
          className={`${styles.media} ${styles.video} h-full w-full object-cover`}
        />
      ) : (
        <Image
          src={artist.image}
          alt={t("artistProfile.portraitAlt", { name: artist.name })}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className={`${styles.media} ${styles.pan} object-cover`}
        />
      )}

      {/* Degradado para legibilidad del texto (más denso abajo). */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

      {/* Punto de acento del artista. */}
      <span
        className="absolute top-3 right-3 size-2 rounded-full ring-2 ring-black/25"
        style={{ backgroundColor: artist.accent }}
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
        {/* Meta: género (teñido con su acento) · ciudad. */}
        <p className="flex items-center gap-1.5 text-[0.62rem] font-medium tracking-[2.5px] uppercase">
          <span style={{ color: artist.accent }}>{metaLabel}</span>
          {artist.city && (
            <>
              <span className="text-white/30">·</span>
              <span className="text-white/70">{artist.city}</span>
            </>
          )}
        </p>

        <h3 className="font-narrow mt-0.5 text-2xl leading-none font-bold text-white uppercase drop-shadow-[0_2px_8px_#000]">
          {artist.name}
        </h3>

        {/* Reveal al enfocar (hover en desktop / centrado en móvil): tagline +
            botón "Ver perfil". El grid 0fr→1fr anima la altura con suavidad. */}
        <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-300 group-data-[active=true]:grid-rows-[1fr] group-data-[active=true]:opacity-100">
          <div className="overflow-hidden">
            {artist.tagline && (
              <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-white/65">
                {artist.tagline}
              </p>
            )}
            <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[0.65rem] font-medium tracking-[1.5px] text-white uppercase backdrop-blur-sm">
              {t("artistsPage.viewProfile")}
              <ArrowLeftIcon className="size-3 rotate-180" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
