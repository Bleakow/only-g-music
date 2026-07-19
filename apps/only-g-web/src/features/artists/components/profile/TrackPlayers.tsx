"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ProfileTrack, TrackPlatform } from "@only-g/shared-types/artist-profile";
import { platformsDisponibles, trackEmbed } from "../../lib/embeds";
import { claimAudio, subscribeAudio } from "../../lib/audio-bus";
import { PlayIcon, PauseIcon, SpotifyIcon, YouTubeIcon } from "@/components/icons";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";

/** Ecualizador decorativo: marca el tema activo con barras que laten. */
function Equalizer({ animate }: { animate: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      {[0, 1, 2, 3].map((b) => (
        <motion.span
          key={b}
          className="bg-amethyst-300 w-[3px] rounded-full"
          initial={{ height: "35%" }}
          animate={animate ? { height: ["35%", "100%", "45%", "85%", "35%"] } : { height: "40%" }}
          transition={
            animate
              ? { duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: b * 0.13 }
              : { duration: 0.2 }
          }
        />
      ))}
    </span>
  );
}

/**
 * Lista de temas destacados con reproductor embebido. El visitante elige
 * plataforma (YouTube/Spotify) cuando hay temas en ambas; cada tema se expande a
 * su iframe. Si no hay links reproducibles (datos semilla), cae a una lista de
 * títulos. Coordina con la canción del perfil vía audio-bus: abrir un tema pausa
 * la canción, y si la canción suena, el tema abierto se colapsa (corta su sonido).
 */
export function TrackPlayers({ tracks }: { tracks: ProfileTrack[] }) {
  const t = useTranslations();
  const reduce = useReducedMotion();
  const plataformas = platformsDisponibles(tracks);
  const [platform, setPlatform] = useState<TrackPlatform>(
    plataformas[0] ?? "spotify",
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // Si otra fuente (la canción del perfil) toma el turno, colapsamos el embed
  // abierto: al desmontar el iframe se corta su reproducción. Ver audio-bus.
  useEffect(
    () =>
      subscribeAudio((active) => {
        if (active !== "track") setOpenIdx(null);
      }),
    [],
  );

  function handleToggle(i: number) {
    setOpenIdx((prev) => {
      const next = prev === i ? null : i;
      if (next !== null) claimAudio("track"); // reclamamos el turno de audio
      return next;
    });
  }

  if (plataformas.length === 0) {
    return (
      <ol className="mt-4 flex flex-col gap-2">
        {tracks.map((track, i) => (
          <li
            key={`${track.title}-${i}`}
            className={`${glassSurfaceSoft} flex items-center gap-4 rounded-xl px-4 py-3`}
          >
            <GlassSheen />
            <span className="font-narrow relative w-6 text-right text-sm tabular-nums text-white/40">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="relative text-white/90">{track.title}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="mt-4">
      {plataformas.length > 1 && (
        <div className="mb-4 inline-flex rounded-full border border-white/15 bg-white/5 p-1">
          {plataformas.map((p) => {
            const Icon = p === "youtube" ? YouTubeIcon : SpotifyIcon;
            const active = p === platform;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className="relative inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-[2px] uppercase transition"
              >
                {active && (
                  <motion.span
                    layoutId="track-platform-pill"
                    className="bg-amethyst-500 absolute inset-0 rounded-full shadow-[0_0_18px_rgba(139,92,246,0.5)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span
                  className={`relative flex items-center gap-2 ${
                    active ? "text-white" : "text-silver-300 hover:text-white"
                  }`}
                >
                  <Icon className="size-4" />
                  {p === "youtube" ? "YouTube" : "Spotify"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <ol className="flex flex-col gap-2.5">
        {tracks.map((track, i) => {
          const embed = trackEmbed(track, platform);
          const open = openIdx === i;
          const Icon = platform === "youtube" ? YouTubeIcon : SpotifyIcon;
          return (
            <motion.li
              key={`${track.title}-${i}`}
              layout={!reduce}
              className={`${glassSurfaceSoft} group relative overflow-hidden rounded-2xl ${
                open ? "ring-amethyst-300/70 ring-1" : ""
              }`}
            >
              <GlassSheen />
              <button
                type="button"
                disabled={!embed}
                onClick={() => handleToggle(i)}
                aria-label={
                  embed
                    ? open
                      ? t("trackPlayers.pause", { title: track.title })
                      : t("trackPlayers.play", { title: track.title })
                    : track.title
                }
                className="relative flex min-h-[68px] w-full items-center gap-4 px-4 py-3 text-left disabled:cursor-not-allowed"
              >
                <span className="font-narrow w-5 shrink-0 text-center text-sm tabular-nums text-white/35">
                  {String(i + 1).padStart(2, "0")}
                </span>

                {embed ? (
                  <motion.span
                    whileTap={reduce ? undefined : { scale: 0.9 }}
                    className={`grid size-11 shrink-0 place-items-center rounded-full transition-colors ${
                      open
                        ? "bg-amethyst-500 text-white shadow-[0_0_22px_rgba(139,92,246,0.65)]"
                        : "bg-white/10 text-white group-hover:bg-white/20"
                    }`}
                  >
                    {open ? (
                      <PauseIcon className="size-5" />
                    ) : (
                      <PlayIcon className="size-5 translate-x-px" />
                    )}
                  </motion.span>
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/5 text-white/25">
                    <PlayIcon className="size-5 translate-x-px" />
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate transition-colors ${
                      embed ? "text-white" : "text-white/40"
                    }`}
                  >
                    {track.title}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-[11px] tracking-[2px] text-white/40 uppercase">
                    {embed ? (
                      <>
                        <Icon className="size-3.5" />
                        {platform === "youtube" ? "YouTube" : "Spotify"}
                      </>
                    ) : (
                      t("trackPlayers.unavailable")
                    )}
                  </span>
                </span>

                {open && (
                  <span className="shrink-0 pr-1">
                    <Equalizer animate={!reduce} />
                  </span>
                )}
              </button>

              <AnimatePresence initial={false}>
                {open && embed && (
                  <motion.div
                    key="embed"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="relative overflow-hidden"
                  >
                    <div className="border-t border-white/10 p-2">
                      <iframe
                        src={embed}
                        title={track.title}
                        loading="lazy"
                        allow="autoplay; encrypted-media; clipboard-write; picture-in-picture"
                        allowFullScreen
                        className={
                          platform === "spotify"
                            ? "h-[152px] w-full rounded-lg"
                            : "aspect-video w-full rounded-lg"
                        }
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
