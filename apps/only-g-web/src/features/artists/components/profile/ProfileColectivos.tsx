"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import {
  inicialesColectivo,
  totalMiembros,
  type Colectivo,
} from "@only-g/shared-types/colectivo";
import { listColectivosDeArtista } from "@/features/colectivos/lib/colectivos-repo";
import { ArrowRightIcon, PlusIcon, UsersIcon } from "@/components/icons";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";

/**
 * Sección Colectivos del perfil de artista (§04 ↔ §07).
 *
 * Los COLECTIVOS son la fuente de verdad de la pertenencia: se consultan por
 * `miembroSlugs` en vez de leer una lista copiada dentro del perfil. Así, cuando
 * un colectivo añade o quita a alguien, el perfil de esa persona se entera solo
 * — sin escrituras cruzadas ni dos copias que acaban desincronizadas.
 *
 * `profile.colectivos` se conserva como SEMILLA (perfiles de ejemplo y SSR); si
 * la consulta devuelve datos reales, mandan esos.
 */
export function ProfileColectivos({
  profile,
  isOwner,
}: {
  profile: ArtistProfile;
  isOwner: boolean;
}) {
  const t = useTranslations("artistProfile");
  const tc = useTranslations("colectivos");
  const [reales, setReales] = useState<Colectivo[] | null>(null);

  useEffect(() => {
    let vivo = true;
    listColectivosDeArtista(profile.slug)
      .then((l) => vivo && setReales(l))
      // Sin índice todavía o sin permisos: cae a la semilla, no rompe la página.
      .catch(() => vivo && setReales([]));
    return () => {
      vivo = false;
    };
  }, [profile.slug]);

  const semilla = profile.colectivos ?? [];
  const lista =
    reales && reales.length > 0
      ? reales.map((c) => ({
          slug: c.slug,
          nombre: c.nombre,
          tipo: c.tipo,
          accent: c.accent,
          // El rol lo dice el colectivo, no el perfil: es quien lo gestiona.
          estado: c.miembros.find((m) => m.slug === profile.slug)?.rol,
          logoURL: c.logoURL,
          miembros: totalMiembros(c),
        }))
      : semilla.map((c) => ({
          slug: c.slug,
          nombre: c.nombre,
          tipo: c.tipo,
          accent: c.accent,
          estado: c.estado,
          logoURL: undefined as string | undefined,
          miembros: 0,
        }));

  return (
    <section className="mx-auto max-w-400 px-6 pb-16">
      <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        {t("sectionColectivos")}
      </h2>
      <p className="text-silver-400 mt-1 text-sm">{t("colectivosSubtitle")}</p>

      <div className="mt-6 space-y-4">
        {lista.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {lista.map((c) => {
              const accent = c.accent ?? "#7c3aed";
              return (
                <Link
                  key={c.slug}
                  href={`/colectivos/${c.slug}`}
                  className="bg-ink-panel group flex items-center gap-4 rounded-2xl border border-white/10 p-4 transition hover:border-white/25"
                >
                  <span
                    className="font-narrow grid size-12 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
                    style={{
                      backgroundImage: `linear-gradient(315deg, ${accent}, #1a1626)`,
                    }}
                  >
                    {c.logoURL ? (
                      <Image
                        src={c.logoURL}
                        alt=""
                        width={48}
                        height={48}
                        className="size-full rounded-xl object-cover"
                      />
                    ) : (
                      inicialesColectivo(c.nombre)
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {c.nombre}
                    </p>
                    <p className="text-silver-400 flex items-center gap-2 text-xs tracking-wide uppercase">
                      {tc(`tipo.${c.tipo}`)}
                      {c.miembros > 0 && (
                        <span className="text-silver-500 flex items-center gap-1 normal-case">
                          <UsersIcon className="size-3" />
                          {c.miembros}
                        </span>
                      )}
                    </p>
                  </div>
                  {c.estado && (
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300 ring-1 ring-emerald-500/30 ring-inset">
                      {c.estado}
                    </span>
                  )}
                  <ArrowRightIcon className="text-silver-500 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-8 text-center">
            <p className="text-silver-400 text-sm">{t("colectivosEmpty")}</p>
          </div>
        )}

        {/* Antes: dos botones muertos con "próximamente". Ahora llevan al
            directorio, que ya existe — buscar un colectivo o fundar el tuyo son
            dos cosas que se pueden hacer hoy. */}
        {isOwner && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/colectivos"
              className={`${glassSurfaceSoft} flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold tracking-wide text-white/90 uppercase transition hover:text-white`}
            >
              <GlassSheen />
              <UsersIcon className="relative size-4" />
              <span className="relative">{t("exploreColectivos")}</span>
            </Link>
            <Link
              href="/colectivos/nuevo"
              className="bg-amethyst-500/10 text-amethyst-200 ring-amethyst-300/40 hover:bg-amethyst-500/20 flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold tracking-wide uppercase ring-1 ring-inset transition hover:text-white"
            >
              <PlusIcon className="size-4" />
              {tc("create")}
            </Link>
          </div>
        )}

        <p className="text-silver-500 text-xs">{t("colectivosNote")}</p>
      </div>
    </section>
  );
}
