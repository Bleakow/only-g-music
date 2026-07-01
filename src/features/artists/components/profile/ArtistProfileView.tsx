"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { ArtistProfile } from "@/domain/artist-profile";
import {
  aniosDeTrayectoria,
  photoTransformCss,
  premiumEstado,
  DEFAULT_PLAYER_X,
  DEFAULT_PLAYER_Y,
  DEFAULT_PLAYER_SIZE,
  GALLERY_SPAN_CLASS,
} from "@/domain/artist-profile";
import type { SocialPlatform } from "@/domain/artist";
import { formatLocation } from "@/domain/location";
import { useState } from "react";
import {
  ArrowLeftIcon,
  SettingsIcon,
  VerifiedIcon,
  EditIcon,
} from "@/components/icons";
import { GlassButton } from "@/components/ui/GlassButton";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import { SOCIAL_META } from "../../lib/socials";
import { TrackPlayers } from "./TrackPlayers";
import { InsigniaBadge } from "./InsigniaBadge";
import { LikeButton } from "./LikeButton";
import { ShareProfile } from "./ShareProfile";
import { MembershipPayButton } from "./MembershipPayButton";
import { ProfileAudioPlayer, PLAYER_SIZE_W } from "./ProfileAudioPlayer";
import { PhotoViewer } from "./PhotoViewer";

function Socials({ socials }: { socials: ArtistProfile["socials"] }) {
  const entries = Object.entries(socials).filter(
    ([key, url]) => SOCIAL_META[key as SocialPlatform] && url && url !== "#",
  );
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-4">
      {entries.map(([key, url]) => {
        const { label, Icon } = SOCIAL_META[key as SocialPlatform];
        return (
          <a
            key={key}
            href={url}
            aria-label={label}
            target="_blank"
            rel="noreferrer"
            className={`${glassSurfaceSoft} group flex size-12 items-center justify-center rounded-full text-white/80 transition hover:text-white`}
          >
            <GlassSheen />
            <Icon className="relative size-5" />
          </a>
        );
      })}
    </div>
  );
}

/**
 * CV cinematográfico del artista. Se renderiza dentro del árbol cliente (lo monta
 * `ArtistProfileLoader`), por eso es client component. Consume el modelo
 * `ArtistProfile` (real o mapeado desde semilla) y delega like/compartir/
 * reproductores a sus propios client components.
 */
export function ArtistProfileView({
  profile,
  isOwner = false,
}: {
  profile: ArtistProfile;
  isOwner?: boolean;
}) {
  const t = useTranslations();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const now = Date.now();
  const isPremium = premiumEstado(profile.premium, now) === "activo";
  const anios =
    profile.trajectoryStartYear >= 1950
      ? aniosDeTrayectoria(profile.trajectoryStartYear, now)
      : null;
  const ciudad = formatLocation(profile.location) || profile.city;
  const meta = [profile.genre, ciudad].filter(Boolean).join(" · ");

  return (
    <article className="relative min-h-dvh">
      {/* Pantalla 1: foto + identidad + acciones */}
      <section className="relative h-dvh w-full overflow-hidden bg-neutral-950">
        {profile.photoURL ? (
          <>
            {/* Dirección de arte: en móvil, la foto vertical si existe; en PC, la
                horizontal con su encuadre. El encuadre (transform) solo aplica a la
                de PC — la de móvil ya viene recortada en vertical. */}
            <Image
              src={profile.photoURL}
              alt={t("artistProfile.portraitAlt", {
                name: profile.artisticName,
              })}
              fill
              priority
              sizes="100vw"
              className={`object-cover ${profile.photoURLMobile ? "hidden sm:block" : ""}`}
              style={{
                transform: photoTransformCss(profile.photoTransform),
                transformOrigin: "center",
              }}
            />
            {profile.photoURLMobile && (
              <Image
                src={profile.photoURLMobile}
                alt={t("artistProfile.portraitAlt", {
                  name: profile.artisticName,
                })}
                fill
                priority
                sizes="100vw"
                className="object-cover sm:hidden"
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />

        <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
          {/* Atrás: cristal hecho a mano (Tailwind). */}
          <GlassButton href="/artistas">
            <ArrowLeftIcon className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
            {t("artistProfile.back")}
          </GlassButton>

          {/* Ajustes: mismo cristal nuestro que el de Atrás. */}
          {isOwner && (
            <GlassButton href="/artista/perfil">
              <SettingsIcon className="size-4" />
              {t("artistProfile.settings")}
            </GlassButton>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-12">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <InsigniaBadge puntos={profile.puntos} />
            {isPremium && (
              <span className="border-amethyst-300/50 bg-amethyst-500/15 text-amethyst-200 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-[2px] uppercase">
                <VerifiedIcon className="size-4" />
                {t("artistProfile.verified")}
              </span>
            )}
            {anios !== null && (
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs tracking-[2px] text-white/70 uppercase">
                {t("artistProfile.yearsCareer", { count: anios })}
              </span>
            )}
          </div>

          <p
            className="text-sm font-bold tracking-[4px] uppercase"
            style={{ color: profile.accent }}
          >
            {meta}
          </p>
          <h1 className="font-narrow text-6xl leading-[0.9] font-bold text-white uppercase drop-shadow-[0_2px_12px_#000] sm:text-8xl">
            {profile.artisticName}
          </h1>
          <p className="mt-3 max-w-xl text-lg text-white/80">
            {profile.tagline}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={`/cotizar?colaborador=${profile.slug}`}
              className="from-silver-100 to-amethyst-300 text-ink inline-flex min-h-11 items-center rounded-full bg-gradient-to-r px-7 py-3 text-sm font-semibold tracking-[2px] uppercase transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
            >
              {t("artistProfile.quoteWith", { name: profile.artisticName })}
            </Link>
            <LikeButton slug={profile.slug} />
            <ShareProfile
              slug={profile.slug}
              name={profile.artisticName}
              locked={isOwner && !isPremium}
              payButton={
                isOwner && !isPremium ? (
                  <MembershipPayButton
                    uid={profile.uid}
                    slug={profile.slug}
                    puntos={profile.puntos}
                    label={t("shareProfile.payCta")}
                    className="!text-amethyst-200"
                  />
                ) : undefined
              }
            />
          </div>
        </div>

        {/* Reproductor SOBRE la foto — sin marco, blanco, posición/tamaño libres */}
        {profile.entryTrackUrl && profile.playerOverlay !== false && (
          <div
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 ${PLAYER_SIZE_W[profile.playerSize ?? DEFAULT_PLAYER_SIZE]}`}
            style={{
              left: `${profile.playerX ?? DEFAULT_PLAYER_X}%`,
              top: `${profile.playerY ?? DEFAULT_PLAYER_Y}%`,
            }}
          >
            <ProfileAudioPlayer
              variant="overlay"
              src={profile.entryTrackUrl}
              accent={profile.accent}
              title={profile.artisticName}
              autoPlay
            />
          </div>
        )}
      </section>

      {/* Canción de fondo — variante en tarjeta debajo (si NO va sobre la foto) */}
      {profile.entryTrackUrl && profile.playerOverlay === false && (
        <ProfileAudioPlayer
          src={profile.entryTrackUrl}
          accent={profile.accent}
          autoPlay
        />
      )}

      {/* Pantalla 2: foto + bio + redes */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-end md:gap-16 md:py-28">
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
          {profile.photoURL && (
            <Image
              src={profile.photoURL}
              alt={profile.artisticName}
              fill
              sizes="(max-width: 768px) 100vw, 45vw"
              className="object-cover object-top"
            />
          )}
        </div>

        <div className="md:pb-6">
          <p
            className="font-narrow text-sm font-bold tracking-[4px] uppercase"
            style={{ color: profile.accent }}
          >
            {t("artistProfile.about", { name: profile.artisticName })}
          </p>
          <p className="text-silver-100 [&::first-letter]:font-narrow [&::first-letter]:text-amethyst-300 mt-5 text-xl leading-relaxed sm:text-[1.6rem] sm:leading-[1.6] [&::first-letter]:float-left [&::first-letter]:mr-3 [&::first-letter]:text-7xl [&::first-letter]:leading-[0.7] [&::first-letter]:font-bold">
            {profile.bio}
          </p>
          <div className="mt-10">
            <Socials socials={profile.socials} />
          </div>
        </div>
      </section>

      {/* Galería */}
      {profile.gallery.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="flex items-center gap-3">
            <h2 className="font-narrow text-2xl font-bold tracking-wide uppercase">
              {t("artistProfile.gallery")}
            </h2>
            {isOwner && (
              <Link
                href="/artista/perfil"
                aria-label={t("artistProfile.editProfile")}
                className="hover:border-amethyst-300/70 inline-flex size-9 items-center justify-center rounded-full border border-white/20 text-white/70 transition hover:text-white"
              >
                <EditIcon className="size-4" />
              </Link>
            )}
          </div>
          <div className="mt-6 grid auto-rows-[120px] grid-cols-2 gap-3 sm:auto-rows-[160px] sm:grid-cols-4">
            {profile.gallery.map((item, i) => (
              <button
                type="button"
                key={item.url}
                onClick={() => setViewerIndex(i)}
                aria-label={t("artistProfile.viewPhoto", { n: i + 1 })}
                className={`group relative overflow-hidden rounded-xl border border-white/10 bg-neutral-950 ${GALLERY_SPAN_CLASS[item.span]}`}
              >
                <Image
                  src={item.url}
                  alt={t("artistProfile.galleryPhotoAlt", {
                    name: profile.artisticName,
                    n: i + 1,
                  })}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        </section>
      )}

      {viewerIndex !== null && (
        <PhotoViewer
          images={profile.gallery.map((g) => g.url)}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
        />
      )}

      {/* Más sonadas */}
      {profile.tracks.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 pb-24">
          <h2 className="font-narrow text-2xl font-bold tracking-wide uppercase">
            {t("artistProfile.topTracks")}
          </h2>
          <TrackPlayers tracks={profile.tracks} />
        </section>
      )}

    </article>
  );
}
