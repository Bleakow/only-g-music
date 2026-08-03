"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Artist } from "@only-g/shared-types/artist";
import { getVisibleProfiles } from "@/features/artists/lib/artist-profile-repo";
import { profileToArtist } from "@/features/artists/lib/profile-display";
import { ArtistCard } from "@/features/artists/components/ArtistCard";

/**
 * Sección pública "Artistas relacionados": los colaboradores que el artista
 * eligió a mano (slugs), resueltos al render desde los perfiles VISIBLES —así un
 * colaborador con membresía vencida sale del listado— preservando el orden
 * elegido, y pintados con el ArtistGrid existente (ya enlaza a cada perfil).
 */
export function RelatedArtists({
  slugs,
  currentSlug,
}: {
  slugs: string[];
  currentSlug: string;
}) {
  const t = useTranslations("artistProfile");
  const [artists, setArtists] = useState<Artist[]>([]);

  useEffect(() => {
    const wanted = slugs.filter((s) => s && s !== currentSlug);
    if (wanted.length === 0) {
      setArtists([]);
      return;
    }
    let active = true;
    getVisibleProfiles()
      .then((profiles) => {
        if (!active) return;
        const bySlug = new Map(profiles.map((p) => [p.slug, p]));
        const ordered = wanted
          .map((s) => bySlug.get(s))
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map(profileToArtist);
        setArtists(ordered);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slugs, currentSlug]);

  if (artists.length === 0) return null;

  return (
    <section className="mx-auto max-w-400 px-6 pt-4 pb-24">
      <div className="mb-6 flex items-center gap-3">
        <span className="from-amethyst-400 to-amethyst-600 h-8 w-1.5 rounded-full bg-linear-to-b" />
        <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
          {t("relatedArtists")}
        </h2>
      </div>
      {/* Fila horizontal desplazable de cards grandes — más llamativa que el grid. */}
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {artists.map((a) => (
          <div key={a.slug} className="w-56 shrink-0 sm:w-64">
            <ArtistCard artist={a} />
          </div>
        ))}
      </div>
    </section>
  );
}
