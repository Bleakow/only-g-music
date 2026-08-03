"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { subscribeUserConversations } from "../lib/conversations-repo";
import {
  OPEN_CONVERSATION_EVENT,
  OPEN_CHAT_EVENT,
  type OpenConversationDetail,
} from "../lib/open-conversation";
import { ConversationView } from "./ConversationView";
import type { Conversation } from "@only-g/shared-types/conversation";
import { ArrowLeftIcon, CloseIcon } from "@/components/icons";

/**
 * PANEL de chat flotante y global (solo con sesión). Ya NO pinta su propio botón
 * colapsado: los disparadores (chat / G Notes) viven en el `AccountDock`. Se abre
 * vía eventos: `ogm:open-conversation` (un hilo concreto) u `ogm:open-chat` (el
 * inbox, sin hilo). Muestra la lista de conversaciones y, al abrir una, su hilo.
 */
export function ConversationBubble() {
  const { user } = useAuth();
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }
    return subscribeUserConversations(user.uid, setConversations);
  }, [user]);

  // Abrir en una conversación concreta desde fuera (p. ej. al crear un chat de
  // pago en ProfileBuilder).
  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<OpenConversationDetail>).detail
        ?.conversationId;
      if (!id) return;
      setActiveId(id);
      setOpen(true);
    }
    window.addEventListener(OPEN_CONVERSATION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONVERSATION_EVENT, onOpen);
  }, []);

  // Abrir el inbox (sin hilo) desde el botón de chat del dock global.
  useEffect(() => {
    function onOpenChat() {
      setActiveId(null);
      setOpen(true);
    }
    window.addEventListener(OPEN_CHAT_EVENT, onOpenChat);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpenChat);
  }, []);

  if (!user || !open) return null;

  const active = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="fixed right-5 bottom-5 z-50 flex h-[min(72vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
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
        <h2 className="font-narrow flex-1 truncate text-lg font-bold text-white uppercase">
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
          <p className="text-silver-400 m-auto max-w-[16rem] text-center text-sm">
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
                    <span className="text-amethyst-300 text-xs tracking-[2px] uppercase">
                      {t(`chat.types.${c.type}`)}
                    </span>
                  </span>
                  {c.lastMessage?.texto && (
                    <span className="text-silver-300 truncate text-sm">
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
