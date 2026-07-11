"use client";

const fmt = new Intl.NumberFormat("es-CO");

/**
 * Input de dinero en pesos colombianos: mientras escribes muestra el monto
 * agrupado con separador de miles (p. ej. `15.000`) y entrega al padre el valor
 * CRUDO en dígitos (`"15000"`), de modo que `Number(value)` sigue funcionando sin
 * cambios. COP no usa centavos, así que opera en pesos enteros (solo dígitos).
 */
export function MoneyInput({
  value,
  onChange,
  className,
  placeholder,
  id,
  disabled,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const display = value ? fmt.format(Number(value)) : "";
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      id={id}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      className={className}
    />
  );
}
