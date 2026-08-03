"use client";

import { useTranslations } from "next-intl";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import {
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@only-g/shared-types/artist";
import { PlusIcon } from "@/components/icons";
import { useTrackSocialClick } from "./ProfileMetricsContext";

/**
 * Botón "Seguir": abre la red social PRINCIPAL del artista (la que él elige en el
 * editor; si no eligió ninguna, la primera red disponible). Si no tiene redes, no
 * se muestra. Es un enlace externo, no un follow interno.
 */
export function FollowButton({ profile }: { profile: ArtistProfile }) {
  const t = useTranslations("artistProfile");
  const countClick = useTrackSocialClick();
  const primary = primaryTarget(profile);
  if (!primary) return null;
  const { platform, url } = primary;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      // "Seguir" abre una red concreta, así que cuenta como clic de ESA red.
      onClick={() => countClick(platform)}
      className="from-amethyst-400 to-amethyst-600 ring-amethyst-300/40 font-narrow inline-flex min-h-11 items-center gap-2 rounded-full bg-linear-to-b px-7 py-3 text-sm font-bold tracking-[2px] text-white uppercase shadow-[0_6px_22px_rgba(124,58,237,0.55)] ring-1 ring-inset transition hover:brightness-110"
    >
      <PlusIcon className="size-4" />
      {t("follow")}
    </a>
  );
}

/** Red principal (la elegida, o la primera disponible) con su URL. Devuelve las
 *  dos cosas juntas para que el botón y la métrica no puedan discrepar. */
function primaryTarget(
  p: ArtistProfile,
): { platform: SocialPlatform; url: string } | null {
  const valid = (u?: string): string | null => (u && u !== "#" ? u : null);
  if (p.primarySocial) {
    const u = valid(p.socials[p.primarySocial]);
    if (u) return { platform: p.primarySocial, url: u };
  }
  for (const platform of SOCIAL_PLATFORMS) {
    const u = valid(p.socials[platform]);
    if (u) return { platform, url: u };
  }
  return null;
}
