"use client";

import { useEffect, useState } from "react";
import type { Artist } from "@only-g/shared-types/artist";
import { getVisibleProfiles } from "../lib/artist-profile-repo";
import { profileToArtist } from "../lib/profile-display";
import { ArtistCard } from "./ArtistCard";

/**
 * Grilla de artistas destacados del home. Carga los perfiles REALES visibles de
 * Firestore en cliente (patrón del proyecto: la data dinámica se lee en cliente)
 * y muestra los primeros 3. Sin perfiles reales aún → no renderiza nada (en vez
 * de placeholders).
 */
export function HomeFeaturedArtists() {
  const [artists, setArtists] = useState<Artist[]>([]);

  useEffect(() => {
    let active = true;
    getVisibleProfiles()
      .then((profiles) => {
        if (active) setArtists(profiles.slice(0, 3).map(profileToArtist));
      })
      .catch(() => {
        /* sin perfiles reales o sin red: la grilla queda vacía */
      });
    return () => {
      active = false;
    };
  }, []);

  if (artists.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {artists.map((artist) => (
        <ArtistCard key={artist.slug} artist={artist} />
      ))}
    </div>
  );
}
