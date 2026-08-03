"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import {
  inicialesColectivo,
  totalMiembros,
  type Colectivo,
} from "@only-g/shared-types/colectivo";
import { ArrowRightIcon, UsersIcon } from "@/components/icons";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";

/**
 * Tarjeta del directorio de colectivos (§07): portada con el tipo, logo,
 * nombre, disciplina y cuántos son.
 *
 * El LOGO cae a las iniciales sobre un degradado del color del colectivo cuando
 * no hay imagen — un colectivo recién creado se ve intencionado, no roto.
 */
export function ColectivoCard({ colectivo }: { colectivo: Colectivo }) {
  const t = useTranslations("colectivos");
  const reduce = useReducedMotion();
  const miembros = totalMiembros(colectivo);
  const accent = colectivo.accent;

  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <Link
        href={`/colectivos/${colectivo.slug}`}
        className="bg-ink-panel group block overflow-hidden rounded-2xl border border-white/[0.08] transition hover:border-white/20"
      >
        {/* Portada */}
        <div className="relative h-30 overflow-hidden bg-neutral-950">
          {colectivo.coverURL ? (
            <Image
              src={colectivo.coverURL}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${accent}55, #0a0712)`,
              }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-[70px] bg-linear-to-b from-transparent to-[#1a1626]" />
          <span
            className="absolute top-3.5 left-3.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[1px] text-white uppercase backdrop-blur"
            style={{
              backgroundColor: `${accent}33`,
              boxShadow: `inset 0 0 0 1px ${accent}8c`,
            }}
          >
            {t(`tipo.${colectivo.tipo}`)}
          </span>
        </div>

        {/* Cuerpo */}
        <div className="flex flex-col gap-3 px-4.5 py-4">
          <div className="flex items-center gap-3">
            <span
              className="font-narrow grid size-12 shrink-0 place-items-center rounded-xl text-lg font-bold text-white"
              style={{
                background: `linear-gradient(315deg, ${accent}, #1a1626)`,
                boxShadow: `inset 0 0 0 1px ${accent}8c`,
              }}
              aria-hidden="true"
            >
              {colectivo.logoURL ? (
                <Image
                  src={colectivo.logoURL}
                  alt=""
                  width={48}
                  height={48}
                  className="size-full rounded-xl object-cover"
                />
              ) : (
                inicialesColectivo(colectivo.nombre)
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-narrow block truncate text-lg font-bold tracking-wide text-white">
                {colectivo.nombre}
              </span>
              <span
                className="block text-[11px] font-semibold tracking-[2px] uppercase"
                style={{ color: accent }}
              >
                {t(`disciplina.${colectivo.disciplina}`)}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-silver-300 flex items-center gap-1.5 text-[13px] font-semibold">
              <UsersIcon className="text-silver-400 size-4" />
              {t("memberCount", { count: miembros })}
            </span>
            <span
              className={`${glassSurfaceSoft} inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-[1px] text-white uppercase`}
            >
              <GlassSheen />
              <span className="relative">{t("view")}</span>
              <ArrowRightIcon className="relative size-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
