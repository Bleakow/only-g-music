"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { Link, useRouter } from "@/i18n/navigation";
import {
  getAllProfiles,
  setPremium,
  setCuracion,
  deleteProfile,
  createMockProfile,
} from "@/features/artists/lib/artist-profile-repo";
import {
  type ArtistProfile,
  activarPremium,
  MAX_DESTACADOS,
  compararOrden,
  premiumEstado,
} from "@/domain/artist-profile";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import {
  ArrowLeftIcon,
  StarIcon,
  EditIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
  PlusIcon,
  SpinnerIcon,
  UserPlusIcon,
} from "@/components/icons";
import { LinkUserModal } from "./LinkUserModal";

/**
 * Gestión de la vitrina (SOLO admin). Es la "lista de artistas" del admin: una
 * grilla con TODOS los perfiles (los inactivos, sin premium vigente, salen con
 * máscara gris). Desde aquí el admin reordena, activa/desactiva la membresía,
 * edita, borra, destaca y crea "mock profiles" (relleno sin dueño). Vincular un
 * perfil a un usuario real + rol artista es la Fase 2 (Cloud Function).
 */
export function AdminPerfiles() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [perfiles, setPerfiles] = useState<ArtistProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [busyOrden, setBusyOrden] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ArtistProfile | null>(null);
  const [mockOpen, setMockOpen] = useState(false);
  const [mockName, setMockName] = useState("");
  const [mockBusy, setMockBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getAllProfiles()
      .then((p) => {
        if (!active) return;
        setPerfiles([...p].sort(compararOrden));
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[admin-perfiles] error:", e);
        setError(t("adminPerfiles.errorCarga"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const destacados = perfiles.filter((p) => p.featured).length;

  async function activar(slug: string) {
    setSavingSlug(slug);
    setError(null);
    try {
      const premium = activarPremium(Date.now());
      await setPremium(slug, premium);
      setPerfiles((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, premium } : p)),
      );
    } catch (e) {
      console.error("[admin-perfiles] setPremium error:", e);
      setError(t("adminPerfiles.errorActivar"));
    } finally {
      setSavingSlug(null);
    }
  }

  async function desactivar(slug: string) {
    const target = perfiles.find((p) => p.slug === slug);
    setSavingSlug(slug);
    setError(null);
    try {
      // Conserva el registro (since/expiresAt) pero lo marca inactivo: deja de
      // estar visible. Si no había premium, queda null.
      const premium = target?.premium
        ? { ...target.premium, activo: false }
        : null;
      await setPremium(slug, premium);
      setPerfiles((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, premium } : p)),
      );
    } catch (e) {
      console.error("[admin-perfiles] desactivar error:", e);
      setError(t("adminPerfiles.errorDesactivar"));
    } finally {
      setSavingSlug(null);
    }
  }

  // Reordena la vitrina: intercambia dos vecinos y persiste el `orden` (= índice)
  // de los que cambiaron. N pequeño, reescribir es seguro y simple.
  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= perfiles.length || busyOrden) return;
    const next = [...perfiles];
    [next[i], next[j]] = [next[j], next[i]];
    const conOrden = next.map((p, idx) => ({ ...p, orden: idx }));
    setPerfiles(conOrden);
    setBusyOrden(true);
    setError(null);
    try {
      await Promise.all(
        conOrden
          .filter((p, idx) => perfiles[idx]?.slug !== p.slug || p.orden !== idx)
          .map((p) => setCuracion(p.slug, { orden: p.orden })),
      );
    } catch (e) {
      console.error("[admin-perfiles] orden error:", e);
      setError(t("adminPerfiles.errorOrden"));
    } finally {
      setBusyOrden(false);
    }
  }

  async function toggleDestacado(slug: string) {
    const target = perfiles.find((p) => p.slug === slug);
    if (!target) return;
    const next = !target.featured;
    if (next && destacados >= MAX_DESTACADOS) {
      setError(t("adminPerfiles.errorMaxDestacados", { max: MAX_DESTACADOS }));
      return;
    }
    setError(null);
    setPerfiles((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, featured: next } : p)),
    );
    try {
      await setCuracion(slug, { featured: next });
    } catch (e) {
      console.error("[admin-perfiles] featured error:", e);
      setError(t("adminPerfiles.errorDestacado"));
      setPerfiles((prev) =>
        prev.map((p) => (p.slug === slug ? { ...p, featured: !next } : p)),
      );
    }
  }

  async function doDelete(slug: string) {
    setSavingSlug(slug);
    setError(null);
    try {
      await deleteProfile(slug);
      setPerfiles((prev) => prev.filter((p) => p.slug !== slug));
      setDeleteTarget(null);
    } catch (e) {
      console.error("[admin-perfiles] borrar error:", e);
      setError(t("adminPerfiles.errorBorrar"));
    } finally {
      setSavingSlug(null);
    }
  }

  async function crearMock() {
    const name = mockName.trim();
    if (!name) return;
    setMockBusy(true);
    setError(null);
    try {
      const slug = await createMockProfile(name);
      router.push(`/admin/perfiles/${slug}/editar`);
    } catch (e) {
      console.error("[admin-perfiles] mock error:", e);
      setError(t("adminPerfiles.errorMock"));
      setMockBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-6 pb-24 pt-28 sm:px-12">
      <Link
        href="/admin"
        className="text-sm text-silver-300 underline-offset-4 hover:text-white hover:underline"
      >
        {t("adminPerfiles.backToAdmin")}
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-narrow text-5xl font-bold uppercase sm:text-6xl">
            {t("adminPerfiles.title")}
          </h1>
          <p className="mt-2 max-w-2xl text-silver-300">
            {t.rich("adminPerfiles.descripcion", {
              max: MAX_DESTACADOS,
              strong: (chunks) => <strong className="text-white">{chunks}</strong>,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GlassButton onClick={() => setLinkOpen(true)}>
            <UserPlusIcon className="size-4" />
            {t("adminPerfiles.link.vincularUsuario")}
          </GlassButton>
          <GlassButton onClick={() => setMockOpen(true)}>
            <PlusIcon className="size-4" />
            {t("adminPerfiles.crearMock")}
          </GlassButton>
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-silver-300">{t("common.loading")}</p>
      ) : perfiles.length === 0 ? (
        <p className="mt-10 text-silver-400">{t("adminPerfiles.sinPerfiles")}</p>
      ) : (
        <>
          <p className="mt-8 text-xs uppercase tracking-[2px] text-silver-400">
            {t("adminPerfiles.destacadosContador", { count: destacados, max: MAX_DESTACADOS })}
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {perfiles.map((p, i) => {
              const estado = premiumEstado(p.premium, Date.now());
              const activo = estado === "activo";
              const busy = savingSlug === p.slug;
              return (
                <li
                  key={p.slug}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                >
                  {/* Foto + máscara gris si NO está activo */}
                  <div className="relative aspect-[3/4] bg-neutral-900">
                    {p.photoURL ? (
                      <Image
                        src={p.photoURL}
                        alt={p.artisticName}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className={`object-cover ${activo ? "" : "grayscale"}`}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                    {/* Máscara de inactivo */}
                    {!activo && (
                      <div className="absolute inset-0 flex items-start justify-center bg-black/55">
                        <span className="mt-3 rounded-full border border-white/25 bg-black/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[2px] text-silver-200">
                          {estado === "expirado"
                            ? t("adminPerfiles.premiumEstado.expirado")
                            : t("adminPerfiles.inactivo")}
                        </span>
                      </div>
                    )}

                    {/* Reordenar (arriba-izq) */}
                    <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => mover(i, -1)}
                        disabled={i === 0 || busyOrden}
                        aria-label={t("adminPerfiles.ariaSubir")}
                        className="flex size-6 items-center justify-center rounded bg-black/50 text-silver-200 backdrop-blur transition hover:bg-black/70 hover:text-white disabled:opacity-30"
                      >
                        <ArrowLeftIcon className="size-3.5 rotate-90" />
                      </button>
                      <button
                        type="button"
                        onClick={() => mover(i, 1)}
                        disabled={i === perfiles.length - 1 || busyOrden}
                        aria-label={t("adminPerfiles.ariaBajar")}
                        className="flex size-6 items-center justify-center rounded bg-black/50 text-silver-200 backdrop-blur transition hover:bg-black/70 hover:text-white disabled:opacity-30"
                      >
                        <ArrowLeftIcon className="size-3.5 -rotate-90" />
                      </button>
                    </div>

                    {/* Destacado (arriba-der) */}
                    <button
                      type="button"
                      onClick={() => toggleDestacado(p.slug)}
                      aria-pressed={p.featured ?? false}
                      aria-label={
                        p.featured
                          ? t("adminPerfiles.ariaQuitarDestacado")
                          : t("adminPerfiles.ariaMarcarDestacado")
                      }
                      className={`absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/50 backdrop-blur transition hover:bg-black/70 ${
                        p.featured ? "text-amber-300" : "text-white/45"
                      }`}
                    >
                      <StarIcon className="size-4" />
                    </button>

                    {/* Nombre + estado */}
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="truncate font-narrow text-lg font-bold uppercase leading-none text-white drop-shadow-[0_2px_8px_#000]">
                        {p.artisticName || "—"}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-silver-300">
                        {activo && p.premium
                          ? t("adminPerfiles.vence", {
                              fecha: fechaCorta(p.premium.expiresAt, locale),
                            })
                          : t(`adminPerfiles.premiumEstado.${estado}`)}
                      </p>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center justify-between gap-1 p-2">
                    <Link
                      href={`/admin/perfiles/${p.slug}/editar`}
                      aria-label={t("adminPerfiles.ariaEditar")}
                      title={t("adminPerfiles.ariaEditar")}
                      className="flex size-9 items-center justify-center rounded-lg text-silver-200 transition hover:bg-white/10 hover:text-white"
                    >
                      <EditIcon className="size-4" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => (activo ? desactivar(p.slug) : activar(p.slug))}
                      disabled={busy}
                      aria-label={
                        activo
                          ? t("adminPerfiles.ariaDesactivar")
                          : t("adminPerfiles.ariaActivar")
                      }
                      title={
                        activo
                          ? t("adminPerfiles.ariaDesactivar")
                          : t("adminPerfiles.ariaActivar")
                      }
                      className={`flex size-9 items-center justify-center rounded-lg transition hover:bg-white/10 disabled:opacity-40 ${
                        activo ? "text-silver-300 hover:text-white" : "text-emerald-300"
                      }`}
                    >
                      {busy ? (
                        <SpinnerIcon className="size-4 animate-spin" />
                      ) : activo ? (
                        <EyeOffIcon className="size-4" />
                      ) : (
                        <EyeIcon className="size-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(p)}
                      aria-label={t("adminPerfiles.ariaBorrar")}
                      title={t("adminPerfiles.ariaBorrar")}
                      className="flex size-9 items-center justify-center rounded-lg text-silver-400 transition hover:bg-red-500/15 hover:text-red-200"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Crear mock profile */}
      <GlassModal
        open={mockOpen}
        onClose={() => !mockBusy && setMockOpen(false)}
        title={t("adminPerfiles.mockTitle")}
      >
        <p className="text-sm text-silver-300">
          {t("adminPerfiles.mockDescripcion")}
        </p>
        <input
          value={mockName}
          onChange={(e) => setMockName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && crearMock()}
          placeholder={t("adminPerfiles.mockNamePlaceholder")}
          autoFocus
          className="mt-4 w-full rounded-lg bg-white/[0.06] px-4 py-2.5 text-white outline-none ring-1 ring-inset ring-white/20 transition focus:ring-white/50 placeholder:text-white/40"
        />
        <div className="mt-6 flex items-center justify-end gap-3">
          <GlassButton onClick={() => setMockOpen(false)} disabled={mockBusy}>
            {t("adminPerfiles.mockCancelar")}
          </GlassButton>
          <GlassButton
            onClick={crearMock}
            disabled={mockBusy || !mockName.trim()}
            className="!text-amethyst-200"
          >
            {mockBusy ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            {t("adminPerfiles.mockCrear")}
          </GlassButton>
        </div>
      </GlassModal>

      {/* Vincular perfil a un usuario real (Cloud Function) */}
      <LinkUserModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onLinked={(slug) => {
          setLinkOpen(false);
          router.push(`/admin/perfiles/${slug}/editar`);
        }}
      />

      {/* Confirmar borrado */}
      <GlassModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("adminPerfiles.borrarTitle")}
      >
        <p className="text-sm text-silver-300">
          {t("adminPerfiles.borrarMensaje", {
            nombre: deleteTarget?.artisticName || deleteTarget?.slug || "",
          })}
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <GlassButton onClick={() => setDeleteTarget(null)}>
            {t("adminPerfiles.borrarCancelar")}
          </GlassButton>
          <GlassButton
            onClick={() => deleteTarget && doDelete(deleteTarget.slug)}
            disabled={savingSlug === deleteTarget?.slug}
            className="!text-red-200"
          >
            <TrashIcon className="size-4" />
            {t("adminPerfiles.borrarConfirm")}
          </GlassButton>
        </div>
      </GlassModal>
    </main>
  );
}
