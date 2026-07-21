"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button, glassSurfaceMenu } from "@only-g/ui";

interface Props {
  open: boolean;
  title: string;
  body: string;
  genre?: string;
  onClose: () => void;
}

// Primeros versos "cantables" (sin líneas vacías ni marcadores [Sección]).
function fragment(body: string, max = 8): string[] {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^\[[^\]]+\]$/.test(l));
  return lines.slice(0, max);
}

/**
 * Comparte la letra como un LIENZO con la marca: se dibuja por Canvas (sin libs,
 * CSP-safe) a 1080×1350 y se descarga como PNG. El mismo canvas es la vista previa.
 */
export function ShareDialog({ open, title, body, genre, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fondo tinta + halo amatista contenido (arriba-izquierda).
    ctx.fillStyle = "#0b0910";
    ctx.fillRect(0, 0, W, H);
    const halo = ctx.createRadialGradient(W * 0.24, -40, 0, W * 0.24, -40, W);
    halo.addColorStop(0, "rgba(139,92,246,0.24)");
    halo.addColorStop(1, "rgba(139,92,246,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    const PX = 104;
    ctx.textBaseline = "alphabetic";

    // Marca
    ctx.fillStyle = "#b49bff";
    ctx.font = '600 27px system-ui, -apple-system, "Segoe UI", sans-serif';
    if ("letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        "8px";
    }
    ctx.fillText("G NOTES", PX, 150);
    if ("letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        "0px";
    }

    // Título (hasta 2 líneas)
    ctx.fillStyle = "#f6f5fb";
    ctx.font =
      '600 66px system-ui, -apple-system, "Segoe UI", sans-serif';
    let y = 250;
    y = wrap(ctx, title.trim() || "Sin título", PX, y, W - 2 * PX, 78, 2);

    // Letra en serif editorial
    y += 44;
    ctx.fillStyle = "#e6e3ef";
    ctx.font = '400 46px Georgia, "Times New Roman", serif';
    const lines = fragment(body);
    const maxY = H - 180;
    for (const line of lines) {
      if (y > maxY) {
        ctx.fillStyle = "#6b6b82";
        ctx.fillText("…", PX, y);
        break;
      }
      y = wrap(ctx, line, PX, y, W - 2 * PX, 70, 3);
    }

    // Pie
    ctx.fillStyle = "#6b6b82";
    ctx.font = '400 26px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillText(
      `— escrito en G Notes${genre ? ` · ${genre}` : ""}`,
      PX,
      H - 96,
    );
  }, [title, body, genre]);

  useEffect(() => {
    if (open) render();
  }, [open, render]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const fileName = `${(title.trim() || "letra")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")}-g-notes.png`;

  function download() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  function copyText() {
    const text = `${title.trim() || "Sin título"}\n\n${body.trim()}\n\n— escrito en G Notes`;
    void navigator.clipboard?.writeText(text).catch(() => {});
  }

  function shareNative() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      const text = `${title.trim() || "Sin título"} · G Notes`;
      const nav = navigator as Navigator & {
        canShare?: (d: unknown) => boolean;
      };
      if (blob && nav.share && nav.canShare?.({ files: [new File([blob], fileName)] })) {
        void nav
          .share({ files: [new File([blob], fileName, { type: "image/png" })], title: text })
          .catch(() => {});
      } else if (nav.share) {
        void nav.share({ title: text, text }).catch(() => {});
      }
    }, "image/png");
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`${glassSurfaceMenu} w-full max-w-sm rounded-2xl p-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-silver-300 transition hover:bg-white/10 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <h2 className="pr-8 text-base font-semibold text-silver-50">
          Compartir la letra
        </h2>
        <p className="mt-1 text-sm text-silver-300">
          Un lienzo con tu marca, listo para descargar o compartir.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-silver-200/10">
          <canvas
            ref={canvasRef}
            className="block h-auto w-full"
            aria-label="Vista previa de la letra para compartir"
          />
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={copyText}>
            Copiar texto
          </Button>
          {canShare && (
            <Button size="sm" variant="secondary" onClick={shareNative}>
              Compartir…
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={download}>
            Descargar imagen
          </Button>
        </div>
      </div>
    </div>
  );
}

// Dibuja texto con salto de línea por palabras hasta `maxLines`. Devuelve la Y final.
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines: number,
): number {
  const words = text.split(/\s+/);
  let line = "";
  let n = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineH;
      n += 1;
      line = w;
      if (n >= maxLines) {
        ctx.fillText("…", x, y);
        return y + lineH;
      }
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineH;
  }
  return y;
}
