"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { subscribeUserConversations } from "../lib/conversations-repo";
import {
  OPEN_CONVERSATION_EVENT,
  type OpenConversationDetail,
} from "../lib/open-conversation";
import { ConversationView } from "./ConversationView";
import type { Conversation } from "@only-g/shared-types/conversation";
import { IconButton } from "@/components/ui/IconButton";
import {
  ArrowLeftIcon,
  ChatIcon,
  CloseIcon,
  NoteIcon,
} from "@/components/icons";

// URL de la app hermana G Notes (escritor inteligente). Configurable por entorno;
// en dev G Notes corre en otro puerto (p. ej. 3001).
const GNOTES_URL =
  process.env.NEXT_PUBLIC_GNOTES_URL ?? "http://localhost:3001";

/**
 * Burbuja de chat flotante y global (solo con sesión iniciada). Colapsada es un
 * botón en la esquina; expandida muestra la lista de conversaciones del usuario
 * y, al abrir una, su hilo (ConversationView) con botón de volver.
 */
export function ConversationBubble() {
  const { user } = useAuth();
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [scrolled, setScrolled] = useState(false);

  const isHome = pathname === "/";
  // Perfiles de artista: llevan un reproductor de audio flotante abajo-derecha
  // que choca con el dock en móvil.
  const isProfile = /^\/(artistas\/[^/]+|artista\/)/.test(pathname);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }
    return subscribeUserConversations(user.uid, setConversations);
  }, [user]);

  // Abrir la burbuja en una conversación concreta desde fuera (p. ej. al crear
  // un chat de pago en ProfileBuilder).
  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<OpenConversationDetail>).detail?.conversationId;
      if (!id) return;
      setOpen(true);
      setActiveId(id);
    }
    window.addEventListener(OPEN_CONVERSATION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONVERSATION_EVENT, onOpen);
  }, []);

  // G Note en la home: solo en la PRIMERA pantalla (antes de scrollear). El
  // scroll solo importa en la home; en el resto se muestra siempre.
  useEffect(() => {
    if (!isHome) {
      setScrolled(false);
      return;
    }
    const onScroll = () =>
      setScrolled(window.scrollY > window.innerHeight * 0.5);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  // Sin sesión, no hay chat.
  if (!user) return null;

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // G Note: en la home solo antes de scrollear; en el resto, siempre.
  const showGNote = isHome ? !scrolled : true;

  if (!open) {
    // Dock flotante de herramientas (solo con sesión). En perfiles de artista se
    // oculta el dock entero en MÓVIL (choca con el reproductor de audio). G Note
    // abre la app hermana G Notes (escritor); badge "Nuevo". En la home solo se
    // ve en la primera pantalla; al scrollear se desvanece y queda solo el chat.
    return (
      <div
        className={`fixed right-5 z-50 ${
          isProfile ? "hidden sm:flex" : "flex"
        } flex-col items-center gap-3`}
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <AnimatePresence>
          {showGNote && (
            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <IconButton
                aria-label={t("gnote.aria")}
                title={t("gnote.soon")}
                onClick={() => {
                  window.location.href = GNOTES_URL;
                }}
              >
                <NoteIcon className="size-5" />
              </IconButton>
              <span className="pointer-events-none absolute -top-1 -right-1 rounded-full bg-amethyst-500 px-1.5 py-px text-[0.55rem] font-bold tracking-wide text-white uppercase shadow-[0_2px_8px_rgba(124,58,237,0.6)]">
                {t("gnote.badge")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <IconButton aria-label={t("chat.open")} onClick={() => setOpen(true)}>
          <ChatIcon className="size-6" />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[min(72vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        {activeId && (
          <button
            type="button"
            onClick={() => setActiveId(null)}
            aria-label={t("chat.back")}
            className="text-silver-300 transition hover:text-white"
          >
            <ArrowLeftIcon className="size-5" />
          </button>
        )}
        <h2 className="flex-1 truncate font-narrow text-lg font-bold uppercase text-white">
          {active ? t(`chat.types.${active.type}`) : t("chat.title")}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("chat.close")}
          className="text-silver-300 transition hover:text-white"
        >
          <CloseIcon className="size-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col p-3">
        {activeId ? (
          <ConversationView conversationId={activeId} />
        ) : conversations.length === 0 ? (
          <p className="m-auto max-w-[16rem] text-center text-sm text-silver-400">
            {t("chat.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 overflow-y-auto">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className="flex w-full flex-col gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-white/25"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-[2px] text-amethyst-300">
                      {t(`chat.types.${c.type}`)}
                    </span>
                  </span>
                  {c.lastMessage?.texto && (
                    <span className="truncate text-sm text-silver-300">
                      {c.lastMessage.texto}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
