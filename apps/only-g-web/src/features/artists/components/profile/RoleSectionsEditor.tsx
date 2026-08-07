"use client";

import { useTranslations } from "next-intl";
import {
  CATEGORIAS_MODELO,
  FICHA_TECNICA_CAMPOS,
  GENEROS_BAILE,
  MAX_MARCAS,
  MAX_RECONOCIMIENTOS,
  MAX_TRAYECTORIA,
  categoriaColor,
  type FichaTecnica,
  type Reconocimiento,
  type TrayectoriaItem,
} from "@only-g/shared-types/profile-role-data";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { GlassButton } from "@/components/ui/GlassButton";
import { ProfileChip } from "./ProfileChip";

/**
 * Editores de las secciones que desbloquean las etiquetas (§05). Piezas sueltas
 * que el `ProfileBuilder` monta solo cuando la sección está desbloqueada Y
 * encendida — no tiene sentido pedirle la ficha técnica a un beatmaker.
 */

/**
 * Vestido de los campos de estos editores. SIN ancho a propósito: lo pone cada
 * sitio.
 *
 * Llevaba `w-full` dentro, y el campo del año lo pisaba con `w-24`. Dos
 * utilidades de `width` en el mismo elemento no se resuelven por el orden en que
 * las escribes, sino por el orden en que Tailwind las emite — así que cuál ganaba
 * era una moneda al aire. Cuando ganaba `w-full`, el año (que además es
 * `shrink-0`) se comía la fila entera y los campos de texto de al lado quedaban
 * aplastados a nada: parecía que el hito solo dejaba escribir el año.
 */
const INPUT =
  "rounded-lg bg-white/[0.02] px-3 py-2 text-sm text-silver-50 outline-none ring-1 ring-inset ring-white/15 transition focus:bg-white/[0.06] focus:ring-amethyst-300/70 placeholder:text-white/25";

/** Ficha técnica: seis campos de texto libre (ver `profile-role-data`). */
export function FichaTecnicaEditor({
  value,
  onChange,
}: {
  value: FichaTecnica | undefined;
  onChange: (next: FichaTecnica) => void;
}) {
  const t = useTranslations("roleSections");
  const ficha = value ?? {};
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {FICHA_TECNICA_CAMPOS.map((campo) => (
        <label key={campo} className="block">
          <span className="font-narrow text-silver-400 mb-1.5 block text-[10px] font-semibold tracking-[2px] uppercase">
            {t(`ficha.${campo}`)}
          </span>
          <input
            value={ficha[campo] ?? ""}
            onChange={(e) => onChange({ ...ficha, [campo]: e.target.value })}
            placeholder={t(`fichaPlaceholder.${campo}`)}
            className={`${INPUT} w-full`}
          />
        </label>
      ))}
    </div>
  );
}

/**
 * Lista de chips con sugerencias + entrada libre. La comparten categorías de
 * modelo y géneros de baile: misma mecánica, distinta paleta.
 */
export function ChipListEditor({
  value,
  onChange,
  sugerencias,
  max,
  placeholder,
  colorDe,
  accent,
}: {
  value: string[] | undefined;
  onChange: (next: string[]) => void;
  sugerencias: string[];
  max: number;
  placeholder: string;
  /** Color por chip (categorías) o uno fijo (géneros de baile). */
  colorDe?: (v: string) => string;
  accent?: string;
}) {
  const t = useTranslations("roleSections");
  const lista = value ?? [];
  const libres = sugerencias.filter((s) => !lista.includes(s));

  function add(v: string) {
    const limpio = v.trim();
    if (!limpio || lista.includes(limpio) || lista.length >= max) return;
    onChange([...lista, limpio]);
  }

  return (
    <div>
      {lista.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2.5">
          {lista.map((v) => (
            <ProfileChip
              key={v}
              accent={colorDe ? colorDe(v) : accent}
              onRemove={() => onChange(lista.filter((x) => x !== v))}
              removeLabel={t("remove", { value: v })}
            >
              {v}
            </ProfileChip>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder={placeholder}
        disabled={lista.length >= max}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          add(e.currentTarget.value);
          e.currentTarget.value = "";
        }}
        className={`${INPUT} w-full max-w-xs disabled:opacity-40`}
      />

      {libres.length > 0 && lista.length < max && (
        <div className="mt-3">
          <span className="font-narrow text-silver-500 text-[10px] font-semibold tracking-[2px] uppercase">
            {t("suggestions")}
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {libres.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => add(s)}
                className="text-silver-300 inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/20 px-3 py-1.5 text-xs transition hover:border-white/45 hover:text-white"
              >
                <PlusIcon className="size-3" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Lista de hitos (reconocimientos / trayectoria): año, título y detalle. */
export function HitosEditor({
  value,
  onChange,
  max,
  addLabel,
}: {
  value: (Reconocimiento | TrayectoriaItem)[] | undefined;
  onChange: (next: (Reconocimiento | TrayectoriaItem)[]) => void;
  max: number;
  addLabel: string;
}) {
  const t = useTranslations("roleSections");
  const lista = value ?? [];

  function set(i: number, patch: Partial<Reconocimiento>) {
    onChange(lista.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  return (
    <div className="flex flex-col gap-3">
      {lista.map((it, i) => (
        <div
          key={i}
          className="bg-ink-panel rounded-xl border border-white/[0.08] p-3"
        >
          <div className="flex items-start gap-2">
            <input
              value={it.anio ?? ""}
              onChange={(e) => set(i, { anio: e.target.value })}
              placeholder={t("hito.anio")}
              aria-label={t("hito.anio")}
              className={`${INPUT} w-24 shrink-0 text-center tabular-nums`}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {/* `?? ""` no es adorno: sin él, un hito guardado sin `titulo`
                  monta el input como NO controlado y al escribir React lo pasa a
                  controlado — el salto se ve como que el campo no acepta texto. */}
              <input
                value={it.titulo ?? ""}
                onChange={(e) => set(i, { titulo: e.target.value })}
                placeholder={t("hito.titulo")}
                aria-label={t("hito.titulo")}
                className={`${INPUT} w-full`}
              />
              <input
                value={it.detalle ?? ""}
                onChange={(e) => set(i, { detalle: e.target.value })}
                placeholder={t("hito.detalle")}
                aria-label={t("hito.detalle")}
                className={`${INPUT} w-full`}
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(lista.filter((_, idx) => idx !== i))}
              aria-label={t("hito.remove")}
              className="text-silver-400 flex size-9 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 hover:text-white"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        </div>
      ))}

      {lista.length === 0 && (
        <p className="text-silver-500 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm">
          {t("hito.empty")}
        </p>
      )}

      {lista.length < max && (
        <GlassButton onClick={() => onChange([...lista, { titulo: "" }])}>
          <PlusIcon className="size-4" />
          {addLabel}
        </GlassButton>
      )}
    </div>
  );
}

/** Marcas: solo nombres, en chips de texto. */
export function MarcasEditor({
  value,
  onChange,
}: {
  value: string[] | undefined;
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("roleSections");
  return (
    <ChipListEditor
      value={value}
      onChange={onChange}
      sugerencias={[]}
      max={MAX_MARCAS}
      placeholder={t("marcasPlaceholder")}
      accent="#e9e9f0"
    />
  );
}

/** Reexports con los topes ya aplicados, para que el builder no los repita. */
export const LIMITES = {
  reconocimientos: MAX_RECONOCIMIENTOS,
  trayectoria: MAX_TRAYECTORIA,
  marcas: MAX_MARCAS,
};

export { CATEGORIAS_MODELO, GENEROS_BAILE, categoriaColor };
