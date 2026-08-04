"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpinnerIcon, TrashIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/components/AuthProvider";
import type { Role } from "@only-g/shared-types/user";
import {
  PASES,
  PASE_DURACION_MESES,
  PASE_TIPOS,
  valesDe,
  type PaseTipo,
  type ValeId,
} from "@only-g/shared-types/pase";
import { extenderVigencia } from "@only-g/shared-types/vigencia";
import { premiumEstado, type Premium } from "@only-g/shared-types/artist-profile";
import {
  adminDeleteUser,
  adminListUsers,
  adminSearchUsers,
  adminSetRoles,
  activarMembresia,
  type AdminUserHit,
  type AdminUserPase,
} from "../lib/admin-users-repo";
import {
  activarPaseCortesia,
  marcarValeEntregado,
} from "@/features/pases/lib/pases-repo";
import { useRestanteLabel } from "@/features/pases/lib/use-restante";
import { getProfileBySlug } from "@/features/artists/lib/artist-profile-repo";
import { AdminPageHeader, adminCard, adminInner, adminInput } from "./admin-ui";

/** Todos los roles asignables desde este panel, en el orden en que se listan. */
const ALL_ROLES: Role[] = [
  "cliente",
  "admin",
  "productor",
  "artista",
  "beatmaker",
  "modelo",
  "bailarin",
  "dj",
  "presentador",
];

function isRole(value: string): value is Role {
  return (ALL_ROLES as string[]).includes(value);
}

/**
 * Estado del pase tras conceder `tipo` — ESPEJO en cliente de `concederPase`
 * (functions): la vigencia se ACUMULA sobre lo que quedara y los vales pasan a
 * ser los del tier nuevo. Se usa para repintar la fila al instante sin recargar
 * la lista; si el servidor cambiara la regla, este espejo hay que moverlo con él.
 */
function paseTrasOtorgar(
  actual: AdminUserPase | null,
  tipo: PaseTipo,
  now: number,
): AdminUserPase {
  const spec = PASES[tipo];
  return {
    tipo,
    activo: true,
    expiresAt: extenderVigencia(actual?.expiresAt, PASE_DURACION_MESES, now),
    cortesia: true,
    produccion: spec.produccion
      ? { alcance: spec.produccion, usado: false }
      : null,
    video: spec.video ? { usado: false } : null,
  };
}

/**
 * USUARIOS Y ROLES (SOLO admin). Tres cosas sobre la misma lista:
 *  - Navegar a TODOS los usuarios con scroll infinito (antes solo aparecían al
 *    acertar el nombre en el buscador, y no siempre se conoce).
 *  - Ajustar roles, y conceder/extender lo que se paga por tiempo: el PASE y la
 *    MEMBRESÍA del perfil. Es el único sitio donde se otorgan (la lista de
 *    artistas ya solo oculta o muestra): dos puertas para lo mismo terminan
 *    divergiendo.
 *  - Borrar la cuenta por completo, con confirmación tecleada.
 *
 * El cliente no puede leer otros `users/{uid}` (lo prohíben las reglas), así que
 * listar, buscar y borrar pasan por Cloud Functions server-authoritative.
 */
export function AdminRoles() {
  const t = useTranslations();
  const { account } = useAuth();
  const restanteLabel = useRestanteLabel();

  // Lista paginada (sin búsqueda)
  const [users, setUsers] = useState<AdminUserHit[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Búsqueda (null = no se está buscando)
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edición
  const [editTarget, setEditTarget] = useState<AdminUserHit | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [grantingPase, setGrantingPase] = useState<PaseTipo | null>(null);
  const [paseMsg, setPaseMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [valeBusy, setValeBusy] = useState<ValeId | null>(null);

  // Membresía del perfil vinculado (se carga al abrir el modal)
  const [premium, setPremium] = useState<Premium | null>(null);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumBusy, setPremiumBusy] = useState(false);

  // Borrado de cuenta
  const [deleteTarget, setDeleteTarget] = useState<AdminUserHit | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Primera página.
  useEffect(() => {
    let active = true;
    adminListUsers(null)
      .then((page) => {
        if (!active) return;
        setUsers(page.users);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[admin-roles] lista:", e);
        setError(t("adminRoles.errorBuscar"));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await adminListUsers(cursor);
      setUsers((prev) => [...prev, ...page.users]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (e) {
      console.error("[admin-roles] loadMore:", e);
      setError(t("adminRoles.errorBuscar"));
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, cursor, t]);

  // Scroll infinito dentro del contenedor (solo cuando NO se está buscando: la
  // búsqueda trae su propio conjunto acotado).
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
  }, [results, loadMore, loading]);

  // Búsqueda server-side con debounce; vacío vuelve a la lista paginada.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const hits = await adminSearchUsers(q);
        if (!cancelled) setResults(hits);
      } catch (e) {
        console.error("[admin-roles] search:", e);
        if (!cancelled) setError(t("adminRoles.errorBuscar"));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, t]);

  const lista = results ?? users;

  /** Aplica un cambio a un usuario en ambas listas (paginada y resultados). */
  const patchOne = (uid: string, patch: Partial<AdminUserHit>) => {
    const map = (arr: AdminUserHit[]) =>
      arr.map((u) => (u.uid === uid ? { ...u, ...patch } : u));
    setUsers(map);
    setResults((prev) => (prev ? map(prev) : prev));
    setEditTarget((prev) => (prev?.uid === uid ? { ...prev, ...patch } : prev));
  };

  function abrirEditor(u: AdminUserHit) {
    setEditTarget(u);
    setSelectedRoles(u.roles.filter(isRole));
    setModalError(null);
    setPaseMsg(null);
    setPremium(null);
    // La membresía del perfil vive en `artistProfiles/{slug}` (lectura pública),
    // así que se lee aquí y no se arrastra en la proyección de cada fila.
    if (u.artistSlug) {
      setPremiumLoading(true);
      getProfileBySlug(u.artistSlug)
        .then((p) => setPremium(p?.premium ?? null))
        .catch((e) => console.error("[admin-roles] perfil:", e))
        .finally(() => setPremiumLoading(false));
    }
  }

  /** Activa (o EXTIENDE) un pase de cortesía al usuario en edición. */
  async function otorgarPase(tipo: PaseTipo) {
    if (!editTarget || grantingPase) return;
    setGrantingPase(tipo);
    setPaseMsg(null);
    try {
      await activarPaseCortesia(editTarget.uid, tipo);
      const nuevo = paseTrasOtorgar(editTarget.pase, tipo, Date.now());
      patchOne(editTarget.uid, { pase: nuevo });
      setPaseMsg({
        ok: true,
        text: t("adminRoles.paseOtorgado", {
          pase: t(`pases.${tipo}.nombre`),
          restante: restanteLabel(nuevo.expiresAt),
        }),
      });
    } catch (e) {
      console.error("[admin-roles] pase:", e);
      setPaseMsg({ ok: false, text: t("adminRoles.paseError") });
    } finally {
      setGrantingPase(null);
    }
  }

  /** Activa (o extiende un mes) la membresía del PERFIL vinculado. */
  async function otorgarMembresia(cortesia: boolean) {
    const slug = editTarget?.artistSlug;
    if (!slug || premiumBusy) return;
    setPremiumBusy(true);
    setPaseMsg(null);
    try {
      await activarMembresia(slug, cortesia);
      const fresco = await getProfileBySlug(slug);
      setPremium(fresco?.premium ?? null);
      setPaseMsg({
        ok: true,
        text: t("adminRoles.membresiaOtorgada", {
          restante: restanteLabel(fresco?.premium?.expiresAt ?? null),
        }),
      });
    } catch (e) {
      console.error("[admin-roles] membresia:", e);
      setPaseMsg({ ok: false, text: t("adminRoles.membresiaError") });
    } finally {
      setPremiumBusy(false);
    }
  }

  /** Marca un vale del pase como ENTREGADO (el estudio ya lo cumplió). */
  async function entregarVale(vale: ValeId) {
    if (!editTarget || valeBusy) return;
    setValeBusy(vale);
    setPaseMsg(null);
    try {
      await marcarValeEntregado(editTarget.uid, vale);
      const pase = editTarget.pase;
      if (pase) {
        const now = Date.now();
        patchOne(editTarget.uid, {
          pase: {
            ...pase,
            produccion:
              vale === "produccion" && pase.produccion
                ? { ...pase.produccion, usado: true, entregadoAt: now }
                : pase.produccion,
            video:
              vale === "video" && pase.video
                ? { ...pase.video, usado: true, entregadoAt: now }
                : pase.video,
          },
        });
      }
    } catch (e) {
      console.error("[admin-roles] vale:", e);
      setPaseMsg({ ok: false, text: t("adminRoles.valeError") });
    } finally {
      setValeBusy(null);
    }
  }

  function toggleRole(role: Role) {
    if (role === "admin" && editTarget && account?.uid === editTarget.uid) {
      return;
    }
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  async function guardar() {
    if (!editTarget || savingUid) return;
    setSavingUid(editTarget.uid);
    setModalError(null);
    try {
      const { roles } = await adminSetRoles(editTarget.uid, selectedRoles);
      patchOne(editTarget.uid, { roles });
      setEditTarget(null);
    } catch (e) {
      console.error("[admin-roles] setRoles:", e);
      const code = (e as { code?: string })?.code;
      setModalError(
        code === "functions/failed-precondition"
          ? t("adminRoles.errorSelfAdmin")
          : t("adminRoles.errorGuardar"),
      );
    } finally {
      setSavingUid(null);
    }
  }

  /** Borrado TOTAL de la cuenta. Irreversible: la confirmación es tecleada. */
  async function borrarCuenta() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await adminDeleteUser(deleteTarget.uid);
      const fuera = (arr: AdminUserHit[]) =>
        arr.filter((u) => u.uid !== deleteTarget.uid);
      setUsers(fuera);
      setResults((prev) => (prev ? fuera(prev) : prev));
      setDeleteTarget(null);
      setDeleteConfirm("");
      setEditTarget(null);
    } catch (e) {
      console.error("[admin-roles] borrar:", e);
      const code = (e as { code?: string })?.code;
      setError(
        code === "functions/failed-precondition"
          ? t("adminRoles.borrarBloqueado")
          : t("adminRoles.borrarError"),
      );
    } finally {
      setDeleting(false);
    }
  }

  const editNombre = editTarget?.displayName ?? editTarget?.email ?? "";
  const paseActivo =
    !!editTarget?.pase?.activo &&
    (editTarget.pase.expiresAt ?? 0) > Date.now();
  const vales = editTarget?.pase
    ? valesDe({
        tipo: editTarget.pase.tipo ?? "lite",
        activo: editTarget.pase.activo,
        since: 0,
        expiresAt: editTarget.pase.expiresAt ?? 0,
        produccion: editTarget.pase.produccion ?? undefined,
        video: editTarget.pase.video ?? undefined,
      })
    : [];
  // Lo que hay que teclear para desbloquear el borrado: su correo, o el uid si
  // la cuenta no tiene ninguno.
  const deleteToken = deleteTarget?.email ?? deleteTarget?.uid ?? "";

  return (
    <main className="pb-24">
      <AdminPageHeader
        eyebrow={t("adminDashboard.eyebrow")}
        title={t("adminRoles.title")}
        subtitle={t("adminRoles.intro")}
      />

      <div className="px-6 sm:px-10">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("adminRoles.search")}
          className={adminInput}
        />

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-6">
          {loading ? (
            <div className={`${adminCard} p-5`}>
              <ul className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li
                    key={i}
                    className={`flex items-center justify-between gap-3 rounded-xl p-3 ${adminInner}`}
                  >
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="mt-2 h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={`${adminCard} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-silver-400 text-xs tracking-[2px] uppercase">
                  {results !== null
                    ? t("adminRoles.contadorBusqueda", { count: lista.length })
                    : t("adminRoles.contador", { count: lista.length })}
                </p>
                {searching && (
                  <SpinnerIcon className="text-silver-400 size-4 animate-spin" />
                )}
              </div>

              <div
                ref={scrollRef}
                className="mt-4 max-h-[65vh] overflow-y-auto pr-1"
              >
                {lista.length === 0 ? (
                  <p className="text-silver-400 py-10 text-center text-sm">
                    {t("adminRoles.noResults")}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {lista.map((u) => {
                      const vigente =
                        !!u.pase?.activo && (u.pase.expiresAt ?? 0) > Date.now();
                      return (
                        <li
                          key={u.uid}
                          className={`flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between ${adminInner}`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {u.displayName ?? u.email ?? u.uid}
                            </p>
                            {u.email && (
                              <p className="text-silver-400 truncate text-xs">
                                {u.email}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {u.roles.length === 0 ? (
                                <span className="text-silver-500 text-xs">
                                  —
                                </span>
                              ) : (
                                u.roles.map((r) => (
                                  <span
                                    key={r}
                                    className="bg-amethyst-500/20 text-amethyst-200 rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase"
                                  >
                                    {isRole(r) ? t(`roles.${r}`) : r}
                                  </span>
                                ))
                              )}
                              {u.pase?.tipo && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase ${
                                    vigente
                                      ? "bg-emerald-400/15 text-emerald-200"
                                      : "text-silver-400 bg-white/[0.06]"
                                  }`}
                                >
                                  {t(`pases.${u.pase.tipo}.nombre`)} ·{" "}
                                  {restanteLabel(u.pase.expiresAt)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
                            <GlassButton
                              onClick={() => abrirEditor(u)}
                              className="!text-amethyst-200"
                            >
                              {t("adminRoles.gestionar")}
                            </GlassButton>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget(u);
                                setDeleteConfirm("");
                              }}
                              aria-label={t("adminRoles.borrarAria")}
                              title={t("adminRoles.borrarAria")}
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
      </div>

      {/* Editor de roles + tiempo pagado */}
      <GlassModal
        open={!!editTarget}
        onClose={() => !savingUid && setEditTarget(null)}
        title={t("adminRoles.editTitle", { nombre: editNombre })}
      >
        <p className="text-silver-300 text-xs">{t("adminRoles.syncNote")}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {ALL_ROLES.map((role) => {
            const active = selectedRoles.includes(role);
            const disabled =
              role === "admin" && account?.uid === editTarget?.uid;
            return (
              <button
                key={role}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => toggleRole(role)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase ring-1 transition ring-inset ${
                  active
                    ? "bg-amethyst-500/25 text-amethyst-100 ring-amethyst-400/40"
                    : "text-silver-300 bg-white/[0.04] ring-white/15 hover:bg-white/10"
                } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
              >
                {t(`roles.${role}`)}
              </button>
            );
          })}
        </div>

        {/* PASE de cortesía. Cada botón dice si YA lo tiene y cuánto le queda;
            pulsarlo vuelve a sumar un mes (la vigencia acumula, no reemplaza). */}
        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-silver-300 text-xs font-semibold tracking-[1px] uppercase">
            {t("adminRoles.paseTitulo")}
          </p>
          <p className="text-silver-500 mt-1 text-xs">
            {t("adminRoles.paseNota")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PASE_TIPOS.map((tipo) => {
              const esActual = paseActivo && editTarget?.pase?.tipo === tipo;
              return (
                <button
                  key={tipo}
                  type="button"
                  disabled={!!grantingPase}
                  onClick={() => otorgarPase(tipo)}
                  title={
                    esActual
                      ? t("adminRoles.paseSuma")
                      : t("adminRoles.paseActivar")
                  }
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 transition ring-inset disabled:opacity-40 ${
                    esActual
                      ? "bg-emerald-400/15 text-emerald-100 ring-emerald-300/40 hover:bg-emerald-400/25"
                      : "bg-amethyst-500/15 text-amethyst-100 ring-amethyst-400/30 hover:bg-amethyst-500/25"
                  }`}
                >
                  {grantingPase === tipo && (
                    <SpinnerIcon className="size-3.5 animate-spin" />
                  )}
                  {esActual && <span aria-hidden="true">✓</span>}
                  {t(`pases.${tipo}.nombre`)}
                  {esActual && (
                    <span className="font-normal opacity-80">
                      · {restanteLabel(editTarget?.pase?.expiresAt)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-silver-500 mt-2 text-[11px]">
            {paseActivo ? t("adminRoles.paseSuma") : t("adminRoles.paseActivar")}
          </p>
        </div>

        {/* MEMBRESÍA del perfil (solo si tiene perfil vinculado). Vive aquí y no
            en la lista de artistas: allí el ojo solo oculta o muestra. */}
        {editTarget?.artistSlug && (
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-silver-300 text-xs font-semibold tracking-[1px] uppercase">
              {t("adminRoles.membresiaTitulo")}
            </p>
            {premiumLoading ? (
              <Skeleton className="mt-2 h-4 w-40" />
            ) : (
              <p className="text-silver-400 mt-1 text-xs">
                {premiumEstado(premium, Date.now()) === "activo"
                  ? t("adminRoles.membresiaActiva", {
                      restante: restanteLabel(premium?.expiresAt),
                    })
                  : t("adminRoles.membresiaInactiva")}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <GlassButton
                onClick={() => otorgarMembresia(false)}
                disabled={premiumBusy || premiumLoading}
                className="!text-amethyst-200"
              >
                {premiumBusy && <SpinnerIcon className="size-4 animate-spin" />}
                {t("adminRoles.membresiaPago")}
              </GlassButton>
              <GlassButton
                onClick={() => otorgarMembresia(true)}
                disabled={premiumBusy || premiumLoading}
              >
                {t("adminRoles.membresiaCortesia")}
              </GlassButton>
            </div>
            <p className="text-silver-500 mt-2 text-[11px]">
              {t("adminRoles.membresiaNota")}
            </p>
          </div>
        )}

        {/* VALES del pase: lo que entrega una persona (producción, video). */}
        {vales.length > 0 && (
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-silver-300 text-xs font-semibold tracking-[1px] uppercase">
              {t("adminRoles.valesTitulo")}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {vales.map((v) => (
                <li
                  key={v.id}
                  className={`flex items-center justify-between gap-3 rounded-lg p-2.5 ${adminInner}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">
                      {t(
                        v.id === "video"
                          ? "pases.incluye.video"
                          : v.alcance === "grupo"
                            ? "pases.incluye.produccionGrupo"
                            : "pases.incluye.produccionArtista",
                      )}
                    </p>
                    <p
                      className={`text-xs ${
                        v.estado === "entregado"
                          ? "text-emerald-300"
                          : v.estado === "reclamado"
                            ? "text-amber-300"
                            : "text-silver-400"
                      }`}
                    >
                      {t(`vales.estado.${v.estado}`)}
                    </p>
                  </div>
                  {v.estado !== "entregado" && (
                    <GlassButton
                      onClick={() => entregarVale(v.id)}
                      disabled={!!valeBusy}
                      className="shrink-0"
                    >
                      {valeBusy === v.id && (
                        <SpinnerIcon className="size-4 animate-spin" />
                      )}
                      {t("adminRoles.valeEntregar")}
                    </GlassButton>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {paseMsg && (
          <p
            className={`mt-4 text-xs ${
              paseMsg.ok ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {paseMsg.text}
          </p>
        )}

        {modalError && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {modalError}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (!editTarget) return;
              setDeleteTarget(editTarget);
              setDeleteConfirm("");
            }}
            className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-red-300/80 uppercase transition hover:text-red-200"
          >
            <TrashIcon className="size-4" />
            {t("adminRoles.borrarCuenta")}
          </button>
          <div className="flex items-center gap-3">
            <GlassButton
              onClick={() => setEditTarget(null)}
              disabled={!!savingUid}
            >
              {t("adminRoles.cancel")}
            </GlassButton>
            <GlassButton
              onClick={guardar}
              disabled={!!savingUid}
              className="!text-amethyst-200"
            >
              {savingUid && <SpinnerIcon className="size-4 animate-spin" />}
              {t("adminRoles.save")}
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Borrado TOTAL de la cuenta: irreversible, con confirmación tecleada.
          Un botón rojo a un clic acaba disparándose solo. */}
      <GlassModal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={t("adminRoles.borrarTitle", {
          nombre: deleteTarget?.displayName ?? deleteTarget?.email ?? "",
        })}
      >
        <p className="text-silver-300 text-sm">
          {t("adminRoles.borrarMensaje")}
        </p>
        <ul className="text-silver-400 mt-3 list-disc space-y-1 pl-5 text-xs">
          <li>{t("adminRoles.borrarItemCuenta")}</li>
          <li>{t("adminRoles.borrarItemPerfil")}</li>
          <li>{t("adminRoles.borrarItemChats")}</li>
        </ul>
        <p className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          {t("adminRoles.borrarAvisoContable")}
        </p>

        <label className="text-silver-400 mt-4 block text-xs">
          {t("adminRoles.borrarConfirmaLabel", { token: deleteToken })}
        </label>
        <input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder={deleteToken}
          autoComplete="off"
          className={`mt-1.5 ${adminInput}`}
        />

        <div className="mt-6 flex items-center justify-end gap-3">
          <GlassButton
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            {t("adminRoles.cancel")}
          </GlassButton>
          <GlassButton
            onClick={borrarCuenta}
            disabled={deleting || deleteConfirm.trim() !== deleteToken}
            className="!text-red-200"
          >
            {deleting ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : (
              <TrashIcon className="size-4" />
            )}
            {t("adminRoles.borrarConfirm")}
          </GlassButton>
        </div>
      </GlassModal>
    </main>
  );
}
