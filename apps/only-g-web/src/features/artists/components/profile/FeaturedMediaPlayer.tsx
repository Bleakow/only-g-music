"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import type { FeaturedMedia } from "@only-g/shared-types/artist-profile";
import { PlayIcon, MusicIcon } from "@/components/icons";
import { FeaturedVideoPlayer } from "./FeaturedVideoPlayer";

/**
 * Media destacada (§04) al estilo del mockup: un PLAYER principal (con controles
 * propios, ver FeaturedVideoPlayer) + su título descriptivo, y una lista "Más
 * videos" (siempre visible) donde cada clip lleva su título; el de audio se marca.
 * Al seleccionar otro, pasa al player principal. Sin items, cae a la foto.
 */
export function FeaturedMediaPlayer({
  items,
  photoURL,
  name,
  accent,
}: {
  items: FeaturedMedia[];
  photoURL: string;
  name: string;
  accent?: string;
}) {
  const t = useTranslations("artistProfile");
  const [active, setActive] = useState(0);
  const list: FeaturedMedia[] = items.length
    ? items
    : photoURL
      ? [{ url: photoURL, type: "image" }]
      : [];
  if (list.length === 0) return null;
  const idx = Math.min(active, list.length - 1);
  const current = list[idx];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {/* Player principal + título descriptivo */}
      <div>
        {current.type === "video" ? (
          <FeaturedVideoPlayer
            key={current.url}
            src={current.url}
            muted={!current.withAudio}
            name={name}
            accent={accent}
          />
        ) : (
          <div className="bg-ink-soft relative aspect-video overflow-hidden rounded-2xl border border-white/10">
            <Image
              src={current.url}
              alt={name}
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
            />
          </div>
        )}
        <div className="mt-4">
          <h3 className="font-narrow text-xl font-bold text-white uppercase sm:text-2xl">
            {current.title || t("clipN", { n: idx + 1 })}
          </h3>
          {current.type === "video" && current.withAudio && (
            <p className="text-silver-400 mt-1 flex items-center gap-1.5 text-xs">
              <MusicIcon className="size-3.5" />
              {t("withSound")}
            </p>
          )}
        </div>
      </div>

      {/* Lista "Más videos": SIEMPRE visible, con estado vacío. */}
      <div>
        <p className="text-silver-400 text-xs font-semibold tracking-[2px] uppercase">
          {t("moreVideos")}
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {list.map((m, i) => {
            const on = i === active;
            return (
              <button
                key={`${m.url}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={on}
                className={`flex items-center gap-4 rounded-2xl border p-3 text-left transition ${
                  on
                    ? "border-amethyst-300/50 bg-amethyst-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <span className="from-amethyst-500 to-amethyst-700 grid size-14 shrink-0 place-items-center rounded-xl bg-linear-to-br text-white">
                  <PlayIcon className="size-6 translate-x-0.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">
                    {m.title || t("clipN", { n: i + 1 })}
                  </p>
                  {m.type === "video" && m.withAudio && (
                    <p className="text-silver-400 flex items-center gap-1 text-xs">
                      <MusicIcon className="size-3" />
                      {t("withSound")}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          {list.length < 2 && (
            <div className="text-silver-500 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs">
              {t("noMoreVideos")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
