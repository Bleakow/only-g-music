"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ArtistProfile } from "@/domain/artist-profile";
import { getProfileBySlug } from "../../lib/artist-profile-repo";
import type { ProfileSource } from "../../lib/profile-display";
import { ArtistProfileView } from "./ArtistProfileView";

/**
 * Carga el perfil real desde Firestore con fallback al artista semilla (que el
 * servidor pasa para SEO/SSR). Patrón del proyecto: la data dinámica de
 * Firestore se lee en cliente. Si no hay perfil real ni semilla → no encontrado.
 */
export function ArtistProfileLoader({
  slug,
  fallback,
}: {
  slug: string;
  fallback: ArtistProfile | null;
}) {
  const [profile, setProfile] = useState<ArtistProfile | null>(fallback);
  const [source, setSource] = useState<ProfileSource>("seed");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getProfileBySlug(slug)
      .then((p) => {
        if (!active) return;
        if (p) {
          setProfile(p);
          setSource("firestore");
        }
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  if (profile) return <ArtistProfileView profile={profile} source={source} />;
  if (loading)
    return (
      <main className="grid min-h-dvh place-items-center text-silver-300">
        Cargando…
      </main>
    );
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="font-narrow text-4xl font-bold uppercase sm:text-5xl">
        Artista no encontrado
      </h1>
      <Link
        href="/artistas"
        className="mt-8 rounded-full border border-silver-300/40 px-8 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
      >
        Ver artistas
      </Link>
    </main>
  );
}
