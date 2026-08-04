"use client";

import { PagarButton } from "@/features/payments/components/PagarButton";
import { usePrecios } from "@/features/pricing/components/PreciosProvider";

/**
 * Botón "Activar membresía" autocontenido: cobra el perfil premium por pasarela
 * y, cuando el webhook confirma, la Cloud Function activa el premium.
 * Reutilizable allá donde haga falta ofrecer la activación (editor, vista
 * pública, gate de compartir) sin duplicar el cableado del pago.
 */
export function MembershipPayButton({
  uid,
  slug,
  label,
  className,
}: {
  uid: string;
  slug: string;
  label: string;
  className?: string;
}) {
  const { precioPerfil } = usePrecios();

  return (
    <PagarButton
      uid={uid}
      concepto="premium"
      pagoRef={{ kind: "premium", id: slug }}
      monto={precioPerfil}
      label={label}
      conceptoLabel={label}
      className={className}
    />
  );
}
