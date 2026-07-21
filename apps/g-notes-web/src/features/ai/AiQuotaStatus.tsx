"use client";

import { useEffect, useState } from "react";
import { getQuota, subscribeQuota, type QuotaState } from "./quota";

const ONLY_G_URL =
  process.env.NEXT_PUBLIC_ONLY_G_URL ??
  "https://only-g-music--only-g-music-745ca.us-east4.hosted.app";

/**
 * Estado del cupo de IA freemium dentro del editor:
 *  - al TOPAR → empujón a la membresía (enlaza a la cuenta de Only G, donde se
 *    suscribe y activa "IA sin límite");
 *  - cuando quedan POCAS → un contador sutil "✦ N de IA hoy";
 *  - si sobra cupo o es miembro (sin límite) → no muestra nada.
 * Se alimenta del store `quota`, que actualiza cada respuesta de IA.
 */
export function AiQuotaStatus({ className = "" }: { className?: string }) {
  const [q, setQ] = useState<QuotaState>(getQuota());
  useEffect(() => subscribeQuota(setQ), []);

  if (q.limited) {
    return (
      <a
        href={`${ONLY_G_URL}/cuenta#gnotes-premium`}
        target="_blank"
        rel="noreferrer"
        className={`border-amethyst-400/40 bg-amethyst-500/15 text-amethyst-100 hover:bg-amethyst-500/25 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap transition ${className}`}
      >
        ✦ Límite diario de IA · Suscríbete
      </a>
    );
  }
  if (q.remaining != null && q.remaining <= 10) {
    return (
      <span
        className={`text-silver-500 tabular-nums whitespace-nowrap ${className}`}
        title="Sugerencias de IA gratis que te quedan hoy"
      >
        ✦ {q.remaining} de IA hoy
      </span>
    );
  }
  return null;
}
