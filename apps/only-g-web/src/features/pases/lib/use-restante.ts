"use client";

import { useTranslations } from "next-intl";
import { restanteDe } from "@only-g/shared-types/vigencia";

/**
 * Devuelve el formateador de "lo que te queda": `1 mes 12 días`.
 *
 * Vive en un hook y no en el dominio porque el reparto meses/días es lógica pura
 * (`restanteDe`, ya testeada) pero el TEXTO es idioma: los plurales de "mes/meses"
 * y "día/días" los resuelve next-intl. Se comparte entre el panel del admin y
 * "Mis cosas" para que ambos digan exactamente lo mismo.
 */
export function useRestanteLabel() {
  const t = useTranslations();

  return (expiresAt: number | null | undefined, now = Date.now()): string => {
    const r = restanteDe(expiresAt, now);
    if (!r.activo) return t("vigencia.caducado");
    const partes: string[] = [];
    if (r.meses > 0) partes.push(t("vigencia.meses", { n: r.meses }));
    if (r.dias > 0) partes.push(t("vigencia.dias", { n: r.dias }));
    return partes.length > 0 ? partes.join(" ") : t("vigencia.hoy");
  };
}
