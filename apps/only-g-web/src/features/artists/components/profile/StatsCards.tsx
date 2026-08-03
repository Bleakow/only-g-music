"use client";

import type { ComponentType, SVGProps } from "react";
import { useTranslations } from "next-intl";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import { formatCompact } from "@only-g/shared-types/artist-profile";
import type { SocialPlatform } from "@only-g/shared-types/artist";
import { UserRoundIcon, PlayIcon, DiscIcon, EyeIcon } from "@/components/icons";
import { SOCIAL_META } from "../../lib/socials";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Estadísticas del artista (§04): 4 tarjetas. Seguidores (suma YT/Spotify, con sus
 * iconos) · Reproducciones (vistas de YouTube) · Sencillos (nº temas) · Visitas
 * (contador propio). Los datos de redes salen de `socialStats` (Cloud Function);
 * si aún no se calculó, se muestra "—" sin inventar cifras.
 */
export function StatsCards({ profile }: { profile: ArtistProfile }) {
  const t = useTranslations("artistProfile");
  const stats = profile.socialStats;

  const cards: {
    Icon: IconType;
    value: string;
    label: string;
    sources?: SocialPlatform[];
  }[] = [
    {
      Icon: UserRoundIcon,
      value: stats ? formatCompact(stats.followersTotal ?? 0) : "—",
      label: t("statFollowers"),
      sources: stats?.sources ?? [],
    },
    {
      Icon: PlayIcon,
      value: stats?.plays != null ? formatCompact(stats.plays) : "—",
      label: t("statPlays"),
    },
    {
      Icon: DiscIcon,
      value: formatCompact(profile.tracks.length),
      label: t("statSingles"),
    },
    {
      Icon: EyeIcon,
      value: formatCompact(profile.visitas ?? 0),
      label: t("statVisits"),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
      {cards.map(({ Icon, value, label, sources }, i) => (
        <div
          key={i}
          className="rounded-3xl border border-white/10 bg-ink-panel p-6 sm:p-8"
        >
          <div className="flex items-center justify-between">
            <Icon className="text-amethyst-300 size-6" />
            {sources && sources.length > 0 && (
              <span className="flex items-center gap-1.5">
                {sources.map((p) => {
                  const meta = SOCIAL_META[p];
                  if (!meta) return null;
                  const SrcIcon = meta.Icon;
                  return (
                    <SrcIcon
                      key={p}
                      className="size-4 text-white/40"
                      aria-label={meta.label}
                    />
                  );
                })}
              </span>
            )}
          </div>
          <p className="font-narrow mt-4 text-4xl font-bold text-white tabular-nums sm:mt-5 sm:text-5xl">
            {value}
          </p>
          <p className="text-silver-400 mt-1 text-[0.65rem] font-semibold tracking-[2px] uppercase sm:text-xs">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}
