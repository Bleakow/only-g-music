"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { EditIcon, SpinnerIcon } from "@/components/icons";
import type { Sede, SedeId } from "@/domain/sede";
import type { DestinoPago } from "@/domain/payment-destination";
import {
  getAllSedes,
  setSedeOverride,
  type SedeOverride,
} from "@/features/sedes/lib/sedes-repo";
import { DestinoPagoFields } from "./DestinoPagoFields";
import { SedeProductores } from "./SedeProductores";

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-silver-300 text-xs font-semibold tracking-[1px] uppercase">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg bg-white/[0.06] px-3 py-2 text-white outline-none ring-1 ring-inset ring-white/20 transition focus:ring-white/50 placeholder:text-white/35"
      />
    </label>
  );
}

/**
 * Gestión de SEDES/estudios (SOLO admin). Edita el override de las sedes de la
 * semilla (ciudad, dirección, horario, destino de pago propio). Preserva los IDs
 * (barranquilla/bogota) → no afecta reservas/disponibilidad existentes. Crear
 * sedes nuevas y asignar productores llegan con la migración completa / E3.
 */
export function AdminEstudios() {
  const t = useTranslations();
  const [items, setItems] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editId, setEditId] = useState<SedeId | null>(null);
  const [form, setForm] = useState<SedeOverride>({});
  const [saving, setSaving] = useState(false);

  function cargar() {
    return getAllSedes()
      .then(setItems)
      .catch((e) => {
        console.error("[admin-estudios] load:", e);
        setError(t("adminEstudios.errorLoad"));
      });
  }

  useEffect(() => {
    let active = true;
    getAllSedes()
      .then((list) => {
        if (!active) return;
        setItems(list);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[admin-estudios] load:", e);
        setError(t("adminEstudios.errorLoad"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  function abrirEditar(s: Sede) {
    setEditId(s.id);
    setForm({
      ciudad: s.ciudad,
      direccion: s.direccion,
      horario: s.horario,
      pago: s.pago,
    });
    setError(null);
  }

  function patch(p: Partial<SedeOverride>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function patchPago(p: Partial<DestinoPago>) {
    setForm((prev) => ({ ...prev, pago: { ...prev.pago, ...p } }));
  }

  async function guardar() {
    if (!editId) return;
    setSaving(true);
    setError(null);
    try {
      const p = form.pago ?? {};
      const pago: DestinoPago = {
        telefono: p.telefono?.trim() || undefined,
        paypal: p.paypal?.trim() || undefined,
        correo: p.correo?.trim() || undefined,
        qrUrl: p.qrUrl || undefined,
        nota: p.nota?.trim() || undefined,
      };
      await setSedeOverride(editId, {
        ciudad: form.ciudad?.trim() || undefined,
        direccion: form.direccion?.trim() || undefined,
        horario: form.horario?.trim() || undefined,
        pago: Object.values(pago).some(Boolean) ? pago : undefined,
      });
      await cargar();
      setEditId(null);
    } catch (e) {
      console.error("[admin-estudios] save:", e);
      setError(t("adminEstudios.errorSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 pt-28 pb-24 sm:px-12">
      <Link
        href="/admin"
        className="text-silver-300 text-sm underline-offset-4 hover:text-white hover:underline"
      >
        {t("adminEstudios.backToAdmin")}
      </Link>

      <h1 className="font-narrow mt-4 text-5xl font-bold uppercase sm:text-6xl">
        {t("adminEstudios.title")}
      </h1>
      <p className="text-silver-300 mt-2 max-w-xl">
        {t("adminEstudios.intro")}
      </p>

      {error && !editId && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-silver-300 mt-10">{t("common.loading")}</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {items.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-white">{s.nombre}</p>
                <p className="text-silver-400 truncate text-sm">
                  {s.ciudad} · {s.direccion}
                </p>
                <p className="text-silver-500 text-xs">
                  {s.pago
                    ? t("adminEstudios.pagoPropio")
                    : t("adminEstudios.pagoDefault")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => abrirEditar(s)}
                aria-label={t("adminEstudios.edit")}
                title={t("adminEstudios.edit")}
                className="text-silver-200 flex size-9 shrink-0 items-center justify-center rounded-lg transition hover:bg-white/10 hover:text-white"
              >
                <EditIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <GlassModal
        open={!!editId}
        onClose={() => !saving && setEditId(null)}
        title={t("adminEstudios.editTitle")}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Field
            label={t("adminEstudios.ciudad")}
            value={form.ciudad ?? ""}
            onChange={(v) => patch({ ciudad: v })}
          />
          <Field
            label={t("adminEstudios.direccion")}
            value={form.direccion ?? ""}
            onChange={(v) => patch({ direccion: v })}
          />
          <Field
            label={t("adminEstudios.horario")}
            value={form.horario ?? ""}
            onChange={(v) => patch({ horario: v })}
          />

          <div className="border-t border-white/10 pt-4">
            <p className="text-amethyst-200 text-xs font-semibold tracking-[1px] uppercase">
              {t("adminEstudios.pagoTitle")}
            </p>
            <p className="text-silver-400 mt-0.5 mb-3 text-[11px]">
              {t("adminEstudios.pagoHint")}
            </p>
            <DestinoPagoFields
              value={form.pago ?? {}}
              onChange={patchPago}
              onError={setError}
            />
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-amethyst-200 text-xs font-semibold tracking-[1px] uppercase">
              {t("adminEstudios.productoresTitle")}
            </p>
            <p className="text-silver-400 mt-0.5 mb-3 text-[11px]">
              {t("adminEstudios.productoresHint")}
            </p>
            {editId && <SedeProductores sedeId={editId} />}
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <GlassButton onClick={() => setEditId(null)} disabled={saving}>
            {t("adminEstudios.cancel")}
          </GlassButton>
          <GlassButton
            onClick={guardar}
            disabled={saving}
            className="!text-amethyst-200"
          >
            {saving && <SpinnerIcon className="size-4 animate-spin" />}
            {t("adminEstudios.save")}
          </GlassButton>
        </div>
      </GlassModal>
    </main>
  );
}
