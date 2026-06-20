"use client";

import Image from "next/image";
import Link from "next/link";
import type { ArtistProfile } from "@/domain/artist-profile";
import { aniosDeTrayectoria, premiumEstado } from "@/domain/artist-profile";
import type { SocialPlatform } from "@/domain/artist";
import {
  ArrowLeftIcon,
  InstagramIcon,
  SpotifyIcon,
  VerifiedIcon,
  XIcon,
  YouTubeIcon,
} from "@/components/icons";
import type { ProfileSource } from "../../lib/profile-display";
import { InsigniaBadge } from "./InsigniaBadge";
import { TrackPlayers } from "./TrackPlayers";
import { LikeButton } from "./LikeButton";
import { ShareProfile } from "./ShareProfile";

const SOCIALS: Record<
  SocialPlatform,
  { label: string; Icon: typeof SpotifyIcon }
> = {
  spotify: { label: "Spotify", Icon: SpotifyIcon },
  instagram: { label: "Instagram", Icon: InstagramIcon },
  youtube: { label: "YouTube", Icon: YouTubeIcon },
  x: { label: "X", Icon: XIcon },
};

function Socials({ socials }: { socials: ArtistProfile["socials"] }) {
  const entries = Object.entries(socials).filter(
    ([key, url]) => SOCIALS[key as SocialPlatform] && url && url !== "#",
  );
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-4">
      {entries.map(([key, url]) => {
        const { label, Icon } = SOCIALS[key as SocialPlatform];
        return (
          <a
            key={key}
            href={url}
            aria-label={label}
            target="_blank"
            rel="noreferrer"
            className="flex size-12 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-amethyst-300 hover:text-white"
          >
            <Icon className="size-5" />
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
  source,
}: {
  profile: ArtistProfile;
  source: ProfileSource;
}) {
  const now = Date.now();
  const isPremium = premiumEstado(profile.premium, now) === "activo";
  const anios =
    profile.trajectoryStartYear >= 1950
      ? aniosDeTrayectoria(profile.trajectoryStartYear, now)
      : null;
  const meta = [profile.genre, profile.city].filter(Boolean).join(" · ");

  return (
    <article className="relative min-h-dvh">
      {/* Pantalla 1: foto + identidad + acciones */}
      <section className="relative h-dvh w-full overflow-hidden bg-neutral-950">
        {profile.photoURL ? (
          <Image
            src={profile.photoURL}
            alt={`Retrato de ${profile.artisticName}`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20" />

        <Link
          href="/artistas"
          className="group absolute left-6 top-20 z-10 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-sm uppercase tracking-[3px] text-white/80 backdrop-blur-sm transition duration-300 hover:scale-105 hover:border-amethyst-300/70 hover:bg-white/10 hover:text-white hover:shadow-[0_0_18px_rgba(139,92,246,0.4)] active:scale-95"
        >
          <ArrowLeftIcon className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
          Artistas
        </Link>

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-12">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <InsigniaBadge puntos={profile.puntos} />
            {isPremium && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amethyst-300/50 bg-amethyst-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[2px] text-amethyst-200">
                <VerifiedIcon className="size-4" />
                Verificado
              </span>
            )}
            {anios !== null && (
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[2px] text-white/70">
                {anios} {anios === 1 ? "año" : "años"} de trayectoria
              </span>
            )}
          </div>

          <p
            className="text-sm font-bold uppercase tracking-[4px]"
            style={{ color: profile.accent }}
          >
            {meta}
          </p>
          <h1 className="font-narrow text-6xl font-bold uppercase leading-[0.9] text-white drop-shadow-[0_2px_12px_#000] sm:text-8xl">
            {profile.artisticName}
          </h1>
          <p className="mt-3 max-w-xl text-lg text-white/80">
            {profile.tagline}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={`/cotizar?colaborador=${profile.slug}`}
              className="inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-7 py-3 text-sm font-semibold uppercase tracking-[2px] text-ink transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
            >
              Cotizar con {profile.artisticName}
            </Link>
            <LikeButton slug={profile.slug} />
            <ShareProfile slug={profile.slug} name={profile.artisticName} />
          </div>
        </div>
      </section>

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
            className="font-narrow text-sm font-bold uppercase tracking-[4px]"
            style={{ color: profile.accent }}
          >
            Sobre {profile.artisticName}
          </p>
          <p className="mt-5 text-xl leading-relaxed text-silver-100 sm:text-[1.6rem] sm:leading-[1.6] [&::first-letter]:float-left [&::first-letter]:mr-3 [&::first-letter]:font-narrow [&::first-letter]:text-7xl [&::first-letter]:font-bold [&::first-letter]:leading-[0.7] [&::first-letter]:text-amethyst-300">
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
          <h2 className="font-narrow text-2xl font-bold uppercase tracking-wide">
            Galería
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {profile.gallery.map((src, i) => (
              <div
                key={src}
                className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-neutral-950"
              >
                <Image
                  src={src}
                  alt={`${profile.artisticName} — foto ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover transition duration-500 hover:scale-105"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Más sonadas */}
      {profile.tracks.length > 0 && (
        <section className="mx-auto max-w-3xl px-6 pb-24">
          <h2 className="font-narrow text-2xl font-bold uppercase tracking-wide">
            Más sonadas
          </h2>
          <TrackPlayers tracks={profile.tracks} />
        </section>
      )}

      {source === "seed" && (
        <p className="mx-auto max-w-3xl px-6 pb-16 text-center text-xs text-white/30">
          Perfil de muestra. Los perfiles reales de artista (con galería y
          reproductores) llegan con la Fase 15.
        </p>
      )}
    </article>
  );
}
