"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  METRICS_RANGES,
  deltaPct,
  flagEmoji,
  rank,
  series,
  type MetricsCounters,
  type MetricsDay,
  type MetricsRange,
  type MetricsVisibility,
} from "@only-g/shared-types/profile-metrics";
import { formatCompact } from "@only-g/shared-types/artist-profile";
import type { SocialPlatform } from "@only-g/shared-types/artist";
import { SOCIAL_META } from "../../lib/socials";
import {
  ArrowLeftIcon,
  CalendarIcon,
  EyeIcon,
  GlobeIcon,
  LockIcon,
  MusicIcon,
  PlayIcon,
  PointerClickIcon,
  ShareIcon,
} from "@/components/icons";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import {
  DailyBars,
  DeltaChip,
  MetricKpi,
  MetricPanel,
  RankedList,
} from "./MetricsPieces";

/**
 * El mapa carga aparte: son ~140 KB de geometría que no tiene sentido incluir en
 * el chunk del panel (los KPIs y las listas deben pintarse ya). `ssr: false`
 * porque mide el SVG contra el cursor, y en el servidor no hay ninguno.
 */
const WorldMap = dynamic(
  () => import("./WorldMap").then((m) => m.WorldMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

/** Datos que sirve `GET /api/metricas/[slug]`. */
export interface MetricsData {
  perfil: { slug: string; artisticName: string };
  rango: MetricsRange;
  visibility: MetricsVisibility;
  canManage: boolean;
  actual: MetricsCounters;
  previo: MetricsCounters;
  serie: MetricsDay[];
  totales: MetricsCounters;
}

/**
 * Panel de Métricas del perfil (§04, frame `ZEaMA`). Presentacional puro: recibe
 * los datos ya agregados por el servidor y solo los ordena y los pinta.
 *
 * El hueco del MAPA queda reservado con su estado; se rellena en su fase.
 */
export function MetricsPanel({
  data,
  onRangeChange,
  loading = false,
  accent = "#a78bfa",
  mapSlot,
  shareSlot,
}: {
  data: MetricsData;
  onRangeChange: (r: MetricsRange) => void;
  loading?: boolean;
  accent?: string;
  /** El mapa mundial (fase 3). Si no llega, la sección no se pinta. */
  mapSlot?: React.ReactNode;
  /** Controles de compartir (fase 4), solo para quien puede gestionar. */
  shareSlot?: React.ReactNode;
}) {
  const t = useTranslations("metrics");
  const locale = useLocale();
  const { actual, previo, serie } = data;

  // Nombres de país traducidos por el propio navegador: `Intl.DisplayNames` sabe
  // que CO es "Colombia" en español y "Colombia" en inglés, y que DE es
  // "Alemania"/"Germany". Nos ahorra mantener una tabla de 200 países × idioma.
  const countryName = useMemo(() => {
    try {
      const dn = new Intl.DisplayNames([locale], { type: "region" });
      return (iso: string) => dn.of(iso) ?? iso;
    } catch {
      return (iso: string) => iso;
    }
  }, [locale]);

  const kpis = useMemo(
    () => [
      {
        key: "visitas" as const,
        icon: <EyeIcon className="size-5" />,
        label: t("kpiVisits"),
      },
      {
        key: "plays" as const,
        icon: <PlayIcon className="size-5" />,
        label: t("kpiPlays"),
      },
      {
        key: "shares" as const,
        icon: <ShareIcon className="size-5" />,
        label: t("kpiShares"),
      },
      {
        key: "socialClicks" as const,
        icon: <PointerClickIcon className="size-5" />,
        label: t("kpiSocialClicks"),
      },
    ],
    [t],
  );

  const paises = rank(actual.porPais, 6);
  const redes = rank(actual.porRed, 5);
  const canciones = rank(actual.porCancion, 5);
  const canales = rank(actual.porCanal);

  return (
    <div className="bg-ink min-h-dvh pb-20">
      {/* ── Barra superior: volver, título, estado y rango ─────────────── */}
      <header className="bg-ink-soft sticky top-0 z-30 border-b border-white/[0.08] px-4 py-4 backdrop-blur sm:px-10">
        <div className="mx-auto flex max-w-400 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/artistas/${data.perfil.slug}`}
              aria-label={t("back")}
              title={t("back")}
              className={`${glassSurfaceSoft} flex size-11 shrink-0 items-center justify-center rounded-[13px] text-white/80 transition hover:text-white`}
            >
              <GlassSheen />
              <ArrowLeftIcon className="relative size-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-narrow truncate text-xl font-bold tracking-wide text-white uppercase sm:text-2xl">
                {t("title")}
              </h1>
              <p className="text-silver-400 truncate text-xs">
                {t("subtitle", { name: data.perfil.artisticName })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <VisibilityChip visibility={data.visibility} />
            {shareSlot}
            <RangePicker
              value={data.rango}
              onChange={onRangeChange}
              disabled={loading}
            />
          </div>
        </div>
      </header>

      <div
        className={`mx-auto flex max-w-400 flex-col gap-6 px-4 pt-6 sm:px-10 ${
          loading ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {/* ── KPIs ─────────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <MetricKpi
              key={k.key}
              icon={k.icon}
              label={k.label}
              value={actual[k.key] ?? 0}
              delta={deltaPct(actual[k.key] ?? 0, previo[k.key] ?? 0)}
              serie={series(serie, k.key).map((s) => s.value)}
            />
          ))}
        </div>

        {/* ── Geografía: mapa + top países ─────────────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <MetricPanel
            title={t("geoTitle")}
            subtitle={t("geoSubtitle", { days: data.rango })}
            aside={<HeatLegend />}
          >
            {mapSlot ?? <WorldMap porPais={actual.porPais} />}
          </MetricPanel>

          <MetricPanel title={t("topCountries")}>
            <RankedList
              entries={paises}
              accent={accent}
              showShare
              emptyText={t("emptyCountries")}
              renderLabel={(e) => (
                <>
                  <span className="text-lg leading-none" aria-hidden="true">
                    {flagEmoji(e.key) || "🏳️"}
                  </span>
                  <span className="truncate">{countryName(e.key)}</span>
                </>
              )}
            />
          </MetricPanel>
        </div>

        {/* ── Visitas en el tiempo + clics por red ──────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <MetricPanel
            title={t("visitsOverTime")}
            subtitle={t("visitsOverTimeSub", { days: data.rango })}
            aside={
              <div className="flex items-center gap-2">
                <span className="font-narrow text-2xl font-bold text-white">
                  {formatCompact(actual.visitas ?? 0)}
                </span>
                <DeltaChip
                  delta={deltaPct(actual.visitas ?? 0, previo.visitas ?? 0)}
                />
              </div>
            }
          >
            <DailyBars
              serie={series(serie, "visitas")}
              accent={accent}
              label={t("visitsChartAria", { days: data.rango })}
            />
          </MetricPanel>

          <MetricPanel title={t("clicksBySocial")}>
            <RankedList
              entries={redes}
              accent={accent}
              emptyText={t("emptySocial")}
              renderLabel={(e) => {
                const meta = SOCIAL_META[e.key as SocialPlatform];
                const Icon = meta?.Icon;
                return (
                  <>
                    {Icon ? (
                      <Icon className="size-4 shrink-0" />
                    ) : (
                      <PointerClickIcon className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{meta?.label ?? e.key}</span>
                  </>
                );
              }}
            />
          </MetricPanel>
        </div>

        {/* ── Canciones + compartidos ───────────────────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <MetricPanel
            title={t("topSongs")}
            subtitle={t("topSongsSub")}
          >
            <RankedList
              entries={canciones}
              accent={accent}
              emptyText={t("emptySongs")}
              renderLabel={(e, i) => (
                <>
                  <span className="font-narrow text-silver-500 w-4 shrink-0 text-sm font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <MusicIcon className="text-silver-500 size-3.5 shrink-0" />
                  <span className="truncate">{e.key}</span>
                </>
              )}
            />
          </MetricPanel>

          <MetricPanel title={t("sharesTitle")}>
            <div className="flex items-end gap-2.5">
              <span className="font-narrow text-4xl font-bold text-white">
                {formatCompact(actual.shares ?? 0)}
              </span>
              <DeltaChip
                delta={deltaPct(actual.shares ?? 0, previo.shares ?? 0)}
              />
            </div>
            <p className="text-silver-400 mt-2 text-xs leading-relaxed">
              {t("sharesHint")}
            </p>
            <div className="my-4 h-px bg-white/[0.08]" />
            <RankedList
              entries={canales}
              accent={accent}
              emptyText={t("emptyShares")}
              renderLabel={(e) => (
                <span className="truncate">{t(`channel.${e.key}`)}</span>
              )}
            />
          </MetricPanel>
        </div>

        {/* Histórico: contexto de que el panel mide un periodo, no la vida entera. */}
        <p className="text-silver-500 text-center text-xs">
          {t("allTime", {
            visits: formatCompact(data.totales.visitas ?? 0),
            plays: formatCompact(data.totales.plays ?? 0),
          })}
        </p>
      </div>
    </div>
  );
}

/** Chip de estado: quién puede ver estas métricas ahora mismo. */
function VisibilityChip({ visibility }: { visibility: MetricsVisibility }) {
  const t = useTranslations("metrics");
  if (visibility === "publico") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-500/10 px-3.5 py-2 text-[11px] font-semibold tracking-[1px] text-emerald-200 uppercase">
        <GlobeIcon className="size-3.5" />
        {t("visibilityPublic")}
      </span>
    );
  }
  if (visibility === "enlace") {
    return (
      <span className="border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11px] font-semibold tracking-[1px] uppercase">
        <ShareIcon className="size-3.5" />
        {t("visibilityLink")}
      </span>
    );
  }
  return (
    <span className="border-amethyst-300/40 bg-amethyst-500/10 text-amethyst-200 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11px] font-semibold tracking-[1px] uppercase">
      <LockIcon className="size-3.5" />
      {t("visibilityPrivate")}
    </span>
  );
}

/** Selector de rango (7 / 30 / 90 días). */
function RangePicker({
  value,
  onChange,
  disabled,
}: {
  value: MetricsRange;
  onChange: (r: MetricsRange) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("metrics");
  return (
    <div
      className={`${glassSurfaceSoft} flex items-center gap-1 rounded-full p-1`}
      role="group"
      aria-label={t("rangeLabel")}
    >
      <GlassSheen />
      <CalendarIcon className="text-silver-300 relative ml-2 size-4 shrink-0" />
      {METRICS_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          disabled={disabled}
          aria-pressed={value === r}
          className={`relative min-h-9 rounded-full px-3 text-xs font-semibold transition disabled:opacity-50 ${
            value === r
              ? "bg-white/20 text-white"
              : "text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          {t("rangeDays", { days: r })}
        </button>
      ))}
    </div>
  );
}

/** Leyenda del mapa de calor: menos → más visitas. */
function HeatLegend() {
  const t = useTranslations("metrics");
  return (
    <div className="flex items-center gap-2">
      <span className="text-silver-500 text-[11px]">{t("legendLess")}</span>
      <span
        className="h-2 w-20 rounded-full"
        style={{
          background: "linear-gradient(90deg, #3b0764, #c4a5ff)",
        }}
        aria-hidden="true"
      />
      <span className="text-silver-500 text-[11px]">{t("legendMore")}</span>
    </div>
  );
}

/** Marcador de posición mientras el chunk del mapa termina de bajar. */
function MapSkeleton() {
  return (
    <div className="bg-ink-soft flex aspect-[900/460] w-full animate-pulse items-center justify-center rounded-xl border border-white/[0.06]">
      <GlobeIcon className="text-silver-500 size-10 opacity-30" />
    </div>
  );
}
