"use client";

import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import type { Role } from "@only-g/shared-types/user";
import {
  groupSections,
  isSectionOn,
  type SectionId,
  type SectionPrefs,
} from "@only-g/shared-types/profile-sections";
import {
  AwardIcon,
  ChartBarIcon,
  DiscIcon,
  FilmIcon,
  GripVerticalIcon,
  ImageIcon,
  LayoutGridIcon,
  LockIcon,
  MicIcon,
  MusicIcon,
  PlayIcon,
  PlusIcon,
  RouteIcon,
  RulerIcon,
  ShareIcon,
  ShoppingBagIcon,
  TagIcon,
  UserRoundIcon,
  UsersIcon,
  ActivityIcon,
} from "@/components/icons";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import { ProfileChip } from "./ProfileChip";

/**
 * Gestor de Secciones del editor (§05, frame `Bmgbf`).
 *
 * El perfil no se elige por rol, se COMPONE: cada etiqueta de talento desbloquea
 * sus secciones y el artista decide cuáles enseña. Así un cantante que además
 * modela tiene reproductor Y ficha técnica, en vez de tener que elegir una de
 * dos plantillas.
 *
 * Las bloqueadas se muestran igualmente, apagadas y con el nombre de la etiqueta
 * que las abre: enseñar lo que existe es mejor que esconderlo, porque explica
 * qué gana el artista si añade esa etiqueta.
 */

const SECTION_ICON: Record<SectionId, typeof UserRoundIcon> = {
  sobreMi: UserRoundIcon,
  galeria: ImageIcon,
  redes: ShareIcon,
  metricas: ChartBarIcon,
  mediaDestacada: FilmIcon,
  relacionados: UsersIcon,
  reproductor: PlayIcon,
  canciones: MusicIcon,
  generosMusicales: DiscIcon,
  portafolio: LayoutGridIcon,
  fichaTecnica: RulerIcon,
  reconocimientos: AwardIcon,
  tiendaBeats: ShoppingBagIcon,
  generosBaile: ActivityIcon,
  trayectoria: RouteIcon,
  reelPresentaciones: MicIcon,
};

export function SectionManager({
  disciplines,
  prefs,
  onChange,
  onManageArtes,
}: {
  disciplines: Role[] | undefined;
  prefs: SectionPrefs | undefined;
  onChange: (next: SectionPrefs) => void;
  /**
   * Ir a "Perfiles y convenios" a activar artes. Se omite CUANDO YA ESTÁS ahí
   * (el gestor se reusa en esa ventana): sin esta prop no se pinta ni el chip
   * `+` ni el botón de las bloqueadas, que llevarían a la página actual.
   */
  onManageArtes?: () => void;
}) {
  const t = useTranslations();
  const { base, unlocked, locked } = groupSections(disciplines);

  function toggle(id: SectionId, value: boolean) {
    onChange({ ...(prefs ?? {}), [id]: value });
  }

  return (
    <div className="flex flex-col gap-7">
      {/* ── Tus etiquetas ────────────────────────────────────────────── */}
      <div className={`${glassSurfaceSoft} rounded-[18px] p-5`}>
        <GlassSheen />
        <div className="relative">
          <h3 className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
            {t("sections.tagsTitle")}
          </h3>
          <p className="text-silver-400 mt-0.5 text-xs">
            {t("sections.tagsHint")}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {(disciplines ?? []).map((r) => (
              <ProfileChip key={r} icon={<TagIcon className="size-3.5" />}>
                {t(`roles.${r}`)}
              </ProfileChip>
            ))}
            {(disciplines ?? []).length === 0 && (
              <p className="text-silver-500 text-xs">
                {t("sections.tagsEmpty")}
              </p>
            )}
            {/* Chip "+": la salida desde el editor hacia donde SÍ se cambian las
                artes. Va junto a las etiquetas y no en un menú porque es ahí
                donde el artista se pregunta "¿y si además hago otra cosa?". */}
            {onManageArtes && (
              <button
                type="button"
                onClick={onManageArtes}
                title={t("sections.addTag")}
                className="text-amethyst-200 border-amethyst-300/40 hover:bg-amethyst-500/15 hover:border-amethyst-300/70 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed px-3.5 text-xs font-semibold transition"
              >
                <PlusIcon className="size-3.5" />
                {t("sections.addTag")}
              </button>
            )}
          </div>
        </div>
      </div>

      <SectionGroup
        title={t("sections.groupBase")}
        subtitle={t("sections.groupBaseHint")}
      >
        {base.map((def) => (
          <SectionRow
            key={def.id}
            id={def.id}
            label={t(`sections.item.${def.id}`)}
            caption={t("sections.baseCaption")}
            on={isSectionOn(def.id, prefs, disciplines)}
            onToggle={(v) => toggle(def.id, v)}
          />
        ))}
      </SectionGroup>

      {unlocked.length > 0 && (
        <SectionGroup
          title={t("sections.groupUnlocked")}
          subtitle={t("sections.groupUnlockedHint")}
        >
          {unlocked.map((def) => (
            <SectionRow
              key={def.id}
              id={def.id}
              label={t(`sections.item.${def.id}`)}
              tag={t(`roles.${def.unlockedBy[0]}`)}
              on={isSectionOn(def.id, prefs, disciplines)}
              onToggle={(v) => toggle(def.id, v)}
            />
          ))}
        </SectionGroup>
      )}

      {locked.length > 0 && (
        <SectionGroup
          title={t("sections.groupLocked")}
          subtitle={t("sections.groupLockedHint")}
        >
          {locked.map(({ def, requires }) => (
            <LockedRow
              key={def.id}
              id={def.id}
              label={t(`sections.item.${def.id}`)}
              requires={t(`roles.${requires}`)}
              onRequest={onManageArtes}
            />
          ))}
        </SectionGroup>
      )}
    </div>
  );
}

function SectionGroup({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-2.5 px-1">
        <span className="font-narrow text-silver-400 text-xs font-semibold tracking-[2px] uppercase">
          {title}
        </span>
        <span className="text-silver-500 text-xs">{subtitle}</span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

/** Fila de una sección disponible: icono, nombre, y su interruptor. */
function SectionRow({
  id,
  label,
  caption,
  tag,
  on,
  onToggle,
}: {
  id: SectionId;
  label: string;
  caption?: string;
  tag?: string;
  on: boolean;
  onToggle: (value: boolean) => void;
}) {
  const Icon = SECTION_ICON[id];
  return (
    <div className="bg-ink-panel flex items-center gap-4 rounded-xl border border-white/[0.08] px-5 py-3.5">
      {/* El asa de reordenar es decorativa por ahora: el orden se guarda
          (`sectionOrder`), pero arrastrar llega con el resto del gestor. */}
      <GripVerticalIcon
        className="text-silver-500 size-4 shrink-0 opacity-50"
        aria-hidden="true"
      />
      <span className="border-amethyst-300/25 bg-amethyst-500/10 text-amethyst-300 grid size-10 shrink-0 place-items-center rounded-[11px] border">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-narrow block truncate text-base font-bold tracking-wide text-white">
          {label}
        </span>
        {tag ? (
          <span className="border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200 mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold">
            <TagIcon className="size-2.5" />
            {tag}
          </span>
        ) : (
          <span className="text-silver-500 mt-0.5 block text-xs">
            {caption}
          </span>
        )}
      </span>
      <Toggle checked={on} onChange={onToggle} label={label} />
    </div>
  );
}

/** Fila de una sección que aún no está disponible. */
function LockedRow({
  id,
  label,
  requires,
  onRequest,
}: {
  id: SectionId;
  label: string;
  requires: string;
  onRequest?: () => void;
}) {
  const t = useTranslations("sections");
  const Icon = SECTION_ICON[id];
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-5 py-3.5">
      <LockIcon
        className="text-silver-500 size-4 shrink-0"
        aria-hidden="true"
      />
      <span className="text-silver-500 grid size-10 shrink-0 place-items-center rounded-[11px] border border-white/[0.08] bg-white/[0.03]">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-narrow text-silver-400 block truncate text-base font-bold tracking-wide">
          {label}
        </span>
        <span className="text-silver-500 mt-0.5 block text-xs">
          {t("requiresTag", { tag: requires })}
        </span>
      </span>
      {onRequest && (
        <button
          type="button"
          onClick={onRequest}
          className="text-silver-300 shrink-0 rounded-full border border-white/15 px-3.5 py-2 text-[10px] font-bold tracking-[1px] uppercase transition hover:border-white/35 hover:text-white"
        >
          {t("requestTag")}
        </button>
      )}
    </div>
  );
}

/** Interruptor del design system (el del mockup: píldora amatista). */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6.5 w-11.5 shrink-0 rounded-full transition-colors ${
        checked ? "bg-amethyst-500" : "bg-[#39344a]"
      }`}
    >
      <motion.span
        className="bg-silver-50 absolute top-[3px] size-5 rounded-full shadow"
        animate={{ left: checked ? 22 : 4 }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: "spring", stiffness: 500, damping: 32 }
        }
      />
    </button>
  );
}
