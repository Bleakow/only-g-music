import type { ReactNode } from "react";
import { IntroInfo } from "@/components/ui/IntroInfo";

/**
 * Piezas compartidas del panel admin para vestir CADA pestaña con el mismo
 * lenguaje (glass líquido + cabecera) sin reescribir la página entera.
 *
 * - `adminCard`: contenedor translúcido grande (deja ver la imagen de fondo del
 *   shell a través del cristal). Añádele tu padding (p. ej. `p-5`).
 * - `adminInner`: backing oscuro y frosteado para las OPCIONES internas (filas,
 *   tiles, campos) → el texto se lee bien sobre la imagen.
 * - `<AdminPageHeader>`: cabecera consistente (eyebrow + título + subtítulo),
 *   con el padding superior que deja hueco al topbar (volver + campanita/avatar).
 */
export const adminCard =
  "relative overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-inset ring-white/12 shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur-sm";

export const adminInner =
  "bg-black/25 ring-1 ring-inset ring-white/12 backdrop-blur-md";

/**
 * Campos de formulario/modal del admin (una sola fuente, para que todos los
 * modales se vean idénticos). `adminInput` = input/select/textarea; `adminLabel`
 * = etiqueta pequeña sobre el campo.
 */
export const adminInput =
  "w-full rounded-lg bg-white/[0.06] px-3.5 py-2.5 text-white outline-none ring-1 ring-inset ring-white/20 transition focus:ring-white/50 placeholder:text-white/40";

export const adminLabel =
  "text-silver-400 mb-1 block text-xs tracking-wide uppercase";

export function AdminPageHeader({
  eyebrow,
  title,
  subtitle,
  info,
  infoKey,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Ayuda de la pantalla: se muestra tras un botón «(i)» + modal de primera
   *  visita (en vez de un párrafo siempre visible que estorba). */
  info?: ReactNode;
  /** Clave estable para recordar la primera visita — pásala si usas `info`. */
  infoKey?: string;
  children?: ReactNode;
}) {
  return (
    <header className="px-6 pt-20 pb-8 sm:px-10 sm:pt-24">
      {eyebrow && (
        <p className="text-amethyst-300 text-xs font-semibold tracking-[4px] uppercase">
          {eyebrow}
        </p>
      )}
      <div className="mt-2 flex items-start gap-3">
        <h1 className="font-narrow text-4xl leading-[0.95] font-bold uppercase drop-shadow-[0_2px_16px_rgba(0,0,0,0.75)] sm:text-5xl">
          {title}
        </h1>
        {info != null && (
          <IntroInfo title={title} storageKey={infoKey ?? title}>
            {info}
          </IntroInfo>
        )}
      </div>
      {subtitle && (
        <p className="text-silver-200 mt-3 max-w-xl text-sm drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)] sm:text-base">
          {subtitle}
        </p>
      )}
      {children}
    </header>
  );
}
