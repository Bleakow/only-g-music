"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * Selector de idioma. Cambia el locale conservando la ruta actual (next-intl
 * reescribe el prefijo `/es` ↔ `/en`). `usePathname` (de i18n) devuelve la ruta
 * SIN prefijo, así que `router.replace(pathname, { locale })` mantiene la página.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => router.replace(pathname, { locale: l })}
          aria-pressed={l === locale}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[2px] transition ${
            l === locale
              ? "bg-white/15 text-white"
              : "text-white/50 hover:text-white"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
