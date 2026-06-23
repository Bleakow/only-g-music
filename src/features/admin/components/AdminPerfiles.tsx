"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  getAllProfiles,
  setPremium,
  setCuracion,
} from "@/features/artists/lib/artist-profile-repo";
import {
  type ArtistProfile,
  activarPremium,
  insigniaDePuntos,
  INSIGNIA_META,
  MAX_DESTACADOS,
  compararOrden,
  premiumEstado,
} from "@/domain/artist-profile";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import { Button } from "@/components/ui/Button";
import { ArrowLeftIcon, StarIcon } from "@/components/icons";

export function AdminPerfiles() {
  const t = useTranslations();
  const locale = useLocale();
  const [perfiles, setPerfiles] = useState<ArtistProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [busyOrden, setBusyOrden] = useState(false);

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

  // Reordena la vitrina: intercambia dos vecinos y persiste el `orden` (= índice)
  // de todos los que cambiaron. N pequeño, así que reescribir es seguro y simple.
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

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 pb-24 pt-28 sm:px-12">
      <Link
        href="/admin"
        className="text-sm text-silver-300 underline-offset-4 hover:text-white hover:underline"
      >
        {t("adminPerfiles.backToAdmin")}
      </Link>
      <h1 className="mt-4 font-narrow text-5xl font-bold uppercase sm:text-6xl">
        {t("adminPerfiles.title")}
      </h1>
      <p className="mt-2 text-silver-300">
        {t.rich("adminPerfiles.descripcion", {
          max: MAX_DESTACADOS,
          strong: (chunks) => <strong className="text-white">{chunks}</strong>,
          code: (chunks) => <code className="text-amethyst-200">{chunks}</code>,
        })}
      </p>

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
          <ul className="mt-3 flex flex-col gap-3">
            {perfiles.map((p, i) => {
              const estado = premiumEstado(p.premium, Date.now());
              const insignia = INSIGNIA_META[insigniaDePuntos(p.puntos)];
              return (
                <li
                  key={p.slug}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  {/* Reordenar */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0 || busyOrden}
                      aria-label={t("adminPerfiles.ariaSubir")}
                      className="flex size-6 items-center justify-center rounded text-silver-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                    >
                      <ArrowLeftIcon className="size-4 rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={i === perfiles.length - 1 || busyOrden}
                      aria-label={t("adminPerfiles.ariaBajar")}
                      className="flex size-6 items-center justify-center rounded text-silver-300 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                    >
                      <ArrowLeftIcon className="size-4 -rotate-90" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">
                      {p.artisticName}{" "}
                      <span
                        className="ml-1 text-xs uppercase tracking-wide"
                        style={{ color: insignia.color }}
                      >
                        {insignia.label}
                      </span>
                    </p>
                    <p className="text-sm text-silver-400">
                      <Link
                        href={`/artistas/${p.slug}`}
                        className="underline-offset-2 hover:text-white hover:underline"
                      >
                        /artistas/{p.slug}
                      </Link>{" "}
                      · {t(`adminPerfiles.premiumEstado.${estado}`)}
                      {p.premium && estado !== "ninguno"
                        ? ` ${t("adminPerfiles.vence", { fecha: fechaCorta(p.premium.expiresAt, locale) })}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Destacado (★) */}
                    <button
                      type="button"
                      onClick={() => toggleDestacado(p.slug)}
                      aria-pressed={p.featured ?? false}
                      aria-label={
                        p.featured
                          ? t("adminPerfiles.ariaQuitarDestacado")
                          : t("adminPerfiles.ariaMarcarDestacado")
                      }
                      title={
                        p.featured
                          ? t("adminPerfiles.titleDestacado")
                          : t("adminPerfiles.ariaMarcarDestacado")
                      }
                      className={`flex size-9 items-center justify-center rounded-full transition hover:bg-white/10 ${
                        p.featured ? "text-amber-300" : "text-white/35"
                      }`}
                    >
                      <StarIcon className="size-5" />
                    </button>
                    <Button
                      size="sm"
                      variant={estado === "activo" ? "secondary" : "primary"}
                      loading={savingSlug === p.slug}
                      onClick={() => activar(p.slug)}
                    >
                      {estado === "activo" ? t("adminPerfiles.btnRenovar") : t("adminPerfiles.btnActivar")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
