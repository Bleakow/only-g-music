"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type WaveSurfer from "wavesurfer.js";
import type { Region } from "wavesurfer.js/dist/plugins/regions.esm.js";
import { glassSurface, GlassSheen } from "@/components/ui/glass";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  CloseIcon,
  PlayIcon,
  PauseIcon,
  ScissorsIcon,
  SpinnerIcon,
} from "@/components/icons";
import { trimAudioFileToMp3 } from "../../lib/audio-trim";

/** Tope blando de la región (segundos). El artista puede elegir hasta aquí. */
export const MAX_TRACK_SECONDS = 60;

/** "0:07" / "1:05" a partir de segundos. */
function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Modal "Liquid Glass" para RECORTAR una canción antes de subirla. Pinta la onda
 * con wavesurfer.js (cargado en diferido: client-only y fuera del bundle inicial)
 * y deja arrastrar/redimensionar una región — ese tramo es el que se sube. El
 * corte real + encode MP3 vive en `audio-trim.ts`; aquí solo orquestamos la UI.
 *
 * Chrome propio (portal a <body>) en vez de `GlassModal` para: (1) garantizar que
 * el contenedor de la onda está en el DOM cuando inicializamos wavesurfer, y
 * (2) bloquear el cierre mientras se procesa. Misma receta de cristal (`glass`).
 */
export function AudioTrimModal({
  file,
  accent,
  maxSeconds = MAX_TRACK_SECONDS,
  onCancel,
  onConfirm,
}: {
  file: File;
  accent: string;
  maxSeconds?: number;
  onCancel: () => void;
  /** El padre sube el Blob y cierra el modal. Mientras la promesa viva, el modal
   *  mantiene el estado "procesando" (no se puede cerrar). */
  onConfirm: (blob: Blob, durationSec: number) => Promise<void> | void;
}) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionRef = useRef<Region | null>(null);

  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => setMounted(true), []);

  // Cierre con Esc + bloqueo de scroll del fondo (deshabilitados al procesar).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !processing) onCancel();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel, processing]);

  // Inicializa wavesurfer cuando el contenedor ya está en el DOM. Carga la lib en
  // diferido para no arrastrarla al bundle inicial ni romper el SSR.
  useEffect(() => {
    if (!mounted) return;
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let ws: WaveSurfer | null = null;

    (async () => {
      try {
        const [{ default: WaveSurferCtor }, { default: RegionsPlugin }] =
          await Promise.all([
            import("wavesurfer.js"),
            import("wavesurfer.js/dist/plugins/regions.esm.js"),
          ]);
        if (destroyed) return;

        const regions = RegionsPlugin.create();
        ws = WaveSurferCtor.create({
          container,
          height: 96,
          waveColor: "rgba(255,255,255,0.30)",
          progressColor: "rgba(255,255,255,0.65)",
          cursorColor: "#ffffff",
          cursorWidth: 2,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          dragToSeek: true,
          plugins: [regions],
        });
        wsRef.current = ws;

        ws.on("ready", (duration) => {
          const end = Math.min(maxSeconds, duration);
          const region = regions.addRegion({
            start: 0,
            end,
            drag: true,
            resize: true,
            color: `${accent}40`,
            minLength: 1,
            maxLength: maxSeconds,
          });
          regionRef.current = region;
          setSel({ start: region.start, end: region.end });
          setReady(true);
        });
        ws.on("play", () => setPlaying(true));
        ws.on("pause", () => setPlaying(false));
        ws.on("finish", () => setPlaying(false));
        ws.on("error", () => setError(true));
        regions.on("region-updated", (region) =>
          setSel({ start: region.start, end: region.end }),
        );

        await ws.loadBlob(file);
      } catch {
        if (!destroyed) setError(true);
      }
    })();

    return () => {
      destroyed = true;
      ws?.destroy();
      wsRef.current = null;
      regionRef.current = null;
    };
  }, [mounted, file, accent, maxSeconds]);

  const togglePreview = useCallback(() => {
    const ws = wsRef.current;
    const region = regionRef.current;
    if (!ws || !region) return;
    if (ws.isPlaying()) ws.pause();
    else region.play(true); // desde el inicio de la región, para al final
  }, []);

  async function handleConfirm() {
    const region = regionRef.current;
    if (!region) return;
    wsRef.current?.pause();
    setProcessing(true);
    setProgress(0);
    setError(false);
    try {
      const blob = await trimAudioFileToMp3(
        file,
        region.start,
        region.end,
        setProgress,
      );
      await onConfirm(blob, region.end - region.start);
      // El padre desmonta el modal al terminar; no tocamos estado tras await.
    } catch {
      setProcessing(false);
      setError(true);
    }
  }

  if (!mounted) return null;

  const length = Math.max(0, sel.end - sel.start);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !processing) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("profileBuilder.trim.title")}
        className={`${glassSurface} w-full max-w-xl rounded-3xl p-6`}
      >
        <GlassSheen />
        <div className="relative">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            aria-label={t("common.close")}
            className="absolute right-0 top-0 flex size-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            <CloseIcon className="size-5" />
          </button>

          <h2 className="mb-1 flex items-center gap-2 pr-10 font-narrow text-xl font-bold uppercase tracking-wide text-white">
            <ScissorsIcon className="size-5" style={{ color: accent }} />
            {t("profileBuilder.trim.title")}
          </h2>
          <p className="mb-5 text-sm text-silver-300">
            {t("profileBuilder.trim.hint", { max: maxSeconds })}
          </p>

          {/* Onda + región (cristal interior). wavesurfer pinta dentro. */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4">
            <div ref={containerRef} className="min-h-24 w-full" />
            {!ready && !error && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-silver-300">
                <SpinnerIcon className="size-4 animate-spin" />
                {t("profileBuilder.trim.loading")}
              </div>
            )}
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {t("profileBuilder.trim.error")}
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="font-mono text-silver-200">
                {fmt(sel.start)} – {fmt(sel.end)}
              </span>
              <span className="text-silver-400">
                {t("profileBuilder.trim.length", { value: fmt(length) })}
              </span>
            </div>
          )}

          {/* Progreso del recorte/subida */}
          {processing && (
            <div className="mt-4">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full transition-[width] duration-150"
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: accent,
                  }}
                />
              </div>
              <p className="mt-2 text-center text-xs text-silver-300">
                {progress < 1
                  ? t("profileBuilder.trim.processing")
                  : t("profileBuilder.trim.uploading")}
              </p>
            </div>
          )}

          {/* Acciones */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <GlassButton
              onClick={togglePreview}
              disabled={!ready || processing}
            >
              {playing ? (
                <PauseIcon className="size-4" />
              ) : (
                <PlayIcon className="size-5" />
              )}
              {t("profileBuilder.trim.preview")}
            </GlassButton>
            <GlassButton onClick={onCancel} disabled={processing}>
              {t("profileBuilder.trim.cancel")}
            </GlassButton>
            <GlassButton
              onClick={handleConfirm}
              disabled={!ready || processing || error}
              className="!text-white ring-white/50"
            >
              {processing ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <ScissorsIcon className="size-4" />
              )}
              {t("profileBuilder.trim.confirm")}
            </GlassButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
