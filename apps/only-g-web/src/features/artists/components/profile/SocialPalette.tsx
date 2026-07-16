"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@only-g/shared-types/artist";
import { SOCIAL_META } from "../../lib/socials";
import { PlusIcon, CloseIcon } from "@/components/icons";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import { GlassButton } from "@/components/ui/GlassButton";

// Input translúcido (casi transparente) con borde cristalino; texto legible.
const INPUT =
  "w-full rounded-lg bg-white/[0.02] px-3 py-2 text-sm text-silver-50 outline-none ring-1 ring-inset ring-white/15 backdrop-blur-md transition focus:bg-white/[0.06] focus:ring-amethyst-300/70 placeholder:text-white/30";

/**
 * Editor de redes "click para añadir": muestra las redes ya agregadas (icono
 * circular + su link) y un botón `+` que despliega una paleta con los iconos de
 * las redes que faltan. Más dinámico que una lista fija de inputs.
 */
export function SocialPalette({
  value,
  onChange,
}: {
  value: Partial<Record<SocialPlatform, string>>;
  onChange: (next: Partial<Record<SocialPlatform, string>>) => void;
}) {
  const t = useTranslations("profileBuilder.socials");
  const [open, setOpen] = useState(false);
  const added = SOCIAL_PLATFORMS.filter((p) => p in value);
  const available = SOCIAL_PLATFORMS.filter((p) => !(p in value));

  function add(p: SocialPlatform) {
    onChange({ ...value, [p]: "" });
    setOpen(false);
  }
  function remove(p: SocialPlatform) {
    const next = { ...value };
    delete next[p];
    onChange(next);
  }
  function setUrl(p: SocialPlatform, url: string) {
    onChange({ ...value, [p]: url });
  }

  return (
    <div className="flex flex-col gap-3">
      {added.map((p) => {
        const { label, Icon } = SOCIAL_META[p];
        return (
          <div key={p} className="flex items-center gap-2">
            <span
              className={`${glassSurfaceSoft} flex size-10 shrink-0 items-center justify-center rounded-full text-white/80`}
            >
              <GlassSheen />
              <Icon className="relative size-5" />
            </span>
            <input
              value={value[p] ?? ""}
              onChange={(e) => setUrl(p, e.target.value)}
              placeholder={t("linkPlaceholder", { label })}
              className={INPUT}
            />
            <button
              type="button"
              onClick={() => remove(p)}
              aria-label={t("remove", { label })}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-silver-400 transition hover:bg-white/10 hover:text-white"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        );
      })}

      {available.length > 0 && (
        <div>
          <GlassButton onClick={() => setOpen((v) => !v)}>
            <PlusIcon className="size-4" /> {t("add")}
          </GlassButton>
          {open && (
            <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {available.map((p) => {
                const { label, Icon } = SOCIAL_META[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => add(p)}
                    aria-label={label}
                    title={label}
                    className={`${glassSurfaceSoft} flex size-11 items-center justify-center rounded-full text-white/80 transition hover:scale-105 hover:text-white`}
                  >
                    <GlassSheen />
                    <Icon className="relative size-5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
