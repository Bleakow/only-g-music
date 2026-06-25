"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassModal } from "@/components/ui/GlassModal";
import { GlassButton } from "@/components/ui/GlassButton";
import { SpinnerIcon, CheckIcon } from "@/components/icons";
import {
  adminSearchUsers,
  adminLinkProfile,
  type AdminUserHit,
} from "../lib/admin-users-repo";

const inputCls =
  "w-full rounded-lg bg-white/[0.06] px-4 py-2.5 text-white outline-none ring-1 ring-inset ring-white/20 transition focus:ring-white/50 placeholder:text-white/40";

/**
 * Vincular un perfil NUEVO a un usuario real de la app: busca el usuario (vía
 * Cloud Function, el cliente no puede leer otros users), lo selecciona, pone el
 * nombre artístico y crea el perfil. Al crearlo, el servidor le asigna el rol
 * 'artista' (si no lo tenía). El perfil nace como borrador; la membresía se
 * activa luego desde la grilla.
 */
export function LinkUserModal({
  open,
  onClose,
  onLinked,
}: {
  open: boolean;
  onClose: () => void;
  onLinked: (slug: string) => void;
}) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<AdminUserHit | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Búsqueda con debounce mientras el modal está abierto.
  useEffect(() => {
    if (!open) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        setResults(await adminSearchUsers(query));
      } catch (e) {
        console.error("[link-user] search:", e);
        setError(t("adminPerfiles.link.errorBuscar"));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [query, open, t]);

  // Limpia el estado al cerrar.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setName("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  async function crear() {
    if (!selected || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const slug = await adminLinkProfile(selected.uid, name.trim());
      onLinked(slug);
    } catch (e) {
      console.error("[link-user] link:", e);
      const code = (e as { code?: string })?.code;
      setError(
        code === "functions/already-exists"
          ? t("adminPerfiles.link.errorYaTiene")
          : t("adminPerfiles.link.errorCrear"),
      );
      setBusy(false);
    }
  }

  return (
    <GlassModal
      open={open}
      onClose={() => !busy && onClose()}
      title={t("adminPerfiles.link.title")}
      className="max-w-lg"
    >
      <p className="text-sm text-silver-300">
        {t("adminPerfiles.link.descripcion")}
      </p>

      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
        placeholder={t("adminPerfiles.link.buscarPlaceholder")}
        autoFocus
        className={`mt-4 ${inputCls}`}
      />

      <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02]">
        {searching ? (
          <p className="flex items-center gap-2 p-4 text-sm text-silver-400">
            <SpinnerIcon className="size-4 animate-spin" />
            {t("adminPerfiles.link.buscando")}
          </p>
        ) : results.length === 0 ? (
          <p className="p-4 text-sm text-silver-400">
            {t("adminPerfiles.link.sinResultados")}
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {results.map((u) => {
              const yaArtista = u.roles.includes("artista");
              const yaVinculado = !!u.artistSlug;
              const sel = selected?.uid === u.uid;
              return (
                <li key={u.uid}>
                  <button
                    type="button"
                    disabled={yaVinculado}
                    onClick={() => {
                      setSelected(u);
                      if (!name) setName(u.displayName ?? "");
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/5 ${
                      sel ? "bg-amethyst-500/15" : ""
                    } ${yaVinculado ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {u.displayName ?? u.email ?? u.uid}
                      </p>
                      {u.email && (
                        <p className="truncate text-xs text-silver-400">
                          {u.email}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {yaArtista && (
                        <span className="rounded-full bg-amethyst-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amethyst-200">
                          {t("adminPerfiles.link.rolArtista")}
                        </span>
                      )}
                      {yaVinculado && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-silver-300">
                          {t("adminPerfiles.link.yaTiene")}
                        </span>
                      )}
                      {sel && <CheckIcon className="size-4 text-amethyst-200" />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && crear()}
          placeholder={t("adminPerfiles.link.nombrePlaceholder")}
          className={`mt-3 ${inputCls}`}
        />
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-end gap-3">
        <GlassButton onClick={onClose} disabled={busy}>
          {t("adminPerfiles.link.cancelar")}
        </GlassButton>
        <GlassButton
          onClick={crear}
          disabled={!selected || !name.trim() || busy}
          className="!text-amethyst-200"
        >
          {busy ? (
            <SpinnerIcon className="size-4 animate-spin" />
          ) : (
            <CheckIcon className="size-4" />
          )}
          {t("adminPerfiles.link.crear")}
        </GlassButton>
      </div>
    </GlassModal>
  );
}
