"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Artist } from "@/domain/artist";
import type { Role } from "@/domain/user";
import { getVisibleProfiles } from "../lib/artist-profile-repo";
import { profileToArtist } from "../lib/profile-display";
import { ArtistGrid } from "./ArtistGrid";

type Tab = "todos" | "artista" | "beatmaker";

// Un perfil sin disciplinas (semilla legacy) se trata como cantante.
function disciplinesOf(a: Artist): Role[] {
  return a.disciplines ?? ["artista"];
}

/**
 * Vitrina de artistas. El servidor pasa los artistas semilla (`fallback`) para
 * SSR/SEO; en cliente cargamos los perfiles REALES con premium vigente desde
 * Firestore y, si hay alguno, reemplazan a la semilla. Patrón del proyecto: la
 * data dinámica se lee en cliente.
 *
 * Segmentación: si conviven cantantes y beatmakers, se muestra una barra de
 * pestañas (Todos / Cantantes / Beatmakers) que filtra por disciplina — mismo
 * criterio que la lista del admin. Un perfil con varias disciplinas aparece en
 * cada pestaña que le corresponda. Con una sola disciplina no hay pestañas.
 */
export function ArtistsShowcase({ fallback }: { fallback: Artist[] }) {
  const t = useTranslations("artistsPage");
  const [artists, setArtists] = useState<Artist[]>(fallback);
  const [tab, setTab] = useState<Tab>("todos");

  useEffect(() => {
    let active = true;
    getVisibleProfiles()
      .then((profiles) => {
        if (!active || profiles.length === 0) return;
        setArtists(profiles.map(profileToArtist));
      })
      .catch(() => {
        /* sin perfiles reales o sin red: nos quedamos con la semilla */
      });
    return () => {
      active = false;
    };
  }, []);

  const hasCantantes = useMemo(
    () => artists.some((a) => disciplinesOf(a).includes("artista")),
    [artists],
  );
  const hasBeatmakers = useMemo(
    () => artists.some((a) => disciplinesOf(a).includes("beatmaker")),
    [artists],
  );
  // Las pestañas solo tienen sentido cuando hay ambos tipos que separar.
  const segmentar = hasCantantes && hasBeatmakers;

  const lista =
    !segmentar || tab === "todos"
      ? artists
      : artists.filter((a) => disciplinesOf(a).includes(tab));

  return (
    <div>
      {segmentar && (
        <div
          role="tablist"
          aria-label={t("segmentLabel")}
          className="mb-8 flex flex-wrap gap-2"
        >
          {(["todos", "artista", "beatmaker"] as Tab[]).map((id) => {
            const activo = tab === id;
            return (
              <button
                key={id}
                id={`tab-${id}`}
                type="button"
                role="tab"
                aria-selected={activo}
                aria-controls="artists-panel"
                onClick={() => setTab(id)}
                className={`rounded-full border px-4 py-2 text-xs tracking-[2px] uppercase transition ${
                  activo
                    ? "border-amethyst-300/60 bg-amethyst-500/15 text-amethyst-100"
                    : "border-white/15 text-white/60 hover:border-white/30 hover:text-white/80"
                }`}
              >
                {t(
                  id === "todos"
                    ? "tabTodos"
                    : id === "artista"
                      ? "tabCantantes"
                      : "tabBeatmakers",
                )}
              </button>
            );
          })}
        </div>
      )}

      <div
        id="artists-panel"
        role={segmentar ? "tabpanel" : undefined}
        aria-labelledby={segmentar ? `tab-${tab}` : undefined}
      >
        <ArtistGrid artists={lista} />
      </div>
    </div>
  );
}
