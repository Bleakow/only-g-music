"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  subscribeMessages,
  sendMessage,
  type ThreadParent,
} from "../lib/thread-repo";
import type { ThreadMessage } from "@/domain/message";
import { formatCOP } from "@/domain/service";
import { Button } from "@/components/ui/Button";

export function Thread({
  parent,
  id,
  perspective = "cliente",
}: {
  parent: ThreadParent;
  id: string;
  /** Quién escribe desde esta vista (cliente o el estudio/admin). */
  perspective?: "cliente" | "estudio";
}) {
  const t = useTranslations();
  const [msgs, setMsgs] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeMessages(parent, id, setMsgs), [parent, id]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await sendMessage(parent, id, {
        from: perspective,
        tipo: "mensaje",
        texto: trimmed,
      });
      setText("");
    } catch (err) {
      console.error("[thread] error:", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-96 min-h-[8rem] flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-4">
        {msgs.length === 0 ? (
          <p className="m-auto text-sm text-silver-400">{t("thread.empty")}</p>
        ) : (
          msgs.map((m) => {
            const mine = m.from === perspective;
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
                {m.tipo === "propuesta" && (
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amethyst-200">
                    {t("thread.proposal")}
                    {m.price != null ? ` · ${formatCOP(m.price)}` : ""}
                  </p>
                )}
                {m.tipo === "comprobante" && (
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-silver-300">
                    {t("thread.receipt")}
                  </p>
                )}
                {m.tipo === "estado" && m.estado && (
                  <p className="whitespace-pre-wrap">
                    {t("thread.statusChanged", {
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
                    {m.attachmentName ?? t("thread.viewFile")}
                  </a>
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={enviar} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("thread.placeholder")}
          className="flex-1 rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80"
        />
        <Button type="submit" loading={busy}>
          {t("thread.send")}
        </Button>
      </form>
    </div>
  );
}
