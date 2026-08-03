"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { MetricsVisibility } from "@only-g/shared-types/profile-metrics";
import { auth } from "@/lib/firebase";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import {
  CheckIcon,
  CopyIcon,
  GlobeIcon,
  LockIcon,
  RepeatIcon,
  ShareIcon,
  SpinnerIcon,
} from "@/components/icons";

/**
 * Control de quién ve las métricas (§04). Tres estados excluyentes, explicados
 * con lo que IMPLICAN y no con jerga de permisos: el artista no debería tener
 * que deducir qué significa "visibilidad restringida".
 */

const OPTIONS: {
  value: MetricsVisibility;
  icon: typeof LockIcon;
}[] = [
  { value: "privado", icon: LockIcon },
  { value: "enlace", icon: ShareIcon },
  { value: "publico", icon: GlobeIcon },
];

export function ShareMetrics({
  slug,
  initialVisibility,
}: {
  slug: string;
  initialVisibility: MetricsVisibility;
}) {
  const t = useTranslations("metrics.share");
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] =
    useState<MetricsVisibility>(initialVisibility);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  const url =
    typeof window !== "undefined" && token
      ? `${window.location.origin}/artistas/${slug}/metricas?k=${token}`
      : "";

  async function authHeaders(): Promise<HeadersInit> {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    return {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    };
  }

  // Al abrir, pregunta el estado real: el token no viaja con el resto del panel.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/metricas/${slug}/compartir`, {
          headers: await authHeaders(),
          cache: "no-store",
        });
        if (!res.ok || !alive) return;
        const data = await res.json();
        setVisibility(data.visibility);
        setToken(data.token ?? null);
      } catch {
        /* el panel sigue usable con el estado que ya tenía */
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, slug]);

  async function apply(next: MetricsVisibility, rotate = false) {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/metricas/${slug}/compartir`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ visibility: next, rotate }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      setVisibility(data.visibility);
      setToken(data.token ?? null);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* sin clipboard: el input es seleccionable a mano */
    }
  }

  return (
    <>
      <GlassButton
        onClick={() => setOpen(true)}
        className="!px-3 sm:!px-4"
        title={t("open")}
        ariaLabel={t("open")}
      >
        <ShareIcon className="size-4" />
        <span className="hidden sm:inline">{t("button")}</span>
      </GlassButton>

      <GlassModal
        open={open}
        onClose={() => setOpen(false)}
        title={t("title")}
      >
        <p className="text-silver-300 text-sm leading-relaxed">
          {t("intro")}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {OPTIONS.map(({ value, icon: Icon }) => {
            const on = visibility === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => !on && apply(value)}
                disabled={busy}
                aria-pressed={on}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition disabled:opacity-60 ${
                  on
                    ? "border-amethyst-300/50 bg-amethyst-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <Icon
                  className={`mt-0.5 size-5 shrink-0 ${
                    on ? "text-amethyst-300" : "text-silver-400"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">
                    {t(`option.${value}.title`)}
                  </span>
                  <span className="text-silver-400 mt-0.5 block text-xs leading-relaxed">
                    {t(`option.${value}.body`)}
                  </span>
                </span>
                {on && (
                  <CheckIcon className="text-amethyst-300 mt-0.5 size-4 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* El enlace, solo cuando hay enlace que dar. */}
        {visibility === "enlace" && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <span className="mb-2 block text-[10px] font-semibold tracking-[2px] text-white/50 uppercase">
              {t("linkLabel")}
            </span>
            {url ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={t("linkLabel")}
                    className="text-silver-100 min-w-0 flex-1 rounded-lg bg-black/40 px-3 py-2 text-xs ring-1 ring-inset ring-white/15 outline-none"
                  />
                  <GlassButton onClick={copy} className="!px-3">
                    {copied ? (
                      <CheckIcon className="size-4 text-emerald-300" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                    {copied ? t("copied") : t("copy")}
                  </GlassButton>
                </div>
                <button
                  type="button"
                  onClick={() => apply("enlace", true)}
                  disabled={busy}
                  className="text-silver-400 mt-3 inline-flex items-center gap-1.5 text-xs transition hover:text-white disabled:opacity-50"
                >
                  {busy ? (
                    <SpinnerIcon className="size-3.5 animate-spin" />
                  ) : (
                    <RepeatIcon className="size-3.5" />
                  )}
                  {t("rotate")}
                </button>
                <p className="text-silver-500 mt-1.5 text-[11px] leading-relaxed">
                  {t("rotateHint")}
                </p>
              </>
            ) : (
              <p className="text-silver-500 text-xs">{t("linkPending")}</p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {t("error")}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <GlassButton
            onClick={() => setOpen(false)}
            className="!text-amethyst-200"
          >
            {t("done")}
          </GlassButton>
        </div>
      </GlassModal>
    </>
  );
}
