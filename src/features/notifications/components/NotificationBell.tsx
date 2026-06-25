"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { glassSurfaceMenu, GlassSheen } from "@/components/ui/glass";
import { BellIcon, CheckIcon } from "@/components/icons";
import type { Notificacion } from "@/domain/notification";
import {
  subscribeNotificaciones,
  marcarLeido,
  marcarTodoLeido,
} from "../lib/notifications-repo";
import { tiempoRelativo } from "../lib/tiempo-relativo";

// A la izquierda del avatar del UserMenu (right-[5.5rem]/right-28), mismo eje.
const WRAP = "fixed top-4 right-[8.75rem] z-[105] sm:top-5 sm:right-40";

/**
 * Campanita de notificaciones (estilo Inbox): contador de no leídas en tiempo
 * real, panel con tabs (no leídas / todas), tiempo relativo y deep link al panel
 * donde se actúa. El texto se traduce al idioma ACTUAL desde `evento`+`params`
 * (no se guarda resuelto). Solo se muestra con sesión iniciada.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<Notificacion[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("unread");

  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid) {
      setItems([]);
      return;
    }
    return subscribeNotificaciones(uid, setItems);
  }, [uid]);

  // Cerrar al clic fuera (el panel es hijo de `ref`, aunque vaya `fixed`).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visibles = useMemo(() => items.filter((n) => !n.archivado), [items]);
  const noLeidas = useMemo(() => visibles.filter((n) => !n.leido), [visibles]);
  const lista = tab === "unread" ? noLeidas : visibles;
  const count = noLeidas.length;

  if (!uid) return null;

  function abrir(n: Notificacion) {
    setOpen(false);
    if (!n.leido) marcarLeido(uid as string, n.id).catch(() => {});
    router.push(n.ruta);
  }

  function todoLeido() {
    const ids = noLeidas.map((n) => n.id);
    if (ids.length) marcarTodoLeido(uid as string, ids).catch(() => {});
  }

  // El cuerpo lleva params; si un doc viene mal formado, no rompemos la campanita.
  function cuerpo(n: Notificacion): string {
    try {
      return t(
        `notificaciones.eventos.${n.evento}.cuerpo`,
        n.params as Record<string, string | number>,
      );
    } catch {
      return "";
    }
  }

  return (
    <div ref={ref} className={WRAP}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notificaciones.title")}
        aria-expanded={open}
        className="relative flex size-10 items-center justify-center rounded-full border border-white/25 bg-black/40 text-silver-100 backdrop-blur-sm transition hover:border-amethyst-300 hover:text-white"
      >
        <BellIcon className="size-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-amethyst-400 px-1 text-[0.65rem] font-bold text-ink ring-2 ring-black/50">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-3 top-[4.5rem] w-[min(22rem,calc(100vw-1.5rem))] sm:right-4 sm:top-[5.25rem]">
          <div className={`${glassSurfaceMenu} overflow-hidden rounded-2xl`}>
            <GlassSheen />
            <div className="relative [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <p className="font-narrow text-lg font-bold uppercase tracking-wide text-white">
                  {t("notificaciones.title")}
                </p>
                {count > 0 && (
                  <button
                    type="button"
                    onClick={todoLeido}
                    className="flex items-center gap-1 text-xs text-amethyst-200 transition hover:text-white"
                  >
                    <CheckIcon className="size-3.5" />
                    {t("notificaciones.markAllRead")}
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-2 pt-2">
                {(["unread", "all"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                      tab === k
                        ? "bg-white/10 text-white"
                        : "text-silver-400 hover:text-white"
                    }`}
                  >
                    {k === "unread"
                      ? `${t("notificaciones.tabUnread")}${count ? ` (${count})` : ""}`
                      : t("notificaciones.tabAll")}
                  </button>
                ))}
              </div>

              {/* Lista */}
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {lista.length === 0 ? (
                  <p className="px-3 py-10 text-center text-sm text-silver-400">
                    {tab === "unread"
                      ? t("notificaciones.emptyUnread")
                      : t("notificaciones.empty")}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {lista.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => abrir(n)}
                          className={`flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-white/5 ${
                            n.leido ? "opacity-65" : ""
                          }`}
                        >
                          <span
                            className={`mt-1.5 size-2 shrink-0 rounded-full ${
                              n.leido ? "bg-transparent" : "bg-amethyst-400"
                            }`}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-white">
                              {t(`notificaciones.eventos.${n.evento}.titulo`)}
                            </span>
                            <span className="block text-xs text-silver-300">
                              {cuerpo(n)}
                            </span>
                            <span className="mt-0.5 block text-[0.65rem] uppercase tracking-wide text-silver-500">
                              {tiempoRelativo(n.createdAt, locale)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
