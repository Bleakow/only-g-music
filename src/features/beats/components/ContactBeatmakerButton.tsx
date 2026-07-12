"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ChatIcon, CloseIcon, SpinnerIcon } from "@/components/icons";
import { useAuth } from "@/features/auth/components/AuthProvider";
import {
  ensureDirectConversation,
  sendConversationMessage,
} from "@/features/conversations/lib/conversations-repo";
import { openConversation } from "@/features/conversations/lib/open-conversation";

const TRIGGER =
  "flex w-full items-center justify-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs tracking-[1px] text-white/70 uppercase transition hover:border-amethyst-300/60 hover:text-amethyst-200 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Botón "Chat" autocontenido para contactar a un beatmaker desde el catálogo.
 * Al elegir un mensaje preset: asegura el hilo directo (idempotente por par) →
 * siembra el preset como mensaje del cliente → abre la burbuja global. Se
 * auto-oculta si el usuario ES el propio beatmaker (chatear consigo mismo no
 * tiene sentido). Sin sesión → redirige a login, igual que el botón "Comprar".
 * Todo cliente: reutiliza el chat existente sin tocar backend ni reglas.
 */
export function ContactBeatmakerButton({
  beatmakerUid,
  beatmakerNombre,
  beatTitulo,
  className,
}: {
  beatmakerUid: string;
  beatmakerNombre: string;
  beatTitulo: string;
  className?: string;
}) {
  const t = useTranslations();
  const { user } = useAuth();
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Chatear consigo mismo no tiene sentido: el propio beatmaker no se contacta.
  if (user && user.uid === beatmakerUid) return null;

  function onClick() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent("/beats")}`);
      return;
    }
    setError(false);
    setShowPicker(true);
  }

  async function enviarPreset(texto: string) {
    if (!user) return;
    setShowPicker(false);
    setBusy(true);
    setError(false);
    try {
      const id = await ensureDirectConversation(user.uid, beatmakerUid);
      await sendConversationMessage(id, {
        from: user.uid,
        tipo: "mensaje",
        texto,
      });
      openConversation(id);
    } catch (e) {
      console.error("[contact-beatmaker]:", e);
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const presets = [
    t("chat.presets.cotizarBeat", { titulo: beatTitulo }),
    t("chat.presets.crearIdea"),
  ];

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-label={t("chat.contactar")}
        className={className ? `${TRIGGER} ${className}` : TRIGGER}
      >
        {busy ? (
          <SpinnerIcon className="size-3.5 animate-spin" />
        ) : (
          <ChatIcon className="size-3.5" />
        )}
        {t("chat.contactar")}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-300">{t("chat.contactarError")}</p>
      )}

      {showPicker && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPicker(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              aria-label={t("chat.close")}
              className="absolute top-4 right-4 text-white/60 transition hover:text-white"
            >
              <CloseIcon className="size-5" />
            </button>

            <h3 className="font-narrow text-2xl font-bold text-white uppercase">
              {t("chat.contactarTitulo", { nombre: beatmakerNombre })}
            </h3>

            <ul className="mt-5 flex flex-col gap-2">
              {presets.map((texto) => (
                <li key={texto}>
                  <button
                    type="button"
                    onClick={() => enviarPreset(texto)}
                    className="hover:border-amethyst-300/60 w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-white transition hover:bg-white/[0.06]"
                  >
                    {texto}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
