"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { subscribeUserConversations } from "../lib/conversations-repo";
import {
  OPEN_CONVERSATION_EVENT,
  type OpenConversationDetail,
} from "../lib/open-conversation";
import { ConversationView } from "./ConversationView";
import type { Conversation } from "@/domain/conversation";
import { ArrowLeftIcon, ChatIcon, CloseIcon } from "@/components/icons";

/**
 * Burbuja de chat flotante y global (solo con sesión iniciada). Colapsada es un
 * botón en la esquina; expandida muestra la lista de conversaciones del usuario
 * y, al abrir una, su hilo (ConversationView) con botón de volver.
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

  // Sin sesión, no hay chat.
  if (!user) return null;

  const active = conversations.find((c) => c.id === activeId) ?? null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("chat.open")}
        className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-amethyst-400 to-amethyst-600 text-white shadow-[0_8px_30px_rgba(139,92,246,0.5)] transition hover:scale-105 active:scale-95"
      >
        <ChatIcon className="size-6" />
      </button>
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
