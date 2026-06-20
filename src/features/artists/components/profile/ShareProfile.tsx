"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  ShareIcon,
} from "@/components/icons";

/**
 * Compartir el perfil: enlace directo + copiar + Web Share (móvil) + código QR
 * generado en cliente (sin servicios externos). La URL se arma con el origin
 * real en el navegador (por eso vive en un efecto, no en SSR).
 */
export function ShareProfile({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUrl(`${window.location.origin}/artistas/${slug}`);
  }, [slug]);

  useEffect(() => {
    if (!open || !url) return;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 240,
      color: { dark: "#0b0b0f", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [open, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sin clipboard: el usuario puede copiar a mano */
    }
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: name, url });
      } catch {
        /* el usuario canceló */
      }
    }
  }

  // En estado (no en render) para no romper la hidratación: el server no conoce
  // `navigator`, así que el primer render cliente debe coincidir (false) y luego
  // se actualiza en el efecto.
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
      >
        <ShareIcon className="size-5" />
        Compartir
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 text-white/60 transition hover:text-white"
            >
              <CloseIcon className="size-5" />
            </button>

            <h3 className="font-narrow text-2xl font-bold uppercase text-white">
              Compartir perfil
            </h3>
            <p className="mt-1 text-sm text-silver-400">{name}</p>

            <div className="mt-5 flex justify-center">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr}
                  alt="Código QR del perfil"
                  className="size-48 rounded-xl"
                />
              ) : (
                <div className="grid size-48 place-items-center rounded-xl border border-white/10 text-sm text-silver-500">
                  Generando…
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
              <span className="min-w-0 flex-1 truncate px-2 text-sm text-silver-300">
                {url}
              </span>
              <button
                type="button"
                onClick={copy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                {copied ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <CopyIcon className="size-4" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>

            {canNativeShare && (
              <button
                type="button"
                onClick={nativeShare}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-5 py-3 text-sm font-semibold uppercase tracking-[2px] text-ink"
              >
                <ShareIcon className="size-4" />
                Compartir…
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
