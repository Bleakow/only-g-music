"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { Link, useRouter } from "@/i18n/navigation";
import {
  getProfilesPage,
  getAllProfiles,
  countFeatured,
  getVisibleProfiles,
  setPremium,
  setCuracion,
  deleteProfile,
  createMockProfile,
  type ProfileCursor,
} from "@/features/artists/lib/artist-profile-repo";
import {
  type ArtistProfile,
  MAX_DESTACADOS,
  premiumEstado,
} from "@/domain/artist-profile";
import { TALENT_ROLES, type Role } from "@/domain/user";
import { activarMembresia } from "@/features/admin/lib/admin-users-repo";
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
import { AdminPageHeader, adminCard, adminInner, adminInput } from "./admin-ui";
import { Skeleton } from "@/components/ui/Skeleton";

const PAGE_SIZE = 24;
const inputCls = adminInput;

// Normaliza para búsqueda difusa: minúsculas + sin acentos.
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/**
 * Gestión de la vitrina (SOLO admin), pensada para ESCALAR:
 *  - Lista paginada con scroll infinito (`getProfilesPage`, cursor) dentro de un
 *    contenedor con altura máxima → no carga toda la colección al frontend.
 *  - Buscador server-side por prefijo de nombre (`searchProfilesByName`).
 *  - Acciones por perfil: activar/desactivar membresía, editar, borrar, destacar
 *    (el tope MAX_DESTACADOS se respeta con `countFeatured`, sin cargar todo).
 *  - El ORDEN del escaparate (los primeros que se ven) se cura aparte, en el modal
 *    "Curar escaparate", sobre el conjunto pequeño de perfiles visibles.
 */
export function AdminPerfiles() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  // Lista paginada
  const [perfiles, setPerfiles] = useState<ArtistProfile[]>([]);
  const [cursor, setCursor] = useState<ProfileCursor | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [featCount, setFeatCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Búsqueda (null = no se está buscando)
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ArtistProfile[] | null>(null);
  const [searching, setSearching] = useState(false);
  // Cache de TODOS los perfiles (se llena solo al buscar) para el filtro difuso.
  const allRef = useRef<ArtistProfile[] | null>(null);

  // Acciones / modales
  const [savingSlug, setSavingSlug] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArtistProfile | null>(null);
  const [mockOpen, setMockOpen] = useState(false);
  const [mockName, setMockName] = useState("");
  const [mockBusy, setMockBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [curarOpen, setCurarOpen] = useState(false);
  const [membershipTarget, setMembershipTarget] = useState<{
    profile: ArtistProfile;
    action: "activar" | "desactivar";
  } | null>(null);

  // Pestaña de disciplina activa (filtra la lista renderizada).
  const [tab, setTab] = useState<Role | "todos">("todos");

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Carga inicial: primera página + conteo de destacados.
  useEffect(() => {
    let active = true;
    Promise.all([getProfilesPage(PAGE_SIZE, null), countFeatured()])
      .then(([page, fc]) => {
        if (!active) return;
        setPerfiles(page.profiles);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
        setFeatCount(fc);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[admin-perfiles] carga:", e);
        setError(t("adminPerfiles.errorCarga"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  // Búsqueda DIFUSA en cliente: sin importar mayúsculas/minúsculas ni acentos, y
  // por SUBCADENA (coincidencia de letras en cualquier posición). Firestore no
  // hace búsqueda por subcadena, así que al buscar cargamos TODOS los perfiles una
  // vez (cache en `allRef`) y filtramos en memoria. El navegado normal sigue
  // paginado (sin carga masiva); esto solo ocurre cuando el admin busca.
  useEffect(() => {
    const q = norm(search.trim());
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    (async () => {
      try {
        if (!allRef.current) allRef.current = await getAllProfiles();
        if (cancelled) return;
        setResults(
          allRef.current.filter((p) => norm(p.artisticName || "").includes(q)),
        );
      } catch (e) {
        console.error("[admin-perfiles] buscar:", e);
        setError(t("adminPerfiles.errorCarga"));
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search, t]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await getProfilesPage(PAGE_SIZE, cursor);
      setPerfiles((prev) => [...prev, ...page.profiles]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (e) {
      console.error("[admin-perfiles] loadMore:", e);
      setError(t("adminPerfiles.errorCarga"));
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, cursor, t]);

  // Scroll infinito: observa el centinela dentro del contenedor con scroll. Solo
  // cuando NO se está buscando (la búsqueda trae su propio conjunto acotado).
  useEffect(() => {
    if (results !== null) return;
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root, rootMargin: "300px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [results, loadMore]);

  // Aplica un cambio a un perfil en ambas listas (paginada y resultados).
  const patchOne = (slug: string, patch: Partial<ArtistProfile>) => {
    const map = (arr: ArtistProfile[]) =>
      arr.map((p) => (p.slug === slug ? { ...p, ...patch } : p));
    setPerfiles(map);
    setResults((prev) => (prev ? map(prev) : prev));
    if (allRef.current) allRef.current = map(allRef.current);
  };

  // NOTA: el scroll infinito (`loadMore`) pagina SIN filtrar por disciplina —
  // Firestore pagina sobre la colección completa. Una pestaña puede mostrar
  // pocos resultados hasta que se cargan más páginas. La búsqueda difusa sí
  // carga todos los perfiles (`allRef`), así que en modo búsqueda el filtro
  // de pestaña ve el conjunto completo. Aceptable para el volumen actual.
  const base = results ?? perfiles;
  const lista =
    tab === "todos"
      ? base
      : base.filter((p) => (p.disciplines ?? ["artista"]).includes(tab));

  async function activar(slug: string, cortesia: boolean) {
    setSavingSlug(slug);
    setError(null);
    try {
      await activarMembresia(slug, cortesia);
      const now = Date.now();
      const exp = new Date(now);
      exp.setMonth(exp.getMonth() + 1); // membresía = 1 mes (espejo del server)
      patchOne(slug, {
        premium: {
          activo: true,
          since: now,
          expiresAt: exp.getTime(),
          ...(cortesia ? { cortesia: true } : {}),
        },
      });
      setMembershipTarget(null);
    } catch (e) {
      console.error("[admin-perfiles] activar:", e);
      setError(t("adminPerfiles.errorActivar"));
    } finally {
      setSavingSlug(null);
    }
  }

  async function desactivar(slug: string) {
    const target = lista.find((p) => p.slug === slug);
    setSavingSlug(slug);
    setError(null);
    try {
      const premium = target?.premium
        ? { ...target.premium, activo: false }
        : null;
      await setPremium(slug, premium);
      patchOne(slug, { premium });
      setMembershipTarget(null);
    } catch (e) {
      console.error("[admin-perfiles] desactivar:", e);
      setError(t("adminPerfiles.errorDesactivar"));
    } finally {
      setSavingSlug(null);
    }
  }

  async function toggleDestacado(slug: string) {
    const target = lista.find((p) => p.slug === slug);
    if (!target) return;
    const next = !target.featured;
    if (next && featCount >= MAX_DESTACADOS) {
      setError(t("adminPerfiles.errorMaxDestacados", { max: MAX_DESTACADOS }));
      return;
    }
    setError(null);
    patchOne(slug, { featured: next });
    setFeatCount((c) => c + (next ? 1 : -1));
    try {
      await setCuracion(slug, { featured: next });
    } catch (e) {
      console.error("[admin-perfiles] destacado:", e);
      setError(t("adminPerfiles.errorDestacado"));
      patchOne(slug, { featured: !next });
      setFeatCount((c) => c + (next ? -1 : 1));
    }
  }

  async function doDelete(slug: string) {
    setSavingSlug(slug);
    setError(null);
    try {
      await deleteProfile(slug);
      setPerfiles((prev) => prev.filter((p) => p.slug !== slug));
      setResults((prev) => (prev ? prev.filter((p) => p.slug !== slug) : prev));
      if (allRef.current)
        allRef.current = allRef.current.filter((p) => p.slug !== slug);
      setDeleteTarget(null);
    } catch (e) {
      console.error("[admin-perfiles] borrar:", e);
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
      console.error("[admin-perfiles] mock:", e);
      setError(t("adminPerfiles.errorMock"));
      setMockBusy(false);
    }
  }

  return (
    <main className="pb-24">
      <AdminPageHeader
        eyebrow={t("adminDashboard.eyebrow")}
        title={t("adminPerfiles.title")}
      >
        <p className="text-silver-200 mt-3 max-w-xl text-sm drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)] sm:text-base">
          {t.rich("adminPerfiles.descripcion", {
            max: MAX_DESTACADOS,
            strong: (chunks) => (
              <strong className="text-white">{chunks}</strong>
            ),
          })}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <GlassButton onClick={() => setCurarOpen(true)}>
            <StarIcon className="size-4" />
            {t("adminPerfiles.curarEscaparate")}
          </GlassButton>
          <GlassButton onClick={() => setLinkOpen(true)}>
            <UserPlusIcon className="size-4" />
            {t("adminPerfiles.link.vincularUsuario")}
          </GlassButton>
          <GlassButton onClick={() => setMockOpen(true)}>
            <PlusIcon className="size-4" />
            {t("adminPerfiles.crearMock")}
          </GlassButton>
        </div>
      </AdminPageHeader>

      <div className="px-6 sm:px-10">
        {error && (
          <p className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        {/* Buscador */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("adminPerfiles.buscarPerfil")}
          className={`mb-4 ${inputCls}`}
        />

        {/* Pestañas por disciplina */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(["todos", ...TALENT_ROLES] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase transition ${
                tab === k
                  ? "bg-amethyst-500/20 ring-amethyst-300/50 text-white ring-1 ring-inset"
                  : "text-silver-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              {k === "todos" ? t("adminPerfiles.tabTodos") : t(`roles.${k}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={`${adminCard} p-4`}>
            <Skeleton className="h-3 w-48" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`overflow-hidden rounded-xl ${adminInner}`}
                >
                  <Skeleton className="aspect-[3/4] w-full" />
                  <div className="flex items-center justify-end gap-1 p-2">
                    <Skeleton className="size-9" />
                    <Skeleton className="size-9" />
                    <Skeleton className="size-9" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={`${adminCard} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-silver-400 text-xs tracking-[2px] uppercase">
                {t("adminPerfiles.destacadosContador", {
                  count: featCount,
                  max: MAX_DESTACADOS,
                })}
              </p>
              {searching && (
                <SpinnerIcon className="text-silver-400 size-4 animate-spin" />
              )}
            </div>

            <div
              ref={scrollRef}
              className="mt-4 max-h-[70vh] overflow-y-auto pr-1"
            >
              {lista.length === 0 ? (
                <p className="text-silver-400 py-10 text-center text-sm">
                  {results !== null
                    ? t("adminPerfiles.link.sinResultados")
                    : t("adminPerfiles.sinPerfiles")}
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {lista.map((p) => {
                    const estado = premiumEstado(p.premium, Date.now());
                    const activo = estado === "activo";
                    const esSocio = p.socio === true;
                    // Visible en la vitrina = premium vigente O socio (waiver):
                    // el socio no paga membresía. Refleja perfilVisible/getVisibleProfiles.
                    const visible = activo || esSocio;
                    const busy = savingSlug === p.slug;
                    return (
                      <li
                        key={p.slug}
                        className={`overflow-hidden rounded-xl ${adminInner}`}
                      >
                        {/* Foto + máscara gris si NO está activo */}
                        <div className="relative aspect-[3/4] bg-neutral-900">
                          {p.photoURL ? (
                            <Image
                              src={p.photoURL}
                              alt={p.artisticName}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                              className={`object-cover ${visible ? "" : "grayscale"}`}
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                          {!visible && (
                            <div className="absolute inset-0 flex items-start justify-center bg-black/55">
                              <span className="text-silver-200 mt-3 rounded-full border border-white/25 bg-black/60 px-3 py-1 text-[10px] font-semibold tracking-[2px] uppercase">
                                {estado === "expirado"
                                  ? t("adminPerfiles.premiumEstado.expirado")
                                  : t("adminPerfiles.inactivo")}
                              </span>
                            </div>
                          )}
                          {esSocio && (
                            <span className="border-amethyst-300/40 bg-amethyst-500/25 text-amethyst-100 absolute top-1.5 left-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[1.5px] uppercase backdrop-blur">
                              {t("adminPerfiles.socio")}
                            </span>
                          )}

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
                            className={`absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-black/50 backdrop-blur transition hover:bg-black/70 ${
                              p.featured ? "text-amber-300" : "text-white/45"
                            }`}
                          >
                            <StarIcon className="size-4" />
                          </button>

                          {/* Nombre + estado */}
                          <div className="absolute inset-x-0 bottom-0 p-3">
                            <p className="font-narrow truncate text-lg leading-none font-bold text-white uppercase drop-shadow-[0_2px_8px_#000]">
                              {p.artisticName || "—"}
                            </p>
                            <p className="text-silver-300 mt-1 truncate text-[11px]">
                              {activo && p.premium
                                ? t("adminPerfiles.vence", {
                                    fecha: fechaCorta(
                                      p.premium.expiresAt,
                                      locale,
                                    ),
                                  })
                                : esSocio
                                  ? t("adminPerfiles.socioEstado")
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
                            className="text-silver-200 flex size-9 items-center justify-center rounded-lg transition hover:bg-white/10 hover:text-white"
                          >
                            <EditIcon className="size-4" />
                          </Link>

                          {/* Los SOCIOS (beatmaker/productor) están exentos de
                              membresía: no se ofrece activar un pago. */}
                          {!esSocio && (
                            <button
                              type="button"
                              onClick={() =>
                                setMembershipTarget({
                                  profile: p,
                                  action: activo ? "desactivar" : "activar",
                                })
                              }
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
                                activo
                                  ? "text-silver-300 hover:text-white"
                                  : "text-emerald-300"
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
                          )}

                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            aria-label={t("adminPerfiles.ariaBorrar")}
                            title={t("adminPerfiles.ariaBorrar")}
                            className="text-silver-400 flex size-9 items-center justify-center rounded-lg transition hover:bg-red-500/15 hover:text-red-200"
                          >
                            <TrashIcon className="size-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Centinela del scroll infinito (solo sin búsqueda). */}
              {results === null && hasMore && (
                <div
                  ref={sentinelRef}
                  className="flex justify-center py-6"
                  aria-hidden="true"
                >
                  {loadingMore && (
                    <SpinnerIcon className="text-silver-400 size-5 animate-spin" />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Crear mock profile */}
      <GlassModal
        open={mockOpen}
        onClose={() => !mockBusy && setMockOpen(false)}
        title={t("adminPerfiles.mockTitle")}
      >
        <p className="text-silver-300 text-sm">
          {t("adminPerfiles.mockDescripcion")}
        </p>
        <input
          value={mockName}
          onChange={(e) => setMockName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && crearMock()}
          placeholder={t("adminPerfiles.mockNamePlaceholder")}
          autoFocus
          className={`mt-4 ${inputCls}`}
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

      {/* Vincular perfil a un usuario real */}
      <LinkUserModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onLinked={(slug) => {
          setLinkOpen(false);
          router.push(`/admin/perfiles/${slug}/editar`);
        }}
      />

      {/* Curar el orden del escaparate */}
      <CurarEscaparateModal
        open={curarOpen}
        onClose={() => setCurarOpen(false)}
      />

      {/* Confirmar borrado */}
      <GlassModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t("adminPerfiles.borrarTitle")}
      >
        <p className="text-silver-300 text-sm">
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

      {/* Activar membresía: pago o cortesía */}
      <GlassModal
        open={membershipTarget?.action === "activar"}
        onClose={() => setMembershipTarget(null)}
        title={t("adminPerfiles.membresia.activarTitle", {
          nombre: membershipTarget?.profile.artisticName ?? "",
        })}
      >
        <p className="text-silver-300 text-sm">
          {t("adminPerfiles.membresia.activarDescripcion")}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <GlassButton
            onClick={() =>
              membershipTarget && activar(membershipTarget.profile.slug, false)
            }
            disabled={savingSlug === membershipTarget?.profile.slug}
            className="!text-amethyst-200"
          >
            {savingSlug === membershipTarget?.profile.slug ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : null}
            {t("adminPerfiles.membresia.pago")}
          </GlassButton>
          <div>
            <GlassButton
              onClick={() =>
                membershipTarget && activar(membershipTarget.profile.slug, true)
              }
              disabled={savingSlug === membershipTarget?.profile.slug}
            >
              {savingSlug === membershipTarget?.profile.slug ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : null}
              {t("adminPerfiles.membresia.cortesia")}
            </GlassButton>
            <p className="text-silver-400 mt-2 text-xs">
              {t("adminPerfiles.membresia.cortesiaHint")}
            </p>
          </div>
        </div>
      </GlassModal>

      {/* Desactivar membresía */}
      <GlassModal
        open={membershipTarget?.action === "desactivar"}
        onClose={() => setMembershipTarget(null)}
        title={t("adminPerfiles.membresia.desactivarTitle")}
      >
        <p className="text-silver-300 text-sm">
          {t("adminPerfiles.membresia.desactivarMensaje", {
            nombre: membershipTarget?.profile.artisticName ?? "",
          })}
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <GlassButton
            onClick={() => setMembershipTarget(null)}
            disabled={savingSlug === membershipTarget?.profile.slug}
          >
            {t("adminPerfiles.membresia.cancelar")}
          </GlassButton>
          <GlassButton
            onClick={() =>
              membershipTarget && desactivar(membershipTarget.profile.slug)
            }
            disabled={savingSlug === membershipTarget?.profile.slug}
            className="!text-red-200"
          >
            {savingSlug === membershipTarget?.profile.slug ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : null}
            {t("adminPerfiles.membresia.confirmar")}
          </GlassButton>
        </div>
      </GlassModal>
    </main>
  );
}

/**
 * Curación del ORDEN del escaparate: reordena (↑/↓) los perfiles VISIBLES (premium
 * vigente) — que son los primeros que se ven en la vitrina pública. Conjunto
 * pequeño, se carga entero. Persiste `orden` (= índice) de todos al reordenar.
 */
function CurarEscaparateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [items, setItems] = useState<ArtistProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    getVisibleProfiles()
      .then((p) => {
        if (active) {
          setItems(p);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!active) return;
        console.error("[curar-escaparate] carga:", e);
        setError(t("adminPerfiles.errorCarga"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, t]);

  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length || busy) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    const conOrden = next.map((p, idx) => ({ ...p, orden: idx }));
    setItems(conOrden);
    setBusy(true);
    setError(null);
    try {
      await Promise.all(
        conOrden.map((p) => setCuracion(p.slug, { orden: p.orden })),
      );
    } catch (e) {
      console.error("[curar-escaparate] orden:", e);
      setError(t("adminPerfiles.errorCurar"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassModal
      open={open}
      onClose={() => !busy && onClose()}
      title={t("adminPerfiles.curarTitle")}
      className="max-w-lg"
    >
      <p className="text-silver-300 text-sm">{t("adminPerfiles.curarNota")}</p>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="mt-4 max-h-[55vh] overflow-y-auto">
        {loading ? (
          <ul className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li
                key={i}
                className={`flex items-center gap-3 rounded-lg p-2.5 ${adminInner}`}
              >
                <Skeleton className="size-6 shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <div className="flex shrink-0 items-center gap-1">
                  <Skeleton className="size-8" />
                  <Skeleton className="size-8" />
                </div>
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <p className="text-silver-400 py-8 text-center text-sm">
            {t("adminPerfiles.curarVacio")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((p, i) => (
              <li
                key={p.slug}
                className={`flex items-center gap-3 rounded-lg p-2.5 ${adminInner}`}
              >
                <span className="text-silver-400 w-6 shrink-0 text-center text-sm font-semibold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                  {p.artisticName || p.slug}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0 || busy}
                    aria-label={t("adminPerfiles.ariaSubir")}
                    className="text-silver-200 flex size-8 items-center justify-center rounded-lg transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                  >
                    <ArrowLeftIcon className="size-4 rotate-90" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    disabled={i === items.length - 1 || busy}
                    aria-label={t("adminPerfiles.ariaBajar")}
                    className="text-silver-200 flex size-8 items-center justify-center rounded-lg transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                  >
                    <ArrowLeftIcon className="size-4 -rotate-90" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end">
        <GlassButton onClick={onClose} disabled={busy}>
          {t("adminPerfiles.curarCerrar")}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
