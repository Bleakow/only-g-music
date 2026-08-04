"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ShareIcon,
} from "@/components/icons";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { renderShareCard } from "../../lib/share-card";
import { trackShare } from "../../lib/metrics-client";

/**
 * Compartir el perfil. Dos formas, porque no sirven para lo mismo: el ENLACE
 * (copiar / hoja del sistema) para mandarlo por chat, y una ESTAMPA con el QR
 * sobre la foto del artista para subirla a una historia o imprimirla en un flyer.
 *
 * La estampa se genera en un canvas (ver `share-card.ts`) y lo que se ve en el
 * modal es ya la imagen final: la vista previa y lo que se descarga no pueden
 * desviarse porque son el mismo PNG.
 *
 * `locked` = el dueño aún no tiene membresía: compartir un borrador no tiene
 * sentido (nadie más lo encuentra), así que en su lugar mostramos un aviso con
 * `payButton` para que active la membresía ahí mismo.
 */
export function ShareProfile({
  slug,
  name,
  photoUrl,
  locked = false,
  payButton,
}: {
  slug: string;
  name: string;
  photoUrl?: string | null;
  locked?: boolean;
  payButton?: ReactNode;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const [card, setCard] = useState<Blob | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [cardError, setCardError] = useState(false);

  // La URL se arma con el origin real del navegador (no hay SSR que valga).
  useEffect(() => {
    if (typeof window === "undefined") return;
    setUrl(`${window.location.origin}/artistas/${slug}`);
  }, [slug]);

  // Genera la estampa al abrir. `cancelado` evita pintar el resultado de una
  // generación vieja si el modal se cerró (o cambió el perfil) por el camino.
  useEffect(() => {
    if (!open || locked || !url) return;
    let cancelado = false;
    let creada: string | null = null;

    setCardError(false);
    renderShareCard({
      url,
      name,
      photoUrl,
      brand: t("shareProfile.cardBrand"),
      caption: t("shareProfile.cardCaption"),
      badge: t("shareProfile.cardBadge"),
    })
      .then((blob) => {
        if (cancelado) return;
        creada = URL.createObjectURL(blob);
        setCard(blob);
        setCardUrl(creada);
      })
      .catch(() => {
        if (!cancelado) setCardError(true);
      });

    return () => {
      cancelado = true;
      // Sin revocar, cada apertura del modal deja un PNG de ~1 MB retenido.
      if (creada) URL.revokeObjectURL(creada);
      setCard(null);
      setCardUrl(null);
    };
  }, [open, locked, url, name, photoUrl, t]);

  // En estado (no en render) para no romper la hidratación: el servidor no
  // conoce `navigator`, así que el primer render cliente debe coincidir (false).
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  // Compartir FICHEROS es otra capacidad que compartir un enlace: Android y iOS
  // la tienen, casi ningún escritorio. Se pregunta con el fichero real porque
  // `canShare` decide según el tipo, no solo según el navegador.
  const [canShareImage, setCanShareImage] = useState(false);
  useEffect(() => {
    if (!card) {
      setCanShareImage(false);
      return;
    }
    const file = new File([card], fileName(slug), { type: "image/png" });
    setCanShareImage(
      typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] }),
    );
  }, [card, slug]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackShare(slug, "copy");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* sin clipboard: el usuario puede copiar a mano */
    }
  }

  async function nativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({ title: name, url });
      // Solo cuenta si NO lanzó: si el usuario cancela la hoja de compartir,
      // `share()` rechaza y no hay nada que contar.
      trackShare(slug, "native");
    } catch {
      /* el usuario canceló */
    }
  }

  function downloadCard() {
    if (!cardUrl) return;
    const a = document.createElement("a");
    a.href = cardUrl;
    a.download = fileName(slug);
    a.click();
    trackShare(slug, "qr");
  }

  async function shareCard() {
    if (!card) return;
    const file = new File([card], fileName(slug), { type: "image/png" });
    try {
      await navigator.share({ files: [file], title: name, text: url });
      trackShare(slug, "qr");
    } catch {
      /* el usuario canceló */
    }
  }

  return (
    <>
      <GlassButton onClick={() => setOpen(true)}>
        <ShareIcon className="size-5" />
        {/* En móvil solo el icono (el espacio es escaso); texto desde sm:. */}
        <span className="hidden sm:inline">{t("shareProfile.share")}</span>
      </GlassButton>

      {/* Borrador (sin membresía): en vez de compartir, invitamos a publicar. */}
      <GlassModal
        open={open && locked}
        onClose={() => setOpen(false)}
        title={t("shareProfile.lockedTitle")}
      >
        <p className="text-silver-300 text-sm">
          {t("shareProfile.lockedMessage")}
        </p>
        {payButton && <div className="mt-6 flex justify-end">{payButton}</div>}
      </GlassModal>

      <GlassModal
        open={open && !locked}
        onClose={() => setOpen(false)}
        title={t("shareProfile.title")}
      >
        <div className="flex flex-col items-center">
          {/* Vista previa: relación 4:5 fija para que el hueco no salte cuando
              la imagen entra, y acotada en alto para caber en un móvil. */}
          <div className="relative w-full max-w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="aspect-[4/5] w-full">
              {cardUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cardUrl}
                  alt={t("shareProfile.qrAlt")}
                  className="size-full object-cover"
                />
              ) : (
                <div className="text-silver-500 grid size-full place-items-center px-6 text-center text-sm">
                  {cardError
                    ? t("shareProfile.cardError")
                    : t("shareProfile.preparing")}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid w-full max-w-[300px] grid-cols-2 gap-2">
            <button
              type="button"
              onClick={downloadCard}
              disabled={!cardUrl}
              className="btn-outline flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold tracking-[1px] uppercase disabled:cursor-not-allowed disabled:opacity-40"
            >
              <DownloadIcon className="size-4" />
              {t("shareProfile.download")}
            </button>
            <button
              type="button"
              onClick={canShareImage ? shareCard : copy}
              disabled={!cardUrl && canShareImage}
              className="btn-amethyst flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold tracking-[1px] uppercase disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShareIcon className="size-4" />
              {canShareImage
                ? t("shareProfile.shareImage")
                : t("shareProfile.copy")}
            </button>
          </div>
        </div>

        <div className="my-5 h-px bg-white/[0.08]" />

        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <span className="text-silver-300 min-w-0 flex-1 truncate px-2 text-sm">
            {url}
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            {copied ? (
              <CheckIcon className="size-4" />
            ) : (
              <CopyIcon className="size-4" />
            )}
            {copied ? t("shareProfile.copied") : t("shareProfile.copy")}
          </button>
        </div>

        {canNativeShare && (
          <button
            type="button"
            onClick={nativeShare}
            className="text-silver-400 mt-3 inline-flex w-full items-center justify-center gap-2 text-xs font-semibold tracking-[1px] uppercase transition hover:text-white"
          >
            <ShareIcon className="size-3.5" />
            {t("shareProfile.shareLink")}
          </button>
        )}
      </GlassModal>
    </>
  );
}

function fileName(slug: string): string {
  return `${slug}-only-g.png`;
}
