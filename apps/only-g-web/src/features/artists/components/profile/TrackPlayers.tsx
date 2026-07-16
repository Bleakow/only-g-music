"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ProfileTrack, TrackPlatform } from "@only-g/shared-types/artist-profile";
import { platformsDisponibles, trackEmbed } from "../../lib/embeds";
import { PlayIcon, SpotifyIcon, YouTubeIcon } from "@/components/icons";
import { glassSurface, GlassSheen } from "@/components/ui/glass";

/**
 * Lista de temas con reproductor embebido. El visitante elige plataforma
 * (YouTube/Spotify) cuando hay temas en ambas; cada tema se expande a su iframe.
 * Si no hay links reproducibles (datos semilla), cae a una lista de títulos.
 */
export function TrackPlayers({ tracks }: { tracks: ProfileTrack[] }) {
  const t = useTranslations();
  const plataformas = platformsDisponibles(tracks);
  const [platform, setPlatform] = useState<TrackPlatform>(
    plataformas[0] ?? "spotify",
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (plataformas.length === 0) {
    return (
      <ol className="mt-4 divide-y divide-white/10">
        {tracks.map((track, i) => (
          <li
            key={`${track.title}-${i}`}
            className="flex items-center gap-4 py-3"
          >
            <span className="w-6 text-right tabular-nums text-white/40">
              {i + 1}
            </span>
            <span className="text-white/90">{track.title}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="mt-4">
      {plataformas.length > 1 && (
        <div className="mb-4 inline-flex rounded-full border border-white/15 p-1">
          {plataformas.map((p) => {
            const Icon = p === "youtube" ? YouTubeIcon : SpotifyIcon;
            const active = p === platform;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[2px] transition ${
                  active ? "bg-white text-ink" : "text-silver-300 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
                {p === "youtube" ? "YouTube" : "Spotify"}
              </button>
            );
          })}
        </div>
      )}

      <ol className="divide-y divide-white/10">
        {tracks.map((track, i) => {
          const embed = trackEmbed(track, platform);
          const open = openIdx === i;
          return (
            <li key={`${track.title}-${i}`} className="py-1">
              <button
                type="button"
                disabled={!embed}
                onClick={() => setOpenIdx(open ? null : i)}
                aria-label={
                  embed
                    ? t("trackPlayers.play", { title: track.title })
                    : track.title
                }
                className="flex min-h-11 w-full items-center gap-4 py-2 text-left disabled:opacity-40"
              >
                <span className="w-6 text-right tabular-nums text-white/40">
                  {i + 1}
                </span>
                <span className="flex-1 text-white/90">{track.title}</span>
                {embed ? (
                  <span
                    className={`${glassSurface} inline-flex size-10 items-center justify-center rounded-full text-white ${
                      open ? "outline outline-2 outline-amethyst-300" : ""
                    }`}
                  >
                    <GlassSheen />
                    <span className="relative">
                      <PlayIcon className="size-5" />
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-white/30">
                    {t("trackPlayers.unavailable")}
                  </span>
                )}
              </button>
              {open && embed && (
                <div className="mb-3 mt-1 overflow-hidden rounded-xl border border-white/10">
                  <iframe
                    src={embed}
                    title={track.title}
                    loading="lazy"
                    allow="autoplay; encrypted-media; clipboard-write; picture-in-picture"
                    allowFullScreen
                    className={
                      platform === "spotify"
                        ? "h-[152px] w-full"
                        : "aspect-video w-full"
                    }
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
