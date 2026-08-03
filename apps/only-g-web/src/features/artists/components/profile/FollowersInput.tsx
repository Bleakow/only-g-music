"use client";

import { useRef } from "react";
import { useLocale } from "next-intl";

/**
 * Campo de nº de seguidores: se escribe de izquierda a derecha y los separadores
 * de miles aparecen SOLOS mientras tecleas (1234567 → 1.234.567).
 *
 * El detalle fino: al reformatear en cada tecla, el navegador manda el cursor al
 * final. Para que se pueda editar en medio del número, contamos cuántos DÍGITOS
 * había a la izquierda del cursor y lo devolvemos a esa misma posición lógica
 * después de formatear — los puntos que se insertan no cuentan.
 */
export function FollowersInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = "",
}: {
  /** Nº actual, o `undefined` si el campo está vacío. */
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const locale = useLocale();
  const ref = useRef<HTMLInputElement>(null);
  const format = (n: number) => new Intl.NumberFormat(locale).format(n);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;
    // Dígitos a la izquierda del cursor: es la posición que hay que conservar.
    const digitsBefore = raw.slice(0, caret).replace(/\D/g, "").length;

    const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (!digits) {
      onChange(undefined);
      return;
    }
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return; // números absurdos: se ignoran
    onChange(n);

    // Recolocar el cursor tras el mismo nº de dígitos, ya con los puntos puestos.
    const formatted = format(n);
    let pos = 0;
    let seen = 0;
    while (pos < formatted.length && seen < digitsBefore) {
      if (/\d/.test(formatted[pos])) seen++;
      pos++;
    }
    requestAnimationFrame(() => {
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value != null ? format(value) : ""}
      onChange={handleChange}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
