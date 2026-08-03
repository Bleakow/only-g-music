"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  inicialesColectivo,
  miembrosDestacados,
  totalMiembros,
  type Colectivo,
} from "@only-g/shared-types/colectivo";
import { formatCompact } from "@only-g/shared-types/artist-profile";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import {
  ArrowLeftIcon,
  ChatIcon,
  MusicIcon,
  PlayIcon,
  PlusIcon,
  ShareIcon,
} from "@/components/icons";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import { ProfileChip } from "@/features/artists/components/profile/ProfileChip";

/**
 * Perfil público de un COLECTIVO (§07, frames `jbZAJ` sello y `GrUwy` movimiento).
 *
 * Los dos mockups son la MISMA página con distinto vocabulario: un sello tiene
 * "artistas" y "lanzamientos"; un movimiento, "miembros" y "lo más sonado". Por
 * eso no hay dos componentes — hay uno y las etiquetas se resuelven por tipo
 * (`colectivos.perfil.<tipo>.*`), que además deja traducir cada variante.
 */
export function ColectivoProfile({
  colectivo,
  miembros,
  puedeGestionar = false,
}: {
  colectivo: Colectivo;
  /** Perfiles ya resueltos de los miembros destacados (para foto y nombre). */
  miembros: ArtistProfile[];
  puedeGestionar?: boolean;
}) {
  const t = useTranslations("colectivos");
  const accent = colectivo.accent;
  const tipo = colectivo.tipo;
  const destacados = miembrosDestacados(colectivo);
  const stats = colectivo.stats ?? {};

  // Cifras de la cabecera. Se omiten las que no tienen valor: una tarjeta a "0"
  // sin datos reales detrás miente más que no estar.
  const cifras = [
    { key: "miembros", value: totalMiembros(colectivo) },
    { key: "seguidores", value: stats.seguidores },
    { key: "reproducciones", value: stats.reproducciones },
    { key: "lanzamientos", value: stats.lanzamientos },
    { key: "eventos", value: stats.eventos },
  ].filter((c) => typeof c.value === "number" && c.value > 0) as {
    key: string;
    value: number;
  }[];

  return (
    <article className="bg-ink relative min-h-dvh pb-24">
      {/* ── Portada ──────────────────────────────────────────────────── */}
      <section className="relative h-[52vh] min-h-[340px] w-full overflow-hidden bg-neutral-950">
        {colectivo.coverURL ? (
          <Image
            src={colectivo.coverURL}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${accent}66, #0a0712)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-[#0c0a12] via-black/50 to-black/20" />

        <div className="absolute top-4 left-4 z-20">
          <Link
            href="/colectivos"
            className={`${glassSurfaceSoft} inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold tracking-[2px] text-white/90 uppercase transition hover:text-white`}
          >
            <GlassSheen />
            <ArrowLeftIcon className="relative size-4" />
            <span className="relative">{t("backToList")}</span>
          </Link>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-12">
          <div className="flex flex-wrap items-end gap-5">
            <span
              className="font-narrow grid size-20 shrink-0 place-items-center rounded-2xl text-2xl font-bold text-white sm:size-24 sm:text-3xl"
              style={{
                background: `linear-gradient(315deg, ${accent}, #1a1626)`,
                boxShadow: `inset 0 0 0 1px ${accent}8c`,
              }}
            >
              {colectivo.logoURL ? (
                <Image
                  src={colectivo.logoURL}
                  alt=""
                  width={96}
                  height={96}
                  className="size-full rounded-2xl object-cover"
                />
              ) : (
                inicialesColectivo(colectivo.nombre)
              )}
            </span>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <ProfileChip accent={accent} size="sm">
                  {t(`tipo.${tipo}`)}
                </ProfileChip>
                <ProfileChip accent={accent} size="sm">
                  {t(`disciplina.${colectivo.disciplina}`)}
                </ProfileChip>
              </div>
              <h1 className="font-narrow text-5xl leading-[0.9] font-bold text-white uppercase drop-shadow-[0_2px_12px_#000] sm:text-7xl">
                {colectivo.nombre}
              </h1>
              {colectivo.ciudad && (
                <p
                  className="mt-2 text-sm font-bold tracking-[4px] uppercase"
                  style={{ color: accent }}
                >
                  {colectivo.ciudad}
                </p>
              )}
            </div>
          </div>

          {/* Acciones. La principal cambia con el tipo: a un sello se le sigue,
              a un movimiento uno se le une. */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="font-narrow inline-flex min-h-12 items-center gap-2 rounded-full px-7 text-sm font-bold tracking-[2px] text-white uppercase transition hover:brightness-110"
              style={{
                background: `linear-gradient(180deg, ${accent}, ${accent}bb)`,
                boxShadow: `0 6px 22px ${accent}80`,
              }}
            >
              <PlusIcon className="size-4" />
              {t(`perfil.${tipo}.cta`)}
            </button>
            <button
              type="button"
              className={`${glassSurfaceSoft} inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold tracking-[2px] text-white/90 uppercase transition hover:text-white`}
            >
              <GlassSheen />
              <ChatIcon className="relative size-4" />
              <span className="relative">{t("contact")}</span>
            </button>
            <button
              type="button"
              className={`${glassSurfaceSoft} inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold tracking-[2px] text-white/90 uppercase transition hover:text-white`}
            >
              <GlassSheen />
              <ShareIcon className="relative size-4" />
              <span className="relative">{t("share")}</span>
            </button>
            {puedeGestionar && (
              <Link
                href={`/colectivos/${colectivo.slug}/panel`}
                className={`${glassSurfaceSoft} text-amethyst-200 inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold tracking-[2px] uppercase transition hover:text-white`}
              >
                <GlassSheen />
                <span className="relative">{t("manage")}</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-400 px-6 sm:px-12">
        {/* ── Cifras ─────────────────────────────────────────────────── */}
        {cifras.length > 0 && (
          <section className="pt-12">
            <h2 className="font-narrow mb-5 text-xl font-bold tracking-wide text-white uppercase sm:text-2xl">
              {t(`perfil.${tipo}.cifras`)}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {cifras.slice(0, 4).map((c) => (
                <div
                  key={c.key}
                  className="bg-ink-panel rounded-[18px] border border-white/[0.08] p-5"
                >
                  <p className="font-narrow text-3xl font-bold text-white sm:text-4xl">
                    {formatCompact(c.value)}
                  </p>
                  <p className="font-narrow text-silver-400 mt-1 text-[11px] font-semibold tracking-[2px] uppercase">
                    {t(`cifra.${c.key}`)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Miembros destacados ────────────────────────────────────── */}
        <section className="pt-14">
          <div className="mb-5 flex items-end justify-between gap-3">
            <h2 className="font-narrow text-xl font-bold tracking-wide text-white uppercase sm:text-2xl">
              {t(`perfil.${tipo}.miembros`)}
            </h2>
            {totalMiembros(colectivo) > destacados.length && (
              <span className="text-silver-400 text-xs">
                {t("memberCount", { count: totalMiembros(colectivo) })}
              </span>
            )}
          </div>

          {destacados.length === 0 ? (
            <p className="text-silver-500 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center text-sm">
              {t("noMembers")}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {destacados.map((m) => {
                const perfil = miembros.find((p) => p.slug === m.slug);
                return (
                  <Link
                    key={m.slug}
                    href={`/artistas/${m.slug}`}
                    className="group bg-ink-panel relative block aspect-[3/4] overflow-hidden rounded-2xl border border-white/[0.08]"
                  >
                    {perfil?.photoURL ? (
                      <Image
                        src={perfil.photoURL}
                        alt={perfil.artisticName}
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `linear-gradient(135deg, ${accent}44, #0a0712)`,
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black via-black/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <p className="font-narrow truncate text-lg font-bold text-white uppercase">
                        {perfil?.artisticName ?? m.slug}
                      </p>
                      {m.rol && (
                        <p
                          className="truncate text-[11px] font-semibold tracking-[2px] uppercase"
                          style={{ color: accent }}
                        >
                          {m.rol}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Lanzamientos / lo más sonado ───────────────────────────── */}
        {colectivo.lanzamientos && colectivo.lanzamientos.length > 0 && (
          <section className="pt-14">
            <h2 className="font-narrow mb-5 text-xl font-bold tracking-wide text-white uppercase sm:text-2xl">
              {t(`perfil.${tipo}.lanzamientos`)}
            </h2>
            <div className="flex flex-col gap-3">
              {colectivo.lanzamientos.map((l, i) => (
                <a
                  key={`${l.titulo}-${i}`}
                  href={l.url ?? undefined}
                  target={l.url ? "_blank" : undefined}
                  rel="noreferrer"
                  className="bg-ink-panel flex items-center gap-4 rounded-2xl border border-white/[0.08] p-3 transition hover:border-white/20"
                >
                  <span
                    className="grid size-12 shrink-0 place-items-center rounded-xl text-white"
                    style={{
                      background: `linear-gradient(135deg, ${accent}, ${accent}66)`,
                    }}
                  >
                    {l.url ? (
                      <PlayIcon className="size-5 translate-x-0.5" />
                    ) : (
                      <MusicIcon className="size-5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-white">
                      {l.titulo}
                    </span>
                    {(l.artista || l.anio) && (
                      <span className="text-silver-400 block truncate text-xs">
                        {[l.artista, l.anio].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Sobre nosotros ─────────────────────────────────────────── */}
        {colectivo.descripcion && (
          <section className="pt-14">
            <h2 className="font-narrow text-xl font-bold tracking-wide text-white uppercase sm:text-2xl">
              {t("about")}
            </h2>
            <p className="text-silver-200 mt-4 max-w-3xl text-base leading-relaxed sm:text-lg">
              {colectivo.descripcion}
            </p>
            {colectivo.generos && colectivo.generos.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2.5">
                {colectivo.generos.map((g) => (
                  <ProfileChip key={g} accent={accent} size="sm">
                    {g}
                  </ProfileChip>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </article>
  );
}
