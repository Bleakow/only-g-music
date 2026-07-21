"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { EditIcon, PlusIcon, SpinnerIcon } from "@/components/icons";
import type { Sede, SedeId } from "@only-g/shared-types/sede";
import type { DestinoPago } from "@only-g/shared-types/payment-destination";
import { toSlug } from "@only-g/shared-types/artist-profile";
import {
  getAllSedes,
  setSedeOverride,
  createSede,
  type SedeOverride,
} from "@/features/sedes/lib/sedes-repo";
import { DestinoPagoFields } from "./DestinoPagoFields";
import { SedeProductores } from "./SedeProductores";
import { AdminPageHeader, adminCard } from "./admin-ui";
import { Skeleton } from "@/components/ui/Skeleton";

/** Slots por defecto para una sede nueva (mismo set que la semilla). */
const SLOTS_DEFECTO = ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

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
        className="mt-1 w-full rounded-lg bg-white/[0.06] px-3 py-2 text-white ring-1 ring-white/20 transition outline-none ring-inset placeholder:text-white/35 focus:ring-white/50"
      />
    </label>
  );
}

/**
 * Gestión de SEDES/estudios (SOLO admin). Edita el override de las sedes de la
 * semilla (ciudad, dirección, horario, destino de pago propio) y permite CREAR
 * sedes nuevas: el id se deriva como slug del nombre y el doc se persiste
 * completo en Firestore (`sedes/{id}`, ver `createSede`). Preserva los IDs de
 * la semilla (barranquilla/bogota) → no afecta reservas/disponibilidad
 * existentes.
 */
export function AdminEstudios() {
  const t = useTranslations();
  const [items, setItems] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editId, setEditId] = useState<SedeId | null>(null);
  const [form, setForm] = useState<SedeOverride>({});
  const [saving, setSaving] = useState(false);

  const [showCrear, setShowCrear] = useState(false);
  const [crearForm, setCrearForm] = useState({
    nombre: "",
    ciudad: "",
    direccion: "",
    horario: "",
  });
  const [crearBusy, setCrearBusy] = useState(false);
  const [crearError, setCrearError] = useState<string | null>(null);

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
        llaveBreB: p.llaveBreB?.trim() || undefined,
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

  function abrirCrear() {
    setCrearForm({ nombre: "", ciudad: "", direccion: "", horario: "" });
    setCrearError(null);
    setShowCrear(true);
  }

  async function crearSedeNueva() {
    const nombre = crearForm.nombre.trim();
    if (!nombre || crearBusy) return;
    setCrearBusy(true);
    setCrearError(null);
    try {
      const id = toSlug(nombre);
      if (!id) throw new Error("slug vacío");
      const nueva: Sede = {
        id,
        nombre,
        ciudad: crearForm.ciudad.trim(),
        direccion: crearForm.direccion.trim(),
        horario: crearForm.horario.trim(),
        slots: SLOTS_DEFECTO,
        productores: [],
      };
      await createSede(nueva);
      await cargar();
      setShowCrear(false);
      abrirEditar(nueva);
    } catch (e) {
      console.error("[admin-estudios] crear:", e);
      setCrearError(t("adminEstudios.crearError"));
    } finally {
      setCrearBusy(false);
    }
  }

  return (
    <main className="pb-24">
      <AdminPageHeader
        eyebrow={t("adminDashboard.eyebrow")}
        title={t("adminEstudios.title")}
        subtitle={t("adminEstudios.intro")}
      />

      <div className="px-6 sm:px-10">
        <div className="flex justify-end">
          <GlassButton onClick={abrirCrear} className="!text-amethyst-200">
            <PlusIcon className="size-4" />
            {t("adminEstudios.crear")}
          </GlassButton>
        </div>

        {error && !editId && !showCrear && (
          <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {loading ? (
          <ul className="mt-8 flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className={`${adminCard} flex items-center justify-between gap-3 p-4`}
              >
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-56" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </div>
                <Skeleton className="size-9 shrink-0" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-8 flex flex-col gap-3">
            {items.map((s) => (
              <li
                key={s.id}
                className={`${adminCard} flex items-center justify-between gap-3 p-4`}
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
      </div>

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

      <GlassModal
        open={showCrear}
        onClose={() => !crearBusy && setShowCrear(false)}
        title={t("adminEstudios.crearTitle")}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Field
            label={t("adminEstudios.nombre")}
            value={crearForm.nombre}
            onChange={(v) => setCrearForm((f) => ({ ...f, nombre: v }))}
          />
          <Field
            label={t("adminEstudios.ciudad")}
            value={crearForm.ciudad}
            onChange={(v) => setCrearForm((f) => ({ ...f, ciudad: v }))}
          />
          <Field
            label={t("adminEstudios.direccion")}
            value={crearForm.direccion}
            onChange={(v) => setCrearForm((f) => ({ ...f, direccion: v }))}
          />
          <Field
            label={t("adminEstudios.horario")}
            value={crearForm.horario}
            onChange={(v) => setCrearForm((f) => ({ ...f, horario: v }))}
          />

          {crearError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {crearError}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <GlassButton onClick={() => setShowCrear(false)} disabled={crearBusy}>
            {t("adminEstudios.cancel")}
          </GlassButton>
          <GlassButton
            onClick={crearSedeNueva}
            disabled={crearBusy || !crearForm.nombre.trim()}
            className="!text-amethyst-200"
          >
            {crearBusy && <SpinnerIcon className="size-4 animate-spin" />}
            {t("adminEstudios.crear")}
          </GlassButton>
        </div>
      </GlassModal>
    </main>
  );
}
