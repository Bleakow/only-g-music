"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useContextualBack } from "@/lib/use-contextual-back";
import { useTranslations } from "next-intl";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import {
  aniosDeTrayectoria,
  photoTransformCss,
  premiumEstado,
  DEFAULT_PLAYER_X,
  DEFAULT_PLAYER_Y,
  DEFAULT_PLAYER_SIZE,
  formatCompact,
  featuredMediaItems,
  esReel,
  presentacionDestacada,
} from "@only-g/shared-types/artist-profile";
import type { SocialPlatform } from "@only-g/shared-types/artist";
import { formatLocation } from "@only-g/shared-types/location";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  VerifiedIcon,
  EditIcon,
  ChatIcon,
  CalendarIcon,
  ChartBarIcon,
  ClockIcon,
  LockIcon,
} from "@/components/icons";
import {
  isSectionOn,
  type SectionId,
} from "@only-g/shared-types/profile-sections";
import { ProfileChip } from "./ProfileChip";
import { GalleryMosaic } from "./GalleryMosaic";
import { DisciplineTags } from "./DisciplineTags";
import {
  CategoriasSection,
  FichaTecnicaSection,
  GenerosBaileSection,
  MarcasSection,
  ReconocimientosSection,
  TrayectoriaSection,
} from "./RoleSections";
import { ContactBeatmakerButton } from "@/features/beats/components/ContactBeatmakerButton";
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
import { StatsCards } from "./StatsCards";
import { FeaturedMediaPlayer } from "./FeaturedMediaPlayer";
import { ReelsGrid } from "./ReelsGrid";
import { FollowButton } from "./FollowButton";
import { ProfileColectivos } from "./ProfileColectivos";
import { BookEntryCard } from "@/features/book/components/BookEntryCard";
import { trackVisita } from "../../lib/metrics-client";
import {
  ProfileMetricsProvider,
  useTrackSocialClick,
} from "./ProfileMetricsContext";
import { openChat } from "@/features/conversations/lib/open-conversation";

/**
 * Redes sociales (§04): las que tienen nº de seguidores (manual del artista o
 * automático de YouTube/Spotify) van PRIMERO como tarjeta con el conteo; las demás,
 * como icono simple al final.
 */
function Socials({ profile }: { profile: ArtistProfile }) {
  const t = useTranslations("artistProfile");
  const countClick = useTrackSocialClick();
  const entries = Object.entries(profile.socials).filter(
    ([key, url]) => SOCIAL_META[key as SocialPlatform] && url && url !== "#",
  ) as [SocialPlatform, string][];
  if (entries.length === 0) return null;

  // El conteo por red: primero el manual del artista, si no el auto de socialStats.
  const countOf = (k: SocialPlatform): number | null => {
    const manual = profile.manualFollowers?.[k];
    if (typeof manual === "number" && manual > 0) return manual;
    const auto = profile.socialStats?.followers?.[k];
    return typeof auto === "number" && auto > 0 ? auto : null;
  };
  const withCount = entries.filter(([k]) => countOf(k) !== null);
  const plain = entries.filter(([k]) => countOf(k) === null);

  // Todas con el MISMO estilo de tarjeta (cohesión): icono + nombre. Las que tienen
  // conteo añaden la línea de seguidores; las demás muestran solo el nombre (o
  // "Seguir"). Las de conteo van primero.
  return (
    <div className="flex flex-wrap gap-3">
      {[...withCount, ...plain].map(([key, url]) => {
        const { label, Icon } = SOCIAL_META[key];
        const n = countOf(key);
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={() => countClick(key)}
            aria-label={n !== null ? `${label}: ${n}` : label}
            className="bg-ink-panel group flex min-w-[150px] items-center gap-3 rounded-2xl border border-white/10 px-5 py-3.5 text-white/85 transition hover:border-white/25 hover:text-white"
          >
            <Icon className="size-6 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span className="text-xs font-bold tracking-wide uppercase">
                {label}
              </span>
              <span className="text-silver-400 text-[0.7rem]">
                {n !== null
                  ? t("followersCount", { count: formatCompact(n) })
                  : t("visitProfile")}
              </span>
            </span>
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

  // "Atrás" contextual: vuelve a DONDE se venía (la lista, o el editor/panel admin
  // si el admin llegó por "Ver perfil"), no siempre a la lista. Fallback: /artistas.
  const goBack = useContextualBack("/artistas");

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

  // Cuenta UNA visita por pestaña, sin contar al dueño. Va contra la API de
  // métricas (server-side): allí se deduce el país y se agrega por día, y de
  // paso el cliente deja de poder escribir contadores directamente.
  useEffect(() => {
    trackVisita(profile.slug, isOwner);
  }, [profile.slug, isOwner]);

  // §05 — qué secciones se pintan. El artista las enciende y apaga en el gestor
  // del editor; las que su etiqueta no desbloquea no salen aunque estén en `prefs`.
  const on = (id: SectionId) =>
    isSectionOn(id, profile.sectionPrefs, profile.disciplines);

  // Beatmaker que NO canta: su llamada a la acción es otra (ver más abajo).
  const disciplinas = profile.disciplines ?? [];
  const esBeatmakerPuro =
    disciplinas.includes("beatmaker") && !disciplinas.includes("artista");

  // Media destacada: la lista efectiva y cómo toca presentarla (reels vs player).
  const destacados = featuredMediaItems(
    profile.featuredMediaList,
    profile.featuredMedia,
  );
  const destacada = presentacionDestacada(destacados);

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
  // Sobre la foto solo va la ciudad: los géneros tienen su propia sección más
  // abajo y repetirlos aquí solo cargaba la portada.
  const meta = formatLocation(profile.location) || profile.city;

  return (
    // El provider de métricas envuelve SOLO el perfil público: los mismos
    // reproductores dentro del editor no cuentan (allí no hay provider).
    <ProfileMetricsProvider slug={profile.slug} isOwner={isOwner}>
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
              className="hidden object-cover sm:block"
              style={{
                transform: photoTransformCss(profile.photoTransform),
                transformOrigin: "center",
              }}
            />
            {/* Móvil: su propia imagen si la hay, y SIEMPRE su propio encuadre —
                el marco es vertical, así que el encuadre de PC no sirve aquí. */}
            <Image
              src={profile.photoURLMobile || profile.photoURL}
              alt={t("artistProfile.portraitAlt", {
                name: profile.artisticName,
              })}
              fill
              priority
              sizes="100vw"
              className="object-cover sm:hidden"
              style={{
                transform: photoTransformCss(profile.photoTransformMobile),
                transformOrigin: "center",
              }}
            />
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
          {/* Sobre la foto: el sello de verificado, las ARTES que maneja y la
              ciudad. Los géneros y la trayectoria tienen su sitio más abajo. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {isPremium && (
              <ProfileChip
                accent={profile.accent}
                icon={<VerifiedIcon className="size-4" />}
              >
                {t("artistProfile.verified")}
              </ProfileChip>
            )}
            <DisciplineTags
              disciplines={profile.disciplines}
              accent={profile.accent}
            />
          </div>

          {meta && (
            <p
              className="text-sm font-bold tracking-[4px] uppercase"
              style={{ color: profile.accent }}
            >
              {meta}
            </p>
          )}
          <h1 className="font-narrow text-6xl leading-[0.9] font-bold text-white uppercase drop-shadow-[0_2px_12px_#000] sm:text-8xl">
            {profile.artisticName}
          </h1>
          <p className="mt-3 max-w-xl text-lg text-white/80">
            {profile.tagline}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <FollowButton profile={profile} />
            <LikeButton slug={profile.slug} />
            <ShareProfile
              slug={profile.slug}
              name={profile.artisticName}
              photoUrl={profile.photoURL}
              locked={isOwner && !isPremium}
              payButton={
                isOwner && !isPremium ? (
                  <MembershipPayButton
                    uid={profile.uid}
                    slug={profile.slug}
                    label={t("shareProfile.payCta")}
                    className="!text-amethyst-200"
                  />
                ) : undefined
              }
            />
          </div>
        </div>

        {/* Reproductor SOBRE la foto — sin marco, blanco, posición/tamaño libres */}
        {on("reproductor") && profile.entryTrackUrl && profile.playerOverlay !== false && (
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

      {/* ── Contenido: secciones apiladas según el .pen (§04) ──────────── */}
      <div className="bg-ink relative z-10">
        {/* Canción de fondo — variante en tarjeta (si NO va sobre la foto) */}
        {on("reproductor") && profile.entryTrackUrl && profile.playerOverlay === false && (
          <div className="mx-auto max-w-400 px-6 pt-10">
            <ProfileAudioPlayer
              src={profile.entryTrackUrl}
              accent={profile.accent}
              autoPlay
            />
          </div>
        )}

        {/* Barra de acciones: Mensaje · Cotizar (reubicado) · Métricas (próximamente) */}
        <div className="mx-auto max-w-400 px-6 pt-12 sm:pt-16">
          {/* Móvil: Mensaje + Cotizar iguales arriba (grid 2), Métricas full-width
              abajo. Escritorio: los tres en línea. */}
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => openChat()}
              className={`${glassSurfaceSoft} relative flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-bold tracking-[2px] text-white/90 uppercase transition hover:text-white sm:w-auto`}
            >
              <GlassSheen />
              <ChatIcon className="relative size-5" />
              <span className="relative">{t("artistProfile.actionMessage")}</span>
            </button>
            {/* CTA según la etiqueta: al talento EN ESCENA se le cotiza una
                fecha; a un beatmaker se le escribe para encargarle un beat.
                Ofrecerle "Cotizar" una agenda no tenía sentido. */}
            {esBeatmakerPuro ? (
              <ContactBeatmakerButton
                beatmakerUid={profile.uid}
                beatmakerNombre={profile.artisticName}
                className="w-full sm:w-auto"
              />
            ) : (
              <Link
                href={`/cotizar?colaborador=${profile.slug}`}
                className="from-amethyst-400 to-amethyst-600 ring-amethyst-300/40 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-linear-to-b px-8 text-sm font-bold tracking-[2px] text-white uppercase shadow-[0_6px_22px_rgba(124,58,237,0.5)] ring-1 ring-inset transition hover:brightness-110 sm:w-auto"
              >
                <CalendarIcon className="size-5" />
                {t("artistProfile.quote")}
              </Link>
            )}
            {/* Métricas: para el dueño siempre; para el resto, solo si el
                artista las hizo públicas. Con enlace compartido se entra por la
                URL con token, no por este botón. */}
            {on("metricas") &&
              (isOwner || profile.metricsVisibility === "publico") && (
              <Link
                href={`/artistas/${profile.slug}/metricas`}
                className="bg-amethyst-500/10 text-amethyst-200 ring-amethyst-300/40 hover:bg-amethyst-500/20 col-span-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-bold tracking-[2px] uppercase ring-1 ring-inset transition hover:text-white sm:col-span-1 sm:w-auto"
              >
                <ChartBarIcon className="size-5" />
                {t("artistProfile.actionMetrics")}
                {isOwner && profile.metricsVisibility !== "publico" && (
                  <LockIcon
                    className="size-3.5 text-white/40"
                    aria-label={t("artistProfile.metricsPrivate")}
                  />
                )}
              </Link>
            )}
          </div>
        </div>

        {/* Estadísticas — 4 tarjetas */}
        <section className="mx-auto max-w-400 px-6 pt-14">
          <h2 className="font-narrow mb-6 text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
            {t("artistProfile.sectionStats")}
          </h2>
          <StatsCards profile={profile} />
        </section>

        {/* Media destacada. La presentación la decide EL MATERIAL, no la etiqueta
            de quien lo sube (ver `presentacionDestacada`):
              · todo vertical → REELS. En escritorio, cuadrícula centrada que se
                abre al pulsar; en móvil NO se toca nada, porque ahí el vertical a
                ancho completo es su formato nativo y ya se ve mejor que cualquier
                reproductor horizontal. El problema era solo de escritorio.
              · algo horizontal o una foto → el reproductor ancho de siempre.
            Atarlo al rol se descartó: un cantante que sube un vertical se vería
            recortado igual, y una modelo con material horizontal quedaría metida a
            la fuerza en un marco 9:16. */}
        {on("mediaDestacada") && (
        <section className="mx-auto max-w-400 px-6 pt-16">
          <h2 className="font-narrow mb-6 text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
            {/* El nombre sí sigue a la etiqueta: para una modelo esto ES su reel,
                y "media destacada" no dice nada en su oficio. */}
            {esReel(profile.disciplines)
              ? t("artistProfile.sectionReel")
              : t("artistProfile.sectionFeatured")}
          </h2>
          {destacada === "reels" ? (
            <>
              {/* Dos árboles, cada uno simple, en vez de uno que se recoloque
                  solo: el corte por CSS no depende del cliente, así que no hay
                  parpadeo al hidratar ni desajuste con el HTML del servidor. */}
              <div className="lg:hidden">
                <FeaturedMediaPlayer
                  items={destacados}
                  photoURL={profile.photoURL}
                  name={profile.artisticName}
                  accent={profile.accent}
                />
              </div>
              <div className="hidden lg:block">
                <ReelsGrid
                  items={destacados}
                  name={profile.artisticName}
                  accent={profile.accent}
                />
              </div>
            </>
          ) : (
            <FeaturedMediaPlayer
              items={destacados}
              photoURL={profile.photoURL}
              name={profile.artisticName}
              accent={profile.accent}
            />
          )}
        </section>
        )}

        {/* La puerta al BOOK (§10) va ENCIMA de la galería, y la galería no se
            toca: son dos cosas distintas y el perfil no tiene por qué elegir.
            Aparece solo si la sección está encendida Y hay book publicado. */}
        {on("book") && <BookEntryCard profile={profile} />}

        {/* Galería + Temas: dos paneles con BORDE. La galería usa el MISMO
            mosaico que el editor (`GalleryMosaic`) → se ve idéntica a como el
            artista la armó. Cada panel obedece a su sección, y si el artista
            apaga las dos, la fila entera desaparece.

            Tres cosas de esta fila NO son decorativas — son lo que impide que
            desborde a la derecha y arrastre a todas las secciones de abajo (que
            se centran con `mx-auto`: si la página se ensancha, se corren):
              1. `grid-cols-1` EXPLÍCITO. Sin él, una sola columna es una pista
                 implícita `auto`, y una pista `auto` se dimensiona al MAX-CONTENT
                 de lo que lleva dentro: un título de tema largo (van con
                 `truncate`, o sea `nowrap`) estira la pista más allá del
                 contenedor. `1fr` sí acepta encogerse.
              2. `min-w-0` en cada columna. Un ítem de grid tiene `min-width:auto`,
                 así que su contenido puede empujarlo por debajo de su pista.
              3. `overflow-hidden` en el panel de la galería. Antes lo cubría de
                 rebote el `overflow-y-auto` del panel con scroll interno, que se
                 retiró al pasar a mosaicos: sin él, nada corta lo que se salga. */}
        {((on("galeria") && profile.gallery.length > 0) ||
          (on("canciones") && profile.tracks.length > 0)) && (
          <div className="mx-auto max-w-400 px-6 pt-16">
            <div
              className={`grid grid-cols-1 gap-8 ${
                on("galeria") &&
                profile.gallery.length > 0 &&
                on("canciones") &&
                profile.tracks.length > 0
                  ? "lg:grid-cols-2"
                  : ""
              }`}
            >
              {on("galeria") && profile.gallery.length > 0 && (
                <div className="min-w-0">
                  <div className="mb-5 flex items-center gap-3">
                    <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
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
                  {/* SIN scroll propio: el alto lo fija la proporción de la
                      plantilla. Un panel que hacía scroll dentro del scroll de la
                      página convertía pasar por la galería en una lotería. */}
                  <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <GalleryMosaic
                      items={profile.gallery}
                      layout={profile.galleryLayout}
                      renderItem={(item, i) => (
                        <button
                          type="button"
                          onClick={() => setViewerIndex(i)}
                          aria-label={t("artistProfile.viewPhoto", { n: i + 1 })}
                          className="group absolute inset-0"
                        >
                          <Image
                            src={item.url}
                            alt={t("artistProfile.galleryPhotoAlt", {
                              name: profile.artisticName,
                              n: i + 1,
                            })}
                            fill
                            sizes="(max-width: 1024px) 45vw, 22vw"
                            className="object-cover transition duration-500 group-hover:scale-105"
                          />
                        </button>
                      )}
                    />
                  </div>
                </div>
              )}
              {on("canciones") && profile.tracks.length > 0 && (
                <div className="min-w-0">
                  <h2 className="font-narrow mb-5 text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
                    {t("artistProfile.topTracks")}
                  </h2>
                  <div className="max-h-[620px] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <TrackPlayers tracks={profile.tracks} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Descripción — SOBRE MÍ. La TRAYECTORIA vive aquí, como chip sobre el
            párrafo: da contexto a la historia en vez de competir con la foto. */}
        {on("sobreMi") && (
        <section className="mx-auto max-w-400 px-6 pt-16">
          <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
            {t("artistProfile.aboutMe")}
          </h2>
          {anios !== null && (
            <div className="mt-4 flex flex-wrap gap-2">
              <ProfileChip
                accent={profile.accent}
                icon={<ClockIcon className="size-4" />}
              >
                {t("artistProfile.yearsCareer", { count: anios })}
              </ProfileChip>
            </div>
          )}
          <p className="text-silver-200 mt-5 max-w-3xl text-lg leading-relaxed sm:text-xl">
            {profile.bio}
          </p>
        </section>
        )}

        {/* ── Secciones por ETIQUETA (§05) ──────────────────────────────
            Cada una obedece a su interruptor del gestor Y solo aparece si tiene
            datos: el gestor dice si está permitida, el contenido si hay algo. */}
        {on("fichaTecnica") && <FichaTecnicaSection profile={profile} />}
        {on("portafolio") && <CategoriasSection profile={profile} />}
        {on("generosBaile") && <GenerosBaileSection profile={profile} />}
        {on("trayectoria") && <TrayectoriaSection profile={profile} />}
        {on("reconocimientos") && <ReconocimientosSection profile={profile} />}
        {on("portafolio") && <MarcasSection profile={profile} />}

        {/* Colectivos (solo la sección; backend en su fase) */}
        <div className="pt-16">
          <ProfileColectivos profile={profile} isOwner={isOwner} />
        </div>

        {/* Géneros musicales */}
        {on("generosMusicales") && generos.length > 0 && (
          <section className="mx-auto max-w-400 px-6 pb-4">
            <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
              {t("artistProfile.genres")}
            </h2>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {generos.map((g) => (
                <ProfileChip key={g} accent={profile.accent}>
                  {g}
                </ProfileChip>
              ))}
            </div>
          </section>
        )}

        {/* Redes sociales */}
        {on("redes") && (
          <section className="mx-auto max-w-400 px-6 py-14">
            <h2 className="font-narrow mb-6 text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
              {t("artistProfile.sectionSocials")}
            </h2>
            <Socials profile={profile} />
          </section>
        )}

        {/* Artistas relacionados / colaboradores (red interna) */}
        {on("relacionados") &&
          profile.relatedArtists &&
          profile.relatedArtists.length > 0 && (
          <RelatedArtists
            slugs={profile.relatedArtists}
            currentSlug={profile.slug}
          />
        )}
      </div>

      {viewerIndex !== null && (
        <PhotoViewer
          images={profile.gallery.map((g) => g.url)}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={setViewerIndex}
        />
      )}
    </article>
    </ProfileMetricsProvider>
  );
}
