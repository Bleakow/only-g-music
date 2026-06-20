"use client";

import { useState } from "react";
import type { ProfileTrack, TrackPlatform } from "@/domain/artist-profile";
import { platformsDisponibles, trackEmbed } from "../../lib/embeds";
import { PlayIcon, SpotifyIcon, YouTubeIcon } from "@/components/icons";

/**
 * Lista de temas con reproductor embebido. El visitante elige plataforma
 * (YouTube/Spotify) cuando hay temas en ambas; cada tema se expande a su iframe.
 * Si no hay links reproducibles (datos semilla), cae a una lista de títulos.
 */
export function TrackPlayers({ tracks }: { tracks: ProfileTrack[] }) {
  const plataformas = platformsDisponibles(tracks);
  const [platform, setPlatform] = useState<TrackPlatform>(
    plataformas[0] ?? "spotify",
  );
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (plataformas.length === 0) {
    return (
      <ol className="mt-4 divide-y divide-white/10">
        {tracks.map((t, i) => (
          <li key={`${t.title}-${i}`} className="flex items-center gap-4 py-3">
            <span className="w-6 text-right tabular-nums text-white/40">
              {i + 1}
            </span>
            <span className="text-white/90">{t.title}</span>
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
        {tracks.map((t, i) => {
          const embed = trackEmbed(t, platform);
          const open = openIdx === i;
          return (
            <li key={`${t.title}-${i}`} className="py-1">
              <button
                type="button"
                disabled={!embed}
                onClick={() => setOpenIdx(open ? null : i)}
                aria-label={embed ? `Reproducir ${t.title}` : t.title}
                className="flex min-h-11 w-full items-center gap-4 py-2 text-left disabled:opacity-40"
              >
                <span className="w-6 text-right tabular-nums text-white/40">
                  {i + 1}
                </span>
                <span className="flex-1 text-white/90">{t.title}</span>
                {embed ? (
                  <span
                    className={`inline-flex size-9 items-center justify-center rounded-full border transition ${
                      open
                        ? "border-amethyst-300 bg-amethyst-500/20 text-white"
                        : "border-white/20 text-white/80"
                    }`}
                  >
                    <PlayIcon className="size-6" />
                  </span>
                ) : (
                  <span className="text-xs text-white/30">no disponible</span>
                )}
              </button>
              {open && embed && (
                <div className="mb-3 mt-1 overflow-hidden rounded-xl border border-white/10">
                  <iframe
                    src={embed}
                    title={t.title}
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
