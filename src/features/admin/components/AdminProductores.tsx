"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import { LocationPicker } from "@/features/location/components/LocationPicker";
import {
  ArrowLeftIcon,
  EditIcon,
  TrashIcon,
  PlusIcon,
  SpinnerIcon,
  ImageIcon,
} from "@/components/icons";
import {
  type Producer,
  type EditableProducer,
  emptyProducer,
} from "@/domain/producer";
import { formatLocation } from "@/domain/location";
import {
  listProducers,
  createProducer,
  updateProducer,
  deleteProducer,
  setOrden,
} from "@/features/producers/lib/producers-repo";

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
          rows={5}
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
 * Gestión de PRODUCTORES (SOLO admin). Plantilla fija e idéntica para todos; el
 * admin cambia datos y fotos, reordena, añade y borra. Cada productor es una
 * sección del scroll del home. Sin premium/puntos/dueño: contenido del sello.
 */
export function AdminProductores() {
  const t = useTranslations();

  const [items, setItems] = useState<Producer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrden, setBusyOrden] = useState(false);

  // Editor (crear/editar) en modal.
  const [editId, setEditId] = useState<string | null>(null); // null = creando
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditableProducer>(emptyProducer());
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Producer | null>(null);
  const [deleting, setDeleting] = useState(false);

  function cargar() {
    return listProducers()
      .then((list) => {
        setItems(list);
        setError(null);
      })
      .catch((e) => {
        console.error("[admin-productores] load:", e);
        setError(t("adminProductores.errorLoad"));
      });
  }

  useEffect(() => {
    let active = true;
    listProducers()
      .then((list) => {
        if (!active) return;
        setItems(list);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[admin-productores] load:", e);
        setError(t("adminProductores.errorLoad"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  function abrirNuevo() {
    setEditId(null);
    setForm(emptyProducer());
    setError(null);
    setEditOpen(true);
  }

  function abrirEditar(p: Producer) {
    setEditId(p.id);
    setForm({
      name: p.name,
      origin: p.origin,
      location: p.location,
      role: p.role,
      quote: p.quote,
      bio: p.bio,
      socials: { ...p.socials },
      mainPhoto: p.mainPhoto,
      mainPhotoMobile: p.mainPhotoMobile,
      photos: [...p.photos],
      orden: p.orden,
    });
    setError(null);
    setEditOpen(true);
  }

  function patch(p: Partial<EditableProducer>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function guardar() {
    if (!form.name.trim()) {
      setError(t("adminProductores.errorNombre"));
      return;
    }
    if (!form.mainPhoto) {
      setError(t("adminProductores.errorPortada"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const clean: EditableProducer = {
        ...form,
        name: form.name.trim(),
        // Curaduría: el nuevo va al final.
        orden: editId ? form.orden : items.length,
      };
      if (editId) await updateProducer(editId, clean);
      else await createProducer(clean);
      await cargar();
      setEditOpen(false);
    } catch (e) {
      console.error("[admin-productores] save:", e);
      setError(t("adminProductores.errorSave"));
    } finally {
      setSaving(false);
    }
  }

  // Reordena: intercambia vecinos y persiste el `orden` (= índice). N pequeño.
  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length || busyOrden) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    const conOrden = next.map((p, idx) => ({ ...p, orden: idx }));
    setItems(conOrden);
    setBusyOrden(true);
    setError(null);
    try {
      await Promise.all(
        conOrden
          .filter((p, idx) => items[idx]?.id !== p.id || p.orden !== idx)
          .map((p) => setOrden(p.id, p.orden as number)),
      );
    } catch (e) {
      console.error("[admin-productores] orden:", e);
      setError(t("adminProductores.errorOrden"));
    } finally {
      setBusyOrden(false);
    }
  }

  async function doDelete(id: string) {
    setDeleting(true);
    setError(null);
    try {
      await deleteProducer(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
      setDeleteTarget(null);
    } catch (e) {
      console.error("[admin-productores] delete:", e);
      setError(t("adminProductores.errorDelete"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 pt-28 pb-24 sm:px-12">
      <Link
        href="/admin"
        className="text-silver-300 text-sm underline-offset-4 hover:text-white hover:underline"
      >
        {t("adminProductores.backToAdmin")}
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-narrow text-5xl font-bold uppercase sm:text-6xl">
            {t("adminProductores.title")}
          </h1>
          <p className="text-silver-300 mt-2 max-w-2xl">
            {t("adminProductores.intro")}
          </p>
        </div>
        <GlassButton onClick={abrirNuevo} className="!text-amethyst-200">
          <PlusIcon className="size-4" />
          {t("adminProductores.add")}
        </GlassButton>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-silver-300 mt-10">{t("common.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-silver-400 mt-10">{t("adminProductores.empty")}</p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p, i) => (
            <li
              key={p.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
            >
              <div className="relative aspect-[3/4] bg-neutral-900">
                {p.mainPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.mainPhoto}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/20">
                    <ImageIcon className="size-8" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                {/* Reordenar */}
                <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0 || busyOrden}
                    aria-label={t("adminProductores.ariaUp")}
                    className="text-silver-200 flex size-6 items-center justify-center rounded bg-black/50 backdrop-blur transition hover:bg-black/70 hover:text-white disabled:opacity-30"
                  >
                    <ArrowLeftIcon className="size-3.5 rotate-90" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    disabled={i === items.length - 1 || busyOrden}
                    aria-label={t("adminProductores.ariaDown")}
                    className="text-silver-200 flex size-6 items-center justify-center rounded bg-black/50 backdrop-blur transition hover:bg-black/70 hover:text-white disabled:opacity-30"
                  >
                    <ArrowLeftIcon className="size-3.5 -rotate-90" />
                  </button>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="font-narrow truncate text-lg leading-none font-bold text-white uppercase drop-shadow-[0_2px_8px_#000]">
                    {p.name || "—"}
                  </p>
                  <p className="text-silver-300 mt-1 truncate text-[11px]">
                    {p.role}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 p-2">
                <button
                  type="button"
                  onClick={() => abrirEditar(p)}
                  aria-label={t("adminProductores.ariaEdit")}
                  title={t("adminProductores.ariaEdit")}
                  className="text-silver-200 flex size-9 items-center justify-center rounded-lg transition hover:bg-white/10 hover:text-white"
                >
                  <EditIcon className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(p)}
                  aria-label={t("adminProductores.ariaDelete")}
                  title={t("adminProductores.ariaDelete")}
                  className="text-silver-400 flex size-9 items-center justify-center rounded-lg transition hover:bg-red-500/15 hover:text-red-200"
                >
                  <TrashIcon className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Editor crear/editar */}
      <GlassModal
        open={editOpen}
        onClose={() => !saving && setEditOpen(false)}
        title={
          editId
            ? t("adminProductores.editTitle")
            : t("adminProductores.newTitle")
        }
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Field
            label={t("adminProductores.fieldName")}
            value={form.name}
            onChange={(v) => patch({ name: v })}
            placeholder={t("adminProductores.fieldNamePh")}
          />
          <Field
            label={t("adminProductores.fieldRole")}
            value={form.role}
            onChange={(v) => patch({ role: v })}
            placeholder={t("adminProductores.fieldRolePh")}
          />
          <div>
            <p className="text-silver-300 text-xs font-semibold tracking-[1px] uppercase">
              {t("adminProductores.fieldOrigin")}
            </p>
            <LocationPicker
              value={form.location ?? null}
              onChange={(loc) =>
                patch({
                  location: loc ?? undefined,
                  origin: formatLocation(loc),
                })
              }
              className="mt-1 grid gap-2 sm:grid-cols-3"
            />
          </div>
          <Field
            label={t("adminProductores.fieldQuote")}
            value={form.quote}
            onChange={(v) => patch({ quote: v })}
            placeholder={t("adminProductores.fieldQuotePh")}
          />
          <Field
            label={t("adminProductores.fieldBio")}
            value={form.bio}
            onChange={(v) => patch({ bio: v })}
            placeholder={t("adminProductores.fieldBioPh")}
            textarea
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t("adminProductores.fieldFacebook")}
              value={form.socials.facebook ?? ""}
              onChange={(v) =>
                patch({
                  socials: { ...form.socials, facebook: v || undefined },
                })
              }
              placeholder="https://facebook.com/…"
            />
            <Field
              label={t("adminProductores.fieldInstagram")}
              value={form.socials.instagram ?? ""}
              onChange={(v) =>
                patch({
                  socials: { ...form.socials, instagram: v || undefined },
                })
              }
              placeholder="https://instagram.com/…"
            />
          </div>

          {/* Portadas: PC (obligatoria, horizontal) + móvil (opcional, vertical) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <PhotoUpload
              value={form.mainPhoto}
              onChange={(url) => patch({ mainPhoto: url })}
              label={t("adminProductores.coverPc")}
              hint={t("adminProductores.coverPcHint")}
              emptyLabel={t("adminProductores.coverPc")}
              aspect="aspect-video"
              onError={setError}
            />
            <PhotoUpload
              value={form.mainPhotoMobile ?? ""}
              onChange={(url) => patch({ mainPhotoMobile: url || undefined })}
              label={t("adminProductores.coverMobile")}
              hint={t("adminProductores.coverMobileHint")}
              emptyLabel={t("adminProductores.coverMobile")}
              aspect="aspect-[3/4]"
              onError={setError}
            />
          </div>

          {/* Galería */}
          <div>
            <p className="text-silver-300 text-xs font-semibold tracking-[1px] uppercase">
              {t("adminProductores.gallery")}
            </p>
            <p className="text-silver-400 mt-0.5 text-[11px]">
              {t("adminProductores.galleryHint")}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {form.photos.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="relative aspect-[3/4] overflow-hidden rounded-lg border border-white/15"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patch({ photos: form.photos.filter((_, k) => k !== idx) })
                    }
                    aria-label={t("adminProductores.ariaRemovePhoto")}
                    className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-red-500/70"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              ))}
              <PhotoUpload
                value=""
                onChange={(url) =>
                  url && patch({ photos: [...form.photos, url] })
                }
                emptyLabel={t("adminProductores.addPhoto")}
                aspect="aspect-[3/4]"
                onError={setError}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <GlassButton onClick={() => setEditOpen(false)} disabled={saving}>
            {t("adminProductores.cancel")}
          </GlassButton>
          <GlassButton
            onClick={guardar}
            disabled={saving}
            className="!text-amethyst-200"
          >
            {saving && <SpinnerIcon className="size-4 animate-spin" />}
            {t("adminProductores.save")}
          </GlassButton>
        </div>
      </GlassModal>

      {/* Confirmar borrado */}
      <GlassModal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={t("adminProductores.deleteTitle")}
      >
        <p className="text-silver-300 text-sm">
          {t("adminProductores.deleteMsg", {
            nombre: deleteTarget?.name ?? "",
          })}
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <GlassButton
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            {t("adminProductores.deleteCancel")}
          </GlassButton>
          <GlassButton
            onClick={() => deleteTarget && doDelete(deleteTarget.id)}
            disabled={deleting}
            className="!text-red-200"
          >
            {deleting ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : (
              <TrashIcon className="size-4" />
            )}
            {t("adminProductores.deleteConfirm")}
          </GlassButton>
        </div>
      </GlassModal>
    </main>
  );
}
