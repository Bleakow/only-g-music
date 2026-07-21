"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GlassModal } from "@/components/ui/GlassModal";
import { DownloadIcon, ExpandIcon } from "@/components/icons";

/**
 * Descarga la imagen del QR. Firebase Storage puede bloquear el `fetch` por CORS;
 * en ese caso, abre la imagen en una pestaña nueva para guardarla a mano.
 */
async function descargarQr(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch");
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

const CHIP =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-silver-200 transition hover:border-amethyst-300/60 hover:text-white";

/**
 * QR de pago: miniatura que se abre en grande (modal) + botón de descarga rápida.
 * Compartido por el panel de pago inline (compra) y el PagoPanel del chat.
 */
export function PaymentQr({ url, label }: { url: string; label?: string }) {
  const t = useTranslations("pago");
  const [open, setOpen] = useState(false);
  const filename = "qr-pago.png";

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("qrExpand")}
        className="hover:ring-amethyst-300/60 rounded-lg ring-1 ring-white/10 transition"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label ?? ""}
          className="size-40 rounded-lg object-contain"
        />
      </button>

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => setOpen(true)} className={CHIP}>
          <ExpandIcon className="size-3.5" />
          {t("qrExpand")}
        </button>
        <button
          type="button"
          onClick={() => descargarQr(url, filename)}
          className={CHIP}
        >
          <DownloadIcon className="size-3.5" />
          {t("qrDownload")}
        </button>
      </div>

      <GlassModal open={open} onClose={() => setOpen(false)} title={t("qrTitle")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label ?? ""}
          className="mx-auto max-h-[65vh] w-full rounded-xl bg-white/5 object-contain p-2"
        />
        <button
          type="button"
          onClick={() => descargarQr(url, filename)}
          className="btn-amethyst mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold tracking-[2px] uppercase"
        >
          <DownloadIcon className="size-4" />
          {t("qrDownload")}
        </button>
      </GlassModal>
    </div>
  );
}
