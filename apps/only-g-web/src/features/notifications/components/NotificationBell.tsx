"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { glassSurfaceMenu, GlassSheen } from "@/components/ui/glass";
import { IconButton } from "@/components/ui/IconButton";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BellIcon, CheckIcon } from "@/components/icons";
import type { Notificacion } from "@only-g/shared-types/notification";
import {
  subscribeNotificaciones,
  marcarLeido,
  marcarTodoLeido,
} from "../lib/notifications-repo";
import { tiempoRelativo } from "../lib/tiempo-relativo";
import { activarPush, pushDisponible, permisoPush } from "../lib/push";

// Posición del conjunto. `left` (default): extremo IZQUIERDO de la home (la
// campanita primera, el avatar a su derecha). `right`: topbar del panel admin.
const WRAP_LEFT = "fixed top-4 left-6 z-[105] sm:top-5 sm:left-12";
const WRAP_RIGHT = "fixed top-4 right-6 z-[105] sm:top-5 sm:right-12";

/**
 * Campanita de notificaciones (estilo Inbox): contador de no leídas en tiempo
 * real, panel con tabs (no leídas / todas), tiempo relativo y deep link al panel
 * donde se actúa. El texto se traduce al idioma ACTUAL desde `evento`+`params`
 * (no se guarda resuelto). Solo se muestra con sesión iniciada.
 */
export function NotificationBell({
  align = "left",
}: {
  align?: "left" | "right";
}) {
  const { user } = useAuth();
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<Notificacion[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const [pushState, setPushState] = useState<NotificationPermission | null>(
    null,
  );
  const [pushBusy, setPushBusy] = useState(false);

  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid) {
      setItems([]);
      return;
    }
    return subscribeNotificaciones(uid, setItems);
  }, [uid]);

  // Push: si ya hay permiso, refresca el token en silencio; si no, el usuario lo
  // activa desde el botón del panel (sin pedir permiso al cargar — nada intrusivo).
  useEffect(() => {
    if (!uid) return;
    setPushState(permisoPush());
    if (permisoPush() === "granted") activarPush(uid);
  }, [uid]);

  // Cerrar al clic fuera (el panel es hijo de `ref`, aunque vaya `fixed`).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
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

  const wrap = align === "right" ? WRAP_RIGHT : WRAP_LEFT;

  return (
    <div ref={ref} className={wrap}>
      <IconButton
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notificaciones.title")}
        aria-expanded={open}
        active={open}
      >
        <BellIcon className="size-5" />
        {count > 0 && (
          <span className="bg-amethyst-400 text-ink absolute -top-0.5 -right-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[0.65rem] font-bold ring-2 ring-black/50">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </IconButton>

      <AnimatePresence>
        {open && (
          <motion.div
            className={`fixed top-[4.5rem] w-[min(22rem,calc(100vw-1.5rem))] sm:top-[5.25rem] ${
              align === "right" ? "right-3 sm:right-4" : "left-3 sm:left-4"
            }`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: -10 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: -10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              transformOrigin: align === "right" ? "top right" : "top left",
            }}
          >
            <div className={`${glassSurfaceMenu} overflow-hidden rounded-2xl`}>
            <GlassSheen />
            <div className="relative [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <p className="font-narrow text-lg font-bold tracking-wide text-white uppercase">
                  {t("notificaciones.title")}
                </p>
                {count > 0 && (
                  <button
                    type="button"
                    onClick={todoLeido}
                    className="text-amethyst-200 flex items-center gap-1 text-xs transition hover:text-white"
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
                    className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase transition ${
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
                  <p className="text-silver-400 px-3 py-10 text-center text-sm">
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
                            <span className="text-silver-300 block text-xs">
                              {cuerpo(n)}
                            </span>
                            <span className="text-silver-500 mt-0.5 block text-[0.65rem] tracking-wide uppercase">
                              {tiempoRelativo(n.createdAt, locale)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer: activar push en este dispositivo (no intrusivo) */}
              {pushDisponible() && pushState !== "granted" && (
                <div className="border-t border-white/10 p-3">
                  {pushState === "denied" ? (
                    <p className="text-silver-500 text-center text-xs">
                      {t("notificaciones.pushBlocked")}
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={pushBusy}
                      onClick={async () => {
                        setPushBusy(true);
                        await activarPush(uid);
                        setPushState(permisoPush());
                        setPushBusy(false);
                      }}
                      className="border-amethyst-400/40 text-amethyst-200 hover:border-amethyst-300 hover:bg-amethyst-500/10 flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold tracking-wide uppercase transition hover:text-white disabled:opacity-50"
                    >
                      <BellIcon className="size-3.5" />
                      {pushBusy
                        ? t("notificaciones.activating")
                        : t("notificaciones.enablePush")}
                    </button>
                  )}
                </div>
              )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
