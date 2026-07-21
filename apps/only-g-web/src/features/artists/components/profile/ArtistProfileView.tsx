"use client";

import Image from "next/image";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import {
  aniosDeTrayectoria,
  photoTransformCss,
  premiumEstado,
  DEFAULT_PLAYER_X,
  DEFAULT_PLAYER_Y,
  DEFAULT_PLAYER_SIZE,
  GALLERY_SPAN_CLASS,
} from "@only-g/shared-types/artist-profile";
import type { SocialPlatform } from "@only-g/shared-types/artist";
import { formatLocation } from "@only-g/shared-types/location";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, VerifiedIcon, EditIcon } from "@/components/icons";
import { GlassButton } from "@/components/ui/GlassButton";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import { SOCIAL_META } from "../../lib/socials";
import { TrackPlayers } from "./TrackPlayers";
import { LikeButton } from "./LikeButton";
import { ShareProfile } from "./ShareProfile";
import { MembershipPayButton } from "./MembershipPayButton";
import { ProfileAudioPlayer, PLAYER_SIZE_W } from "./ProfileAudioPlayer";
import { PhotoViewer } from "./PhotoViewer";
import { RelatedArtists } from "./RelatedArtists";

/** Media destacada de la pantalla 2: clip en bucle mudo o foto. Si el video no
 *  carga (p.ej. un webm en un Safari antiguo), cae a la foto para no dejar hueco. */
function FeaturedVisual({
  media,
  photoURL,
  name,
}: {
  media: ArtistProfile["featuredMedia"];
  photoURL: string;
  name: string;
}) {
  const [failed, setFailed] = useState(false);
  if (media && media.type === "video" && !failed) {
    return (
      <video
        src={media.url}
        autoPlay
        loop
        muted
        playsInline
        aria-label={name}
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    );
  }
  const src = media && media.type === "image" ? media.url : photoURL;
  if (!src) return null;
  return (
    <Image
      src={src}
      alt={name}
      fill
      sizes="(max-width: 768px) 100vw, 45vw"
      className={
        media?.type === "image"
          ? "object-cover object-center"
          : "object-cover object-top"
      }
    />
  );
}

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
  const router = useRouter();
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // "Atrás" contextual: vuelve a DONDE se venía (la lista, o el editor/panel admin
  // si el admin llegó por "Ver perfil"), no siempre a la lista. Fallback: /artistas.
  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/artistas");
  }

  // Clamp de colisión del reproductor overlay: su posición se guarda como % global
  // (normalmente calibrada en escritorio). En móvil el bloque de identidad (nombre/
  // tagline/CTAs, de alto POR CONTENIDO) ocupa más y el player podía caer encima.
  // Medimos dónde empieza la identidad y limitamos el `top%` para que nunca la pise,
  // en cualquier resolución. Solo BAJA el valor; si la medición falla, usa el crudo.
  const heroRef = useRef<HTMLElement>(null);
  const identityRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [playerTop, setPlayerTop] = useState<number | null>(null);

  useEffect(() => {
    const hero = heroRef.current;
    const identity = identityRef.current;
    if (!hero || !identity) return;
    const rawY = profile.playerY ?? DEFAULT_PLAYER_Y;
    const recompute = () => {
      const heroH = hero.getBoundingClientRect().height;
      if (heroH === 0) return;
      const idTop =
        identity.getBoundingClientRect().top - hero.getBoundingClientRect().top;
      const identityTopPct = (idTop / heroH) * 100;
      const halfPlayerPct = playerRef.current
        ? (playerRef.current.getBoundingClientRect().height / 2 / heroH) * 100
        : 0;
      const maxY = identityTopPct - halfPlayerPct - 2; // 2% de respiro
      setPlayerTop(Math.max(4, Math.min(rawY, maxY)));
    };
    recompute();
    // ResizeObserver capta el cambio de alto del hero (barra de URL de iOS que
    // aparece/oculta) y el reflujo del texto de identidad (rotación/nombre largo).
    const ro = new ResizeObserver(recompute);
    ro.observe(hero);
    ro.observe(identity);
    if (playerRef.current) ro.observe(playerRef.current);
    return () => ro.disconnect();
  }, [profile.playerY, profile.playerSize, profile.entryTrackUrl]);

  const now = Date.now();
  const isPremium = premiumEstado(profile.premium, now) === "activo";
  const anios =
    profile.trajectoryStartYear >= 1950
      ? aniosDeTrayectoria(profile.trajectoryStartYear, now)
      : null;
  const generos =
    profile.genres && profile.genres.length > 0
      ? profile.genres
      : profile.genre
        ? [profile.genre]
        : [];
  const ciudad = formatLocation(profile.location) || profile.city;
  // En el hero, hasta 3 géneros; el resto se listan como chips más abajo.
  const meta = [...generos.slice(0, 3), ciudad].filter(Boolean).join(" · ");

  return (
    <article className="relative min-h-dvh">
      {/* Pantalla 1: foto + identidad + acciones */}
      <section
        ref={heroRef}
        className="relative h-dvh w-full overflow-hidden bg-neutral-950"
      >
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
          <GlassButton onClick={goBack}>
            <ArrowLeftIcon className="size-4 transition-transform duration-300 group-hover:-translate-x-1" />
            {t("artistProfile.back")}
          </GlassButton>

          {/* Editar perfil (solo el dueño): entrada directa al editor desde el
              propio perfil, con icono de lápiz para que se lea claro. */}
          {isOwner && (
            <GlassButton href="/artista/perfil">
              <EditIcon className="size-4" />
              {t("artistProfile.editProfile")}
            </GlassButton>
          )}
        </div>

        <div ref={identityRef} className="absolute inset-x-0 bottom-0 p-6 sm:p-12">
          <div className="mb-3 flex flex-wrap items-center gap-2">
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
            ref={playerRef}
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 ${PLAYER_SIZE_W[profile.playerSize ?? DEFAULT_PLAYER_SIZE]}`}
            style={{
              left: `${profile.playerX ?? DEFAULT_PLAYER_X}%`,
              top: `${playerTop ?? profile.playerY ?? DEFAULT_PLAYER_Y}%`,
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
          <FeaturedVisual
            media={profile.featuredMedia}
            photoURL={profile.photoURL}
            name={profile.artisticName}
          />
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
          {generos.length > 3 && (
            <div className="mt-8">
              <p
                className="font-narrow text-sm font-bold tracking-[4px] uppercase"
                style={{ color: profile.accent }}
              >
                {t("artistProfile.genres")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {generos.map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/80"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}
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

      {/* Artistas relacionados / colaboradores (red interna) */}
      {profile.relatedArtists && profile.relatedArtists.length > 0 && (
        <RelatedArtists
          slugs={profile.relatedArtists}
          currentSlug={profile.slug}
        />
      )}
    </article>
  );
}
