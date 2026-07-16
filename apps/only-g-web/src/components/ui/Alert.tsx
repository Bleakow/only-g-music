import type { ReactNode } from "react";

export type AlertTone = "error" | "success" | "warning" | "info";

/**
 * Nota/alerta con color semántico, sobre los tokens de estado de `globals.css`
 * (`--color-success/warning/danger/info`). Reemplaza las cajas de mensaje con
 * colores hardcodeados sueltos (rojo/verde/ámbar) por una sola fuente.
 * `error` se anuncia a lectores de pantalla vía `role="alert"`.
 */
const TONE: Record<AlertTone, string> = {
  error: "border-danger/30 bg-danger/10 text-danger",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  info: "border-info/30 bg-info/10 text-info",
};

export function Alert({
  tone = "error",
  children,
  className = "",
}: {
  tone?: AlertTone;
  children: ReactNode;
  /** Márgenes u otras utilidades del contexto (p. ej. `mb-6`). */
  className?: string;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={`rounded-lg border px-3 py-2 text-sm ${TONE[tone]} ${className}`.trimEnd()}
    >
      {children}
    </p>
  );
}
