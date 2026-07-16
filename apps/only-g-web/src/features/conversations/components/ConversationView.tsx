"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/components/AuthProvider";
import {
  subscribeConversation,
  subscribeMessages,
  sendConversationMessage,
} from "../lib/conversations-repo";
import type {
  Conversation,
  ConversationMessage,
} from "@only-g/shared-types/conversation";
import { puedeEscribir } from "@only-g/shared-types/conversation";
import { hasRole } from "@only-g/shared-types/user";
import { formatCOP } from "@only-g/shared-types/service";
import { Button } from "@/components/ui/Button";
import { PagoPanel } from "./PagoPanel";

/**
 * Render de una conversación: hilo de mensajes (con tipos estructurados que se
 * traducen al idioma del lector) + caja de escritura. Respeta el bloqueo: solo
 * se puede escribir cuando el hilo está `abierto`. Reemplaza al antiguo Thread,
 * ahora sobre el modelo `conversations`.
 */
export function ConversationView({
  conversationId,
}: {
  conversationId: string;
}) {
  const { user, account } = useAuth();
  const t = useTranslations();
  const isAdmin = hasRole(account, "admin");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => subscribeConversation(conversationId, setConversation),
    [conversationId],
  );
  useEffect(
    () => subscribeMessages(conversationId, setMessages),
    [conversationId],
  );
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const writable = conversation ? puedeEscribir(conversation) : false;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !user) return;
    setBusy(true);
    try {
      await sendConversationMessage(conversationId, {
        from: user.uid,
        tipo: "mensaje",
        texto: trimmed,
      });
      setText("");
    } catch (err) {
      console.error("[conversation] error:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-4">
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-silver-400">
            {t("chat.noMessages")}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.from === user?.uid;
            const sistema = m.from === "sistema";
            return (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  sistema
                    ? "self-center bg-white/5 text-xs text-silver-400"
                    : mine
                      ? "self-end bg-amethyst-500/20 text-white"
                      : "self-start bg-white/10 text-silver-100"
                }`}
              >
                {m.tipo === "comprobante" && (
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-silver-300">
                    {t("chat.receipt")}
                  </p>
                )}
                {m.tipo === "propuesta" && (
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amethyst-200">
                    {t("chat.proposal")}
                    {m.price != null ? ` · ${formatCOP(m.price)}` : ""}
                  </p>
                )}
                {m.tipo === "metodo" && m.metodo && (
                  <p className="whitespace-pre-wrap">
                    {t("chat.method", { metodo: t(`chat.metodos.${m.metodo}`) })}
                  </p>
                )}
                {m.tipo === "pago_confirmado" && (
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                    {t("chat.paymentConfirmed")}
                    {m.monto != null ? ` · ${formatCOP(m.monto)}` : ""}
                  </p>
                )}
                {m.tipo === "estado" && m.estado && (
                  <p className="whitespace-pre-wrap">
                    {t("chat.statusChanged", {
                      status: t(`status.${m.estado}`),
                    })}
                  </p>
                )}
                {m.texto && <p className="whitespace-pre-wrap">{m.texto}</p>}
                {m.attachmentUrl && (
                  <a
                    href={m.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-amethyst-200 underline underline-offset-2 hover:text-white"
                  >
                    {m.attachmentName ?? t("chat.viewFile")}
                  </a>
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {conversation?.type === "pago" && (
        <PagoPanel
          conversation={conversation}
          uid={user?.uid}
          isAdmin={isAdmin}
        />
      )}

      {writable ? (
        <form onSubmit={enviar} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("chat.placeholder")}
            className="flex-1 rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80"
          />
          <Button type="submit" loading={busy}>
            {t("chat.send")}
          </Button>
        </form>
      ) : conversation?.status === "cerrado" ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-silver-400">
          {t("chat.lockedClosed")}
        </p>
      ) : conversation?.type !== "pago" ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-silver-400">
          {t("chat.lockedWaiting")}
        </p>
      ) : null}
    </div>
  );
}
