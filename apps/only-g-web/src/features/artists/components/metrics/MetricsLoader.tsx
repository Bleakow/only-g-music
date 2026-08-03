"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DEFAULT_METRICS_RANGE,
  type MetricsRange,
} from "@only-g/shared-types/profile-metrics";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { GlassButton } from "@/components/ui/GlassButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { ArrowLeftIcon, LockIcon } from "@/components/icons";
import { MetricsPanel, type MetricsData } from "./MetricsPanel";
import { ShareMetrics } from "./ShareMetrics";

/**
 * Carga las métricas y monta el panel. Toda la decisión de permisos vive en el
 * servidor (`checkMetricsAccess`): aquí solo se manda el ID token si hay sesión
 * y se traduce un 403 en una pantalla honesta de "esto es privado".
 */
export function MetricsLoader({
  slug,
  token,
  accent,
}: {
  slug: string;
  /** Token del enlace compartido (`?k=`), si se llegó por ahí. */
  token?: string;
  accent?: string;
}) {
  const t = useTranslations("metrics");
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<MetricsData | null>(null);
  const [rango, setRango] = useState<MetricsRange>(DEFAULT_METRICS_RANGE);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">(
    "loading",
  );
  // Recarga de rango: mantiene el panel visible y solo lo atenúa.
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (r: MetricsRange, isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      try {
        const idToken = await auth.currentUser?.getIdToken().catch(() => null);
        const qs = new URLSearchParams({ rango: String(r) });
        if (token) qs.set("k", token);
        const res = await fetch(
          `/api/metricas/${encodeURIComponent(slug)}?${qs}`,
          {
            headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
            cache: "no-store",
          },
        );
        if (res.status === 403) {
          setState("denied");
          return;
        }
        if (!res.ok) {
          setState("error");
          return;
        }
        setData((await res.json()) as MetricsData);
        setState("ok");
      } catch {
        setState("error");
      } finally {
        setRefreshing(false);
      }
    },
    [slug, token],
  );

  // Espera a que la sesión esté resuelta: sin ese guard, el primer fetch saldría
  // sin token y el dueño vería un "privado" que desaparece medio segundo después.
  useEffect(() => {
    if (authLoading) return;
    void load(rango, false);
    // `rango` se recarga en su propio handler para poder atenuar en vez de vaciar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.uid, load]);

  function changeRange(r: MetricsRange) {
    setRango(r);
    void load(r, true);
  }

  if (state === "loading") return <MetricsSkeleton />;

  if (state === "denied") {
    return (
      <Gate
        icon={<LockIcon className="size-7" />}
        title={t("deniedTitle")}
        body={t("deniedBody")}
        slug={slug}
      />
    );
  }

  if (state === "error" || !data) {
    return (
      <Gate
        title={t("errorTitle")}
        body={t("errorBody")}
        slug={slug}
        onRetry={() => {
          setState("loading");
          void load(rango, false);
        }}
      />
    );
  }

  return (
    <MetricsPanel
      data={data}
      onRangeChange={changeRange}
      loading={refreshing}
      accent={accent}
      // Los controles de compartir solo existen para quien puede gestionarlos:
      // quien llega por un enlace compartido ve las métricas, no las reconfigura.
      shareSlot={
        data.canManage ? (
          <ShareMetrics slug={slug} initialVisibility={data.visibility} />
        ) : undefined
      }
    />
  );
}

/** Pantalla de corte: sin permiso o sin datos. Siempre con salida al perfil. */
function Gate({
  icon,
  title,
  body,
  slug,
  onRetry,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  slug: string;
  onRetry?: () => void;
}) {
  const t = useTranslations("metrics");
  return (
    <main className="bg-ink grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        {icon && (
          <span className="text-amethyst-300 mb-4 inline-flex">{icon}</span>
        )}
        <h1 className="font-narrow text-3xl font-bold text-white uppercase">
          {title}
        </h1>
        <p className="text-silver-300 mt-3 text-sm leading-relaxed">{body}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <GlassButton href={`/artistas/${slug}`}>
            <ArrowLeftIcon className="size-4" />
            {t("backToProfile")}
          </GlassButton>
          {onRetry && (
            <GlassButton onClick={onRetry} className="!text-amethyst-200">
              {t("retry")}
            </GlassButton>
          )}
        </div>
      </div>
    </main>
  );
}

function MetricsSkeleton() {
  return (
    <div className="bg-ink min-h-dvh px-4 pt-6 sm:px-10">
      <div className="mx-auto max-w-400">
        <Skeleton className="h-12 w-72" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-[18px]" />
          ))}
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
          <Skeleton className="h-[480px] w-full rounded-[18px]" />
          <Skeleton className="h-[480px] w-full rounded-[18px]" />
        </div>
      </div>
    </div>
  );
}
