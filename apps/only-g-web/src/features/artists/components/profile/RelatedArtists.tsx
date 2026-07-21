"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Artist } from "@only-g/shared-types/artist";
import { getVisibleProfiles } from "@/features/artists/lib/artist-profile-repo";
import { profileToArtist } from "@/features/artists/lib/profile-display";
import { ArtistGrid } from "@/features/artists/components/ArtistGrid";

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
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <h2 className="font-narrow text-2xl font-bold tracking-wide uppercase">
        {t("relatedArtists")}
      </h2>
      <div className="mt-6">
        <ArtistGrid artists={artists} />
      </div>
    </section>
  );
}
