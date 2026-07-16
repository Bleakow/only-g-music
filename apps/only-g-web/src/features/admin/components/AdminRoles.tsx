"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { SpinnerIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/components/AuthProvider";
import type { Role } from "@only-g/shared-types/user";
import {
  adminSearchUsers,
  adminSetRoles,
  type AdminUserHit,
} from "../lib/admin-users-repo";
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
];

function isRole(value: string): value is Role {
  return (ALL_ROLES as string[]).includes(value);
}

/**
 * Gestión de ROLES (SOLO admin): busca cualquier usuario de la app (vía Cloud
 * Function, el cliente no puede leer otros `users/{uid}`) y ajusta sus roles
 * en un modal. `adminSetRoles` es server-authoritative: sincroniza
 * disciplines/socio del perfil vinculado y bloquea que el admin se quite su
 * propio rol admin (aquí replicamos ese bloqueo también en la UI).
 */
export function AdminRoles() {
  const t = useTranslations();
  const { account } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<AdminUserHit | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Búsqueda con debounce; vacío no dispara llamada (evita listar a todos).
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const hits = await adminSearchUsers(q);
        if (!cancelled) setResults(hits);
      } catch (e) {
        console.error("[admin-roles] search:", e);
        if (!cancelled) setError(t("adminRoles.errorBuscar"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, t]);

  function abrirEditor(u: AdminUserHit) {
    setEditTarget(u);
    setSelectedRoles(u.roles.filter(isRole));
    setModalError(null);
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
      setResults((prev) =>
        prev.map((u) => (u.uid === editTarget.uid ? { ...u, roles } : u)),
      );
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

  const editNombre = editTarget?.displayName ?? editTarget?.email ?? "";

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
                {Array.from({ length: 4 }).map((_, i) => (
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
          ) : query.trim() === "" ? (
            <p className="text-silver-400">{t("adminRoles.typeToSearch")}</p>
          ) : results.length === 0 ? (
            <p className="text-silver-400">{t("adminRoles.noResults")}</p>
          ) : (
            <div className={`${adminCard} p-5`}>
              <ul className="flex flex-col gap-3">
                {results.map((u) => (
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
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {u.roles.length === 0 ? (
                          <span className="text-silver-500 text-xs">—</span>
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
                      </div>
                    </div>
                    <GlassButton
                      onClick={() => abrirEditor(u)}
                      className="!text-amethyst-200 shrink-0 self-start sm:self-center"
                    >
                      {t("adminRoles.editRoles")}
                    </GlassButton>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Editor de roles */}
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

        {modalError && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {modalError}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
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
      </GlassModal>
    </main>
  );
}
