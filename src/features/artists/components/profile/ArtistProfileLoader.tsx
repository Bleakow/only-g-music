"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import type { ArtistProfile } from "@/domain/artist-profile";
import { getProfileBySlug } from "../../lib/artist-profile-repo";
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
  const { user } = useAuth();
  const tCommon = useTranslations("common");
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

  if (profile)
    return (
      <ArtistProfileView
        profile={profile}
        isOwner={!!user && !!profile.uid && user.uid === profile.uid}
      />
    );
  if (loading)
    return (
      <main className="grid min-h-dvh place-items-center text-silver-300">
        {tCommon("loading")}
      </main>
    );
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="font-narrow text-4xl font-bold uppercase sm:text-5xl">
        {tArtist("notFound")}
      </h1>
      <Link
        href="/artistas"
        className="mt-8 rounded-full border border-silver-300/40 px-8 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
      >
        {tArtist("backToArtists")}
      </Link>
    </main>
  );
}
