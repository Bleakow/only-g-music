"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SpinnerIcon, PlusIcon, TrashIcon } from "@/components/icons";
import type { SedeId } from "@only-g/shared-types/sede";
import {
  adminSearchUsers,
  adminGetUsersByIds,
  adminAssignProductor,
  type AdminUserHit,
} from "@/features/admin/lib/admin-users-repo";
import {
  getSedeById,
  removeProductorFromSede,
} from "@/features/sedes/lib/sedes-repo";

/**
 * Gestión de productores de una sede (dentro del modal de AdminEstudios).
 * Autocontenido por `sedeId`: busca usuarios, asigna (rol productor + registro en
 * la sede, vía callable server-side) y quita. Muestra los asignados por nombre.
 */
export function SedeProductores({ sedeId }: { sedeId: SedeId }) {
  const t = useTranslations();
  const [asignados, setAsignados] = useState<AdminUserHit[]>([]);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<AdminUserHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [buscando, setBuscando] = useState(false);

  async function refrescar() {
    const sede = await getSedeById(sedeId);
    const uids = sede?.productores ?? [];
    setAsignados(uids.length ? await adminGetUsersByIds(uids) : []);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const sede = await getSedeById(sedeId);
      const uids = sede?.productores ?? [];
      const users = uids.length ? await adminGetUsersByIds(uids) : [];
      if (active) setAsignados(users);
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, [sedeId]);

  async function buscar() {
    setBuscando(true);
    try {
      setResultados(await adminSearchUsers(query));
    } catch {
      /* noop */
    } finally {
      setBuscando(false);
    }
  }

  async function asignar(uid: string) {
    setBusy(true);
    try {
      await adminAssignProductor(uid, sedeId);
      setResultados([]);
      setQuery("");
      await refrescar();
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }

  async function quitar(uid: string) {
    setBusy(true);
    try {
      await removeProductorFromSede(sedeId, uid);
      await refrescar();
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }

  const asignadosUids = new Set(asignados.map((u) => u.uid));

  return (
    <div>
      {asignados.length === 0 ? (
        <p className="text-silver-400 text-sm">
          {t("adminEstudios.noProductores")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {asignados.map((u) => (
            <li
              key={u.uid}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm text-white">
                {u.displayName || u.email || u.uid}
              </span>
              <button
                type="button"
                onClick={() => quitar(u.uid)}
                disabled={busy}
                aria-label={t("adminEstudios.quitarProductor")}
                className="text-silver-400 flex size-7 shrink-0 items-center justify-center rounded transition hover:bg-red-500/15 hover:text-red-200 disabled:opacity-40"
              >
                <TrashIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          placeholder={t("adminEstudios.buscarUsuario")}
          className="flex-1 rounded-lg bg-white/[0.06] px-3 py-2 text-sm text-white ring-1 ring-white/20 transition outline-none ring-inset placeholder:text-white/35 focus:ring-white/50"
        />
        <button
          type="button"
          onClick={buscar}
          disabled={buscando}
          className="text-silver-200 hover:border-amethyst-300/60 rounded-lg border border-white/15 px-3 text-sm transition hover:text-white disabled:opacity-40"
        >
          {buscando ? (
            <SpinnerIcon className="size-4 animate-spin" />
          ) : (
            t("adminEstudios.buscar")
          )}
        </button>
      </div>

      {resultados.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {resultados.map((u) => {
            const ya = asignadosUids.has(u.uid);
            return (
              <li
                key={u.uid}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm"
              >
                <span className="text-silver-200 min-w-0 truncate">
                  {u.displayName || u.email || u.uid}
                </span>
                <button
                  type="button"
                  onClick={() => asignar(u.uid)}
                  disabled={busy || ya}
                  className="text-amethyst-200 hover:border-amethyst-300/60 inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs transition disabled:opacity-40"
                >
                  <PlusIcon className="size-3" />
                  {ya
                    ? t("adminEstudios.yaAsignado")
                    : t("adminEstudios.asignar")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
