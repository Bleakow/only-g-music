"use client";

import { useEffect, useState } from "react";
import type { Artist } from "@/domain/artist";
import { getVisibleProfiles } from "../lib/artist-profile-repo";
import { profileToArtist } from "../lib/profile-display";
import { ArtistGrid } from "./ArtistGrid";

/**
 * Vitrina de artistas. El servidor pasa los artistas semilla (`fallback`) para
 * SSR/SEO; en cliente cargamos los perfiles REALES con premium vigente desde
 * Firestore y, si hay alguno, reemplazan a la semilla. Patrón del proyecto: la
 * data dinámica se lee en cliente.
 */
export function ArtistsShowcase({ fallback }: { fallback: Artist[] }) {
  const [artists, setArtists] = useState<Artist[]>(fallback);

  useEffect(() => {
    let active = true;
    getVisibleProfiles()
      .then((profiles) => {
        if (!active || profiles.length === 0) return;
        setArtists(profiles.map(profileToArtist));
      })
      .catch(() => {
        /* sin perfiles reales o sin red: nos quedamos con la semilla */
      });
    return () => {
      active = false;
    };
  }, []);

  return <ArtistGrid artists={artists} />;
}
