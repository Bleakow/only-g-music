"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import type { ArtistProfile } from "@only-g/shared-types/artist-profile";
import {
  FICHA_TECNICA_CAMPOS,
  categoriaColor,
  fichaTieneDatos,
} from "@only-g/shared-types/profile-role-data";
import { AwardIcon, RouteIcon } from "@/components/icons";
import { ProfileChip } from "./ProfileChip";

/**
 * Secciones del perfil que desbloquean las ETIQUETAS de talento (§05):
 * ficha técnica y categorías de modelo, géneros de baile, trayectoria,
 * reconocimientos y marcas.
 *
 * Cada una se pinta SOLO si tiene datos: una sección vacía en un perfil público
 * se lee como descuido, no como "todavía no lo he rellenado". El interruptor del
 * gestor decide si la sección está permitida; esto decide si hay algo que enseñar.
 */

/** Ficha técnica de modelo: medidas y rasgos, en una tarjeta de datos. */
export function FichaTecnicaSection({ profile }: { profile: ArtistProfile }) {
  const t = useTranslations("roleSections");
  const ficha = profile.fichaTecnica;
  if (!fichaTieneDatos(ficha)) return null;

  const campos = FICHA_TECNICA_CAMPOS.filter((c) => (ficha?.[c] ?? "").trim());

  return (
    <section className="mx-auto max-w-400 px-6 pt-16">
      <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        {t("fichaTecnica")}
      </h2>
      <div className="bg-ink-panel mt-5 flex flex-wrap justify-between gap-x-10 gap-y-6 rounded-[18px] border border-white/[0.08] px-8 py-7">
        {campos.map((c) => (
          <div key={c}>
            <p className="font-narrow text-silver-400 text-[11px] font-semibold tracking-[2px] uppercase">
              {t(`ficha.${c}`)}
            </p>
            <p className="font-narrow mt-1.5 text-2xl font-bold text-white">
              {ficha![c]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Categorías de trabajo (Pasarela, Editorial…), cada una con su color. */
export function CategoriasSection({ profile }: { profile: ArtistProfile }) {
  const t = useTranslations("roleSections");
  const lista = (profile.categorias ?? []).filter((c) => c.trim());
  if (lista.length === 0) return null;

  return (
    <section className="mx-auto max-w-400 px-6 pt-16">
      <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        {t("categorias")}
      </h2>
      <div className="mt-5 flex flex-wrap gap-3">
        {lista.map((c) => (
          <ProfileChip key={c} accent={categoriaColor(c)}>
            {c}
          </ProfileChip>
        ))}
      </div>
    </section>
  );
}

/** Géneros de baile — etiqueta Bailarín. */
export function GenerosBaileSection({ profile }: { profile: ArtistProfile }) {
  const t = useTranslations("roleSections");
  const lista = (profile.generosBaile ?? []).filter((g) => g.trim());
  if (lista.length === 0) return null;

  return (
    <section className="mx-auto max-w-400 px-6 pt-16">
      <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        {t("generosBaile")}
      </h2>
      <div className="mt-5 flex flex-wrap gap-2.5">
        {lista.map((g) => (
          <ProfileChip key={g} accent={profile.accent}>
            {g}
          </ProfileChip>
        ))}
      </div>
    </section>
  );
}

/** Reconocimientos y trayectoria comparten forma: año + título + detalle. */
function ListaHitos({
  titulo,
  items,
  accent,
  icono,
}: {
  titulo: string;
  items: { titulo: string; detalle?: string; anio?: string }[];
  accent: string;
  icono: "premio" | "hito";
}) {
  const reduce = useReducedMotion();
  const Icon = icono === "premio" ? AwardIcon : RouteIcon;
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-400 px-6 pt-16">
      <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        {titulo}
      </h2>
      <ul className="mt-5 flex flex-col gap-2.5">
        {items.map((it, i) => (
          <motion.li
            key={`${it.titulo}-${i}`}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.3) }}
            className="bg-ink-panel flex items-center gap-4 rounded-xl border border-white/[0.07] px-5 py-4"
          >
            {it.anio && (
              <span
                className="font-narrow shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums"
                style={{
                  backgroundColor: `${accent}1a`,
                  color: accent,
                  boxShadow: `inset 0 0 0 1px ${accent}40`,
                }}
              >
                {it.anio}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="font-narrow block truncate text-base font-bold tracking-wide text-white">
                {it.titulo}
              </span>
              {it.detalle && (
                <span className="text-silver-400 block truncate text-xs">
                  {it.detalle}
                </span>
              )}
            </span>
            <Icon className="size-5 shrink-0" style={{ color: accent }} />
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

export function ReconocimientosSection({
  profile,
}: {
  profile: ArtistProfile;
}) {
  const t = useTranslations("roleSections");
  return (
    <ListaHitos
      titulo={t("reconocimientos")}
      items={(profile.reconocimientos ?? []).filter((r) => r.titulo?.trim())}
      accent={profile.accent}
      icono="premio"
    />
  );
}

export function TrayectoriaSection({ profile }: { profile: ArtistProfile }) {
  const t = useTranslations("roleSections");
  return (
    <ListaHitos
      titulo={t("trayectoria")}
      items={(profile.trayectoria ?? []).filter((r) => r.titulo?.trim())}
      accent={profile.accent}
      icono="hito"
    />
  );
}

/** Marcas con las que ha trabajado: solo nombres, como logotipos de texto. */
export function MarcasSection({ profile }: { profile: ArtistProfile }) {
  const t = useTranslations("roleSections");
  const lista = (profile.marcas ?? []).filter((m) => m.trim());
  if (lista.length === 0) return null;

  return (
    <section className="mx-auto max-w-400 px-6 pt-16">
      <h2 className="font-narrow text-2xl font-bold tracking-wide text-white uppercase sm:text-3xl">
        {t("marcas")}
      </h2>
      <div className="mt-5 flex flex-wrap gap-3">
        {lista.map((m) => (
          <span
            key={m}
            className="font-narrow text-silver-200 rounded-xl border border-white/15 bg-white/[0.03] px-6 py-3.5 text-base font-bold tracking-[2px] uppercase"
          >
            {m}
          </span>
        ))}
      </div>
    </section>
  );
}
