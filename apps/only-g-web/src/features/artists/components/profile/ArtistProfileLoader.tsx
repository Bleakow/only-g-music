"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import { getProfileBySlug } from "../../lib/artist-profile-repo";
import { ArtistProfileView } from "./ArtistProfileView";
import { BeatmakerProfileView } from "./BeatmakerProfileView";

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
  const { user } = useAuth();
  const tArtist = useTranslations("artistProfile");
  const [profile, setProfile] = useState<ArtistProfile | null>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getProfileBySlug(slug)
      .then((p) => {
        if (!active) return;
        if (p) {
          setProfile(p);
        }
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  if (profile) {
    // "Beatmaker puro" → vista minimal dedicada. Un usuario cantante+beatmaker
    // (disciplines incluye 'artista') conserva la vista de cantante completa.
    const disc = profile.disciplines ?? [];
    const esBeatmakerPuro =
      disc.includes("beatmaker") && !disc.includes("artista");
    if (esBeatmakerPuro) return <BeatmakerProfileView profile={profile} />;
    return (
      <ArtistProfileView
        profile={profile}
        isOwner={!!user && !!profile.uid && user.uid === profile.uid}
      />
    );
  }
  // Sin texto "Cargando": el vinilo de la ruta (loading.tsx) ya cubrió la
  // transición y este fetch cliente es rápido; un lienzo oscuro evita el flash de
  // texto entre el loader y el contenido.
  if (loading) return <div className="bg-ink min-h-dvh" />;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="font-narrow text-4xl font-bold uppercase sm:text-5xl">
        {tArtist("notFound")}
      </h1>
      <Link
        href="/artistas"
        className="border-silver-300/40 text-silver-100 hover:border-silver-100 mt-8 rounded-full border px-8 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
      >
        {tArtist("backToArtists")}
      </Link>
    </main>
  );
}
