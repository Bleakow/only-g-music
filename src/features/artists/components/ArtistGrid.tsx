"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Artist } from "@/domain/artist";
import { ArtistCard } from "./ArtistCard";

gsap.registerPlugin(ScrollTrigger);

export function ArtistGrid({ artists }: { artists: Artist[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Respeta prefers-reduced-motion: si está activo, no animamos.
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) return;

      gsap.from(".artist-card", {
        opacity: 0,
        y: 24,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.05,
        scrollTrigger: { trigger: ref.current, start: "top 95%" },
      });
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {artists.map((artist) => (
        <div key={artist.slug} className="artist-card">
          <ArtistCard artist={artist} />
        </div>
      ))}
    </div>
  );
}
