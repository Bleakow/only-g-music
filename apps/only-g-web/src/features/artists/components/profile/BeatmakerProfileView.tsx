"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import { GlassButton } from "@/components/ui/GlassButton";
import { ArrowLeftIcon } from "@/components/icons";
import { ContactBeatmakerButton } from "@/features/beats/components/ContactBeatmakerButton";

/**
 * Vista pública MINIMAL del beatmaker (perfil "beatmaker puro"). A propósito NO
 * reutiliza `ArtistProfileView`: el beatmaker no tiene tracks/géneros/reproductor
 * ni "Cotizar" — su llamada a la acción es abrir chat directo (sin beat concreto)
 * para hablar de un encargo. Cinematográfica pero austera: foto grande, nombre,
 * ciudad y, si la hay, una bio breve.
 *
 * Igual que `ArtistProfileView`, renderiza el perfil tal cual llega del loader:
 * la lectura pública está permitida (QR/compartir/SEO) y la visibilidad
 * (`perfilVisible`) solo filtra la VITRINA, no el acceso por URL directa.
 */
export function BeatmakerProfileView({ profile }: { profile: ArtistProfile }) {
  const t = useTranslations();

  return (
    <article className="relative min-h-dvh">
      <section className="relative h-dvh w-full overflow-hidden bg-neutral-950">
        {profile.photoURL ? (
          <Image
            src={profile.photoURL}
            alt={t("artistProfile.portraitAlt", { name: profile.artisticName })}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />

        <div className="absolute top-4 left-4 z-20">
          <GlassButton href="/artistas">
            <ArrowLeftIcon className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
            {t("artistProfile.back")}
          </GlassButton>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-12">
          <p
            className="text-sm font-bold tracking-[4px] uppercase"
            style={{ color: profile.accent }}
          >
            {[t("roles.beatmaker"), profile.city].filter(Boolean).join(" · ")}
          </p>
          <h1 className="font-narrow text-6xl leading-[0.9] font-bold text-white uppercase drop-shadow-[0_2px_12px_#000] sm:text-8xl">
            {profile.artisticName}
          </h1>

          <div className="mt-6 max-w-xs">
            <ContactBeatmakerButton
              beatmakerUid={profile.uid}
              beatmakerNombre={profile.artisticName}
              className="!py-3 !text-sm"
            />
          </div>
        </div>
      </section>

      {/* Bio (opcional): solo si el beatmaker escribió una. */}
      {profile.bio && (
        <section className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
          <p
            className="font-narrow text-sm font-bold tracking-[4px] uppercase"
            style={{ color: profile.accent }}
          >
            {t("artistProfile.about", { name: profile.artisticName })}
          </p>
          <p className="text-silver-100 mt-5 text-xl leading-relaxed sm:text-[1.6rem] sm:leading-[1.6]">
            {profile.bio}
          </p>
        </section>
      )}
    </article>
  );
}
