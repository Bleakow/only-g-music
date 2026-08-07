"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon } from "@/components/icons";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";

/**
 * La puerta al BOOK (§10), sobre la galería del perfil.
 *
 * Es una TARJETA ancha y no un botón: lo que hay al otro lado es una pieza a
 * pantalla completa, y un botón del tamaño de un enlace no promete eso. Aquí la
 * portada del book aparece desenfocada de fondo, así que desde el propio perfil
 * ya se lee que detrás hay otro mundo.
 *
 * NO toca la galería. La galería sigue siendo la galería; esto va encima.
 *
 * Solo aparece con el book PUBLICADO. Un portafolio a medio montar enseñado al
 * mundo es peor que ningún portafolio, y por eso la condición no es "existe el
 * documento" sino la bandera que la dueña enciende a propósito.
 */
export function BookEntryCard({ profile }: { profile: ArtistProfile }) {
  const t = useTranslations("book");
  if (!profile.bookPublicado) return null;

  return (
    <div className="mx-auto max-w-400 px-6 pt-16">
      <Link
        href={`/artistas/${profile.slug}/book`}
        className="group relative flex min-h-40 items-end overflow-hidden rounded-3xl border border-white/10 transition hover:border-white/30 sm:min-h-52"
      >
        {profile.bookPortada && (
          <>
            <Image
              src={profile.bookPortada}
              alt=""
              fill
              // Es un fondo desenfocado: no hace falta traer la foto a resolución
              // completa para difuminarla después.
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="scale-110 object-cover blur-md brightness-[0.45] transition duration-700 group-hover:scale-105 group-hover:brightness-[0.55]"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background: `linear-gradient(105deg, ${profile.accent}55, transparent 62%)`,
              }}
            />
          </>
        )}

        <div className="relative flex w-full flex-wrap items-end gap-4 p-6 sm:p-8">
          <div className="min-w-0">
            <p className="font-narrow text-4xl leading-none font-bold tracking-[0.06em] text-white uppercase sm:text-6xl">
              {t("entryTitle")}
            </p>
            <p className="text-silver-300 mt-2 text-sm">{t("entryHint")}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {typeof profile.bookPiezas === "number" && profile.bookPiezas > 0 && (
              <span className="text-silver-300 text-xs tracking-[2px] uppercase">
                {t("entryCount", { count: profile.bookPiezas })}
              </span>
            )}
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-black transition group-hover:translate-x-1"
              style={{ background: profile.accent }}
            >
              <ArrowRightIcon className="size-5" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
