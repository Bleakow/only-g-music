"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { PlaySource } from "@only-g/shared-types/profile-metrics";
import { trackPlay, trackSocialClick } from "../../lib/metrics-client";

/**
 * Contexto de métricas del perfil.
 *
 * Existe para no arrastrar `slug` por las props de cinco reproductores, pero
 * sobre todo por un motivo de diseño: SOLO el perfil público monta el provider.
 * Los mismos componentes (`ProfileAudioPlayer`, `FeaturedVideoPlayer`…) se usan
 * también en el EDITOR, y allí las pruebas del artista no deben ensuciar sus
 * propias estadísticas. Sin provider, los hooks son no-ops.
 *
 * El dueño tampoco cuenta: mirar tu propio perfil no es una reproducción.
 */

interface MetricsCtx {
  slug: string;
  isOwner: boolean;
}

const Ctx = createContext<MetricsCtx | null>(null);

export function ProfileMetricsProvider({
  slug,
  isOwner,
  children,
}: {
  slug: string;
  isOwner: boolean;
  children: ReactNode;
}) {
  return <Ctx.Provider value={{ slug, isOwner }}>{children}</Ctx.Provider>;
}

/** Cuenta una reproducción. No-op fuera del perfil público o si eres el dueño. */
export function useTrackPlay(): (origen: PlaySource, cancion?: string) => void {
  const ctx = useContext(Ctx);
  return useCallback(
    (origen: PlaySource, cancion?: string) => {
      if (!ctx || ctx.isOwner) return;
      trackPlay(ctx.slug, origen, cancion);
    },
    [ctx],
  );
}

/** Cuenta un clic a una red social. Mismas condiciones que `useTrackPlay`. */
export function useTrackSocialClick(): (red: string) => void {
  const ctx = useContext(Ctx);
  return useCallback(
    (red: string) => {
      if (!ctx || ctx.isOwner) return;
      trackSocialClick(ctx.slug, red);
    },
    [ctx],
  );
}
