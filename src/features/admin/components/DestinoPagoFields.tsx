"use client";

import { useTranslations } from "next-intl";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import type { DestinoPago } from "@/domain/payment-destination";

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  const base =
    "mt-1 w-full rounded-lg bg-white/[0.06] px-3 py-2 text-white outline-none ring-1 ring-inset ring-white/20 transition focus:ring-white/50 placeholder:text-white/35";
  return (
    <label className="block">
      <span className="text-silver-300 text-xs font-semibold tracking-[1px] uppercase">
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${base} resize-y`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={base}
        />
      )}
    </label>
  );
}

/**
 * Sub-formulario de un DestinoPago (Nequi/PayPal/correo/nota/QR). Controlado:
 * emite parches vía `onChange`. Compartido por el config global de pagos
 * (AdminConfigPagos) y el override por sede (AdminEstudios). Reusa las claves
 * i18n de `adminConfigPagos.*`.
 */
export function DestinoPagoFields({
  value,
  onChange,
  onError,
}: {
  value: DestinoPago;
  onChange: (patch: Partial<DestinoPago>) => void;
  onError?: (msg: string) => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-4">
      <Field
        label={t("adminConfigPagos.nequi")}
        value={value.telefono ?? ""}
        onChange={(v) => onChange({ telefono: v })}
        placeholder="3001234567"
      />
      <Field
        label={t("adminConfigPagos.paypal")}
        value={value.paypal ?? ""}
        onChange={(v) => onChange({ paypal: v })}
        placeholder="usuario / correo"
      />
      <Field
        label={t("adminConfigPagos.correo")}
        value={value.correo ?? ""}
        onChange={(v) => onChange({ correo: v })}
        placeholder="pagos@ejemplo.com"
      />
      <Field
        label={t("adminConfigPagos.nota")}
        value={value.nota ?? ""}
        onChange={(v) => onChange({ nota: v })}
        placeholder={t("adminConfigPagos.notaPh")}
        textarea
      />
      <div>
        <p className="text-silver-300 text-xs font-semibold tracking-[1px] uppercase">
          {t("adminConfigPagos.qr")}
        </p>
        <div className="mt-1 max-w-[12rem]">
          <PhotoUpload
            value={value.qrUrl ?? ""}
            onChange={(url) => onChange({ qrUrl: url || undefined })}
            emptyLabel={t("adminConfigPagos.qrUpload")}
            aspect="aspect-square"
            onError={onError}
          />
        </div>
      </div>
    </div>
  );
}
