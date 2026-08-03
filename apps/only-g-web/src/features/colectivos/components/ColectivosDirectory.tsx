"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import {
  COLECTIVO_DISCIPLINAS,
  COLECTIVO_TIPOS,
  filtrarColectivos,
  type Colectivo,
  type ColectivoDisciplina,
  type ColectivoTipoFiltro,
} from "@only-g/shared-types/colectivo";
import { listColectivos } from "../lib/colectivos-repo";
import {
  ActivityIcon,
  ArrowLeftIcon,
  CameraIcon,
  FlameIcon,
  GraduationCapIcon,
  LayoutGridIcon,
  MusicIcon,
  PlusIcon,
  SearchIcon,
  UsersRoundIcon,
  BuildingIcon,
} from "@/components/icons";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import { Skeleton } from "@/components/ui/Skeleton";
import { ColectivoCard } from "./ColectivoCard";

/**
 * Directorio de colectivos (§07, frame `nf2nq`).
 *
 * Dos ejes de filtro, como el directorio de artistas: TIPO (sello, movimiento,
 * agrupación, academia) y DISCIPLINA (música, modelaje, baile, academia). El
 * filtrado es en CLIENTE sobre la lista ya cargada — el directorio es pequeño y
 * así responde al instante, sin una consulta por cada clic.
 */

const TIPO_ICON = {
  todos: LayoutGridIcon,
  sello: BuildingIcon,
  movimiento: FlameIcon,
  agrupacion: UsersRoundIcon,
  academia: GraduationCapIcon,
} as const;

const DISCIPLINA_ICON = {
  musica: MusicIcon,
  modelaje: CameraIcon,
  baile: ActivityIcon,
  academia: GraduationCapIcon,
} as const;

export function ColectivosDirectory() {
  const t = useTranslations("colectivos");
  const reduce = useReducedMotion();
  const [todos, setTodos] = useState<Colectivo[] | null>(null);
  const [tipo, setTipo] = useState<ColectivoTipoFiltro>("todos");
  const [disciplina, setDisciplina] = useState<ColectivoDisciplina | null>(null);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    let vivo = true;
    listColectivos()
      .then((l) => vivo && setTodos(l))
      .catch(() => vivo && setTodos([]));
    return () => {
      vivo = false;
    };
  }, []);

  const lista = useMemo(
    () => filtrarColectivos(todos ?? [], { tipo, disciplina, texto }),
    [todos, tipo, disciplina, texto],
  );

  return (
    <main className="bg-ink relative min-h-dvh pb-24">
      {/* Tinte radial amatista de la cabecera (el del mockup). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(80% 100% at 20% 0%, #3b076466, #0c0a1200)",
        }}
      />

      <div className="relative mx-auto max-w-400 px-6 pt-8 sm:px-12">
        <Link
          href="/"
          className={`${glassSurfaceSoft} inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold tracking-[2px] text-white/90 uppercase transition hover:text-white`}
        >
          <GlassSheen />
          <ArrowLeftIcon className="relative size-4" />
          <span className="relative">{t("home")}</span>
        </Link>

        <header className="mt-12 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[560px]">
            <p className="text-amethyst-300 font-narrow text-xs font-semibold tracking-[5px] uppercase">
              {t("eyebrow")}
            </p>
            <h1 className="font-narrow mt-3 text-6xl leading-[0.9] font-bold text-white uppercase sm:text-8xl">
              {t("title")}
            </h1>
            <p className="text-silver-300 mt-4 text-base leading-relaxed sm:text-lg">
              {t("intro")}
            </p>
          </div>

          <Link
            href="/colectivos/nuevo"
            className="from-amethyst-400 to-amethyst-600 font-narrow inline-flex min-h-12 items-center gap-2 rounded-full bg-linear-to-b px-6 text-sm font-bold tracking-[2px] text-white uppercase shadow-[0_6px_22px_rgba(124,58,237,0.6)] transition hover:brightness-110"
          >
            <PlusIcon className="size-4" />
            {t("create")}
          </Link>
        </header>

        {/* Filtro por tipo */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <div
            className={`${glassSurfaceSoft} flex flex-wrap items-center gap-1 rounded-full p-1.5`}
            role="group"
            aria-label={t("filterType")}
          >
            <GlassSheen />
            {(["todos", ...COLECTIVO_TIPOS] as ColectivoTipoFiltro[]).map(
              (v) => {
                const Icon = TIPO_ICON[v];
                const on = tipo === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTipo(v)}
                    aria-pressed={on}
                    className={`font-narrow relative inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[13px] font-bold tracking-[1px] uppercase transition ${
                      on
                        ? "from-amethyst-400 to-amethyst-600 bg-linear-to-b text-white shadow-[0_4px_16px_rgba(124,58,237,0.5)]"
                        : "text-silver-300 hover:text-white"
                    }`}
                  >
                    <Icon className="size-4" />
                    {t(v === "todos" ? "tipo.todos" : `tipoPlural.${v}`)}
                  </button>
                );
              },
            )}
          </div>

          {/* Buscador */}
          <label
            className={`${glassSurfaceSoft} flex min-h-10 flex-1 items-center gap-2 rounded-full px-4 sm:max-w-xs`}
          >
            <GlassSheen />
            <SearchIcon className="text-silver-400 relative size-4 shrink-0" />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="text-silver-100 relative w-full bg-transparent text-sm outline-none placeholder:text-white/35"
            />
          </label>
        </div>

        {/* Filtro por disciplina */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <span className="font-narrow text-silver-500 text-[11px] font-semibold tracking-[2px] uppercase">
            {t("disciplineLabel")}
          </span>
          {COLECTIVO_DISCIPLINAS.map((d) => {
            const Icon = DISCIPLINA_ICON[d];
            const on = disciplina === d;
            return (
              <button
                key={d}
                type="button"
                // Volver a pulsar la activa la desmarca: es un filtro, no una
                // pestaña, y quedarse encerrado en una disciplina molesta.
                onClick={() => setDisciplina(on ? null : d)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
                  on
                    ? "border-amethyst-300/60 bg-amethyst-500/10 text-amethyst-100"
                    : "text-silver-200 border-white/15 hover:border-white/35"
                }`}
              >
                <Icon
                  className={`size-3.5 ${on ? "text-amethyst-300" : "text-silver-400"}`}
                />
                {t(`disciplina.${d}`)}
              </button>
            );
          })}
        </div>

        {/* Rejilla */}
        <div className="mt-8">
          {todos === null ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-56 w-full rounded-2xl" />
              ))}
            </div>
          ) : lista.length === 0 ? (
            <EmptyState hasFilters={tipo !== "todos" || !!disciplina || !!texto} />
          ) : (
            <motion.div
              layout={!reduce}
              className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {lista.map((c) => (
                  <motion.div
                    key={c.slug}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ColectivoCard colectivo={c} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </main>
  );
}

/** Vacío por filtros vs vacío de verdad: no es lo mismo y la salida es distinta. */
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const t = useTranslations("colectivos");
  return (
    <div className="rounded-2xl border border-dashed border-white/12 px-6 py-16 text-center">
      <p className="font-narrow text-xl font-bold text-white uppercase">
        {hasFilters ? t("emptyFiltered") : t("emptyTitle")}
      </p>
      <p className="text-silver-400 mx-auto mt-2 max-w-md text-sm leading-relaxed">
        {hasFilters ? t("emptyFilteredHint") : t("emptyHint")}
      </p>
      {!hasFilters && (
        <Link
          href="/colectivos/nuevo"
          className="from-amethyst-400 to-amethyst-600 font-narrow mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-linear-to-b px-6 text-sm font-bold tracking-[2px] text-white uppercase transition hover:brightness-110"
        >
          <PlusIcon className="size-4" />
          {t("create")}
        </Link>
      )}
    </div>
  );
}
