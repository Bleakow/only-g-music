"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Artist } from "@/domain/artist";
import styles from "./ArtistCard.module.css";

export function ArtistCard({ artist }: { artist: Artist }) {
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

  return (
    <Link
      ref={cardRef}
      href={`/artistas/${artist.slug}`}
      data-active={active}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={`${styles.card} relative block aspect-[3/4] overflow-hidden rounded-lg bg-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
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
          alt={`Retrato de ${artist.name}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`${styles.media} ${styles.pan} object-cover`}
        />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

      <span
        className="absolute right-4 top-4 size-2 rounded-full"
        style={{ backgroundColor: artist.accent }}
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
        <p className="text-xs uppercase tracking-[3px] text-white/70">
          {artist.genre}
        </p>
        <h3 className="font-narrow text-3xl font-bold uppercase leading-none text-white drop-shadow-[0_2px_8px_#000]">
          {artist.name}
        </h3>
      </div>
    </Link>
  );
}
