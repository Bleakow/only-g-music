"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

// Versión con la que se compiló ESTA pestaña (horneada en el bundle). Se compara
// con la desplegada (`/api/version`); si difieren, hay un deploy nuevo.
const MY_VERSION = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
const POLL_MS = 5 * 60 * 1000; // cada 5 min

/**
 * Detecta que se desplegó una versión nueva mientras la pestaña seguía abierta
 * (típico en móvil: la dejas abierta días) y ofrece recargar. Sondea al volver
 * a la pestaña (`visibilitychange`/`focus`) y cada 5 min. NO recarga solo — el
 * usuario decide, para no interrumpir lo que esté haciendo.
 */
export function VersionWatcher() {
  const t = useTranslations();
  const [stale, setStale] = useState(false);

  useEffect(() => {
    // En dev (sin build id real) no hay nada que vigilar; HMR ya actualiza.
    if (!MY_VERSION || MY_VERSION === "dev") return;
    let cancelled = false;

    async function check() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (!cancelled && version && version !== MY_VERSION) setStale(true);
      } catch {
        /* sin red: se reintenta en el próximo tick */
      }
    }

    check();
    const id = setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  if (!stale) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3 rounded-full border border-amethyst-300/40 bg-neutral-950/95 px-4 py-2.5 text-sm text-white shadow-2xl backdrop-blur">
        <span>{t("common.newVersion")}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-amethyst rounded-full px-4 py-1.5 text-xs font-semibold tracking-[1px] uppercase"
        >
          {t("common.reload")}
        </button>
      </div>
    </div>
  );
}
