"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { glassSurface, GlassSheen } from "@/components/ui/glass";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  CloseIcon,
  PlayIcon,
  PauseIcon,
  ScissorsIcon,
  SpinnerIcon,
} from "@/components/icons";
import { trimVideo } from "../../lib/video-trim";

/** Nº de miniaturas del filmstrip. */
const THUMBS = 8;
/** Selección mínima (segundos). */
const MIN_SEC = 1;

/** "0:07" a partir de segundos. */
function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type DragMode = "start" | "end" | "move";

/**
 * Modal "Liquid Glass" para RECORTAR un video antes de subirlo (estilo historia
 * de WhatsApp/Facebook): filmstrip de miniaturas + ventana de selección
 * arrastrable, acotada a `maxSeconds`. El corte real + re-encode (con bitrate
 * acotado para caber bajo `maxBytes`) vive en `video-trim.ts`. Chrome propio por
 * portal (como AudioTrimModal) para bloquear el cierre mientras procesa.
 */
export function VideoTrimModal({
  file,
  accent,
  maxSeconds,
  maxBytes,
  onCancel,
  onConfirm,
}: {
  file: File;
  accent: string;
  maxSeconds: number;
  maxBytes: number;
  onCancel: () => void;
  /** El padre sube el Blob (con su extensión) y cierra el modal. Mientras la
   *  promesa viva, el modal queda "procesando" (no se puede cerrar). */
  onConfirm: (blob: Blob, ext: string, durationSec: number) => Promise<void> | void;
}) {
  const t = useTranslations();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [src] = useState(() => URL.createObjectURL(file));
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [sel, setSel] = useState({ start: 0, end: 0 });
  const [playing, setPlaying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);

  // Espejo de `sel` para leerlo sin cierre obsoleto dentro de onTimeUpdate.
  const selRef = useRef(sel);
  selRef.current = sel;

  useEffect(() => setMounted(true), []);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

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

  // Miniaturas del filmstrip: video offscreen que se va posicionando y pinta
  // cada fotograma a un canvas pequeño (progresivo, para que aparezcan enseguida).
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.preload = "auto";
    const canvas = document.createElement("canvas");
    const out: string[] = [];

    v.onloadedmetadata = () => {
      const ratio = v.videoWidth ? v.videoHeight / v.videoWidth : 1.4;
      canvas.width = 96;
      canvas.height = Math.round(96 * ratio);
      let i = 0;
      const seekNext = () => {
        if (cancelled || i >= THUMBS) return;
        v.currentTime = Math.min(
          (v.duration / THUMBS) * (i + 0.5),
          Math.max(0, v.duration - 0.05),
        );
      };
      v.onseeked = () => {
        if (cancelled) return;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          out.push(canvas.toDataURL("image/jpeg", 0.6));
          setThumbs([...out]);
        }
        i++;
        seekNext();
      };
      seekNext();
    };
    v.onerror = () => {
      if (!cancelled) setError(true);
    };

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [mounted, file]);

  function timeAt(clientX: number): number {
    const el = stripRef.current;
    if (!el || !duration) return 0;
    const r = el.getBoundingClientRect();
    const ratio = (clientX - r.left) / r.width;
    return Math.max(0, Math.min(duration, ratio * duration));
  }

  function seekPreview(to: number) {
    const v = videoRef.current;
    if (v) v.currentTime = to;
  }

  // Arrastre de la ventana de selección (handles = redimensionar, cuerpo = mover),
  // acotado a [MIN_SEC, maxSeconds]. Captura el puntero hasta soltar.
  function startDrag(mode: DragMode, e: ReactPointerEvent) {
    if (processing) return;
    e.preventDefault();
    e.stopPropagation();
    const { start: s0, end: e0 } = selRef.current;
    const grab = timeAt(e.clientX) - s0; // offset para "move"
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const tt = timeAt(ev.clientX);
      if (mode === "start") {
        const ns = Math.min(tt, e0 - MIN_SEC);
        const clamped = Math.max(0, Math.max(ns, e0 - maxSeconds));
        setSel({ start: clamped, end: e0 });
        seekPreview(clamped);
      } else if (mode === "end") {
        const ne = Math.max(tt, s0 + MIN_SEC);
        const clamped = Math.min(duration, Math.min(ne, s0 + maxSeconds));
        setSel({ start: s0, end: clamped });
        seekPreview(clamped);
      } else {
        const len = e0 - s0;
        const ns = Math.max(0, Math.min(tt - grab, duration - len));
        setSel({ start: ns, end: ns + len });
        seekPreview(ns);
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function togglePreview() {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) {
      v.pause();
      return;
    }
    v.currentTime = sel.start;
    v.play().catch(() => {});
  }

  async function handleConfirm() {
    videoRef.current?.pause();
    setProcessing(true);
    setProgress(0);
    setError(false);
    try {
      const res = await trimVideo(
        file,
        sel.start,
        sel.end,
        { maxBytes, maxWidth: 720, fps: 30 },
        setProgress,
      );
      await onConfirm(res.blob, res.ext, res.durationSec);
      // El padre desmonta el modal al terminar; no tocamos estado tras await.
    } catch {
      setProcessing(false);
      setError(true);
    }
  }

  if (!mounted) return null;

  const length = Math.max(0, sel.end - sel.start);
  const startPct = duration ? (sel.start / duration) * 100 : 0;
  const endPct = duration ? (sel.end / duration) * 100 : 100;

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
        aria-label={t("profileBuilder.videoTrim.title")}
        className={`${glassSurface} w-full max-w-xl rounded-3xl p-6`}
      >
        <GlassSheen />
        <div className="relative">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            aria-label={t("common.close")}
            className="absolute top-0 right-0 flex size-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            <CloseIcon className="size-5" />
          </button>

          <h2 className="font-narrow mb-1 flex items-center gap-2 pr-10 text-xl font-bold tracking-wide text-white uppercase">
            <ScissorsIcon className="size-5" style={{ color: accent }} />
            {t("profileBuilder.videoTrim.title")}
          </h2>
          <p className="text-silver-300 mb-5 text-sm">
            {t("profileBuilder.videoTrim.hint", { max: maxSeconds })}
          </p>

          {/* Preview del video */}
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              src={src}
              muted
              playsInline
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration || 0;
                setDuration(d);
                setSel({ start: 0, end: Math.min(maxSeconds, d) });
                setReady(true);
              }}
              onTimeUpdate={() => {
                const v = videoRef.current;
                if (v && !v.paused && v.currentTime >= selRef.current.end) {
                  v.currentTime = selRef.current.start; // bucle dentro de la selección
                }
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              className="absolute inset-0 h-full w-full object-contain"
            />
            {!ready && !error && (
              <div className="text-silver-300 absolute inset-0 flex items-center justify-center gap-2 text-sm">
                <SpinnerIcon className="size-4 animate-spin" />
                {t("profileBuilder.videoTrim.loading")}
              </div>
            )}
            <button
              type="button"
              onClick={togglePreview}
              disabled={!ready || processing}
              aria-label={t("profileBuilder.videoTrim.preview")}
              className="absolute inset-0 grid place-items-center text-white/90 transition disabled:opacity-40"
            >
              <span className={`${glassSurface} grid size-14 place-items-center rounded-full`}>
                <GlassSheen />
                <span className="relative">
                  {playing ? (
                    <PauseIcon className="size-6" />
                  ) : (
                    <PlayIcon className="size-6 translate-x-0.5" />
                  )}
                </span>
              </span>
            </button>
          </div>

          {/* Filmstrip + ventana de selección */}
          <div className="mt-4">
            <div
              ref={stripRef}
              className="relative h-16 w-full touch-none overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] select-none"
            >
              {/* Miniaturas */}
              <div className="absolute inset-0 flex">
                {Array.from({ length: THUMBS }).map((_, i) => (
                  <div
                    key={i}
                    className="h-full flex-1 bg-cover bg-center opacity-70"
                    style={
                      thumbs[i] ? { backgroundImage: `url(${thumbs[i]})` } : undefined
                    }
                  />
                ))}
              </div>

              {/* Zonas descartadas (oscurecidas) a los lados de la selección */}
              <div
                className="absolute inset-y-0 left-0 bg-black/60"
                style={{ width: `${startPct}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-black/60"
                style={{ width: `${100 - endPct}%` }}
              />

              {/* Ventana de selección */}
              <div
                onPointerDown={(e) => startDrag("move", e)}
                className="absolute inset-y-0 cursor-grab active:cursor-grabbing"
                style={{
                  left: `${startPct}%`,
                  width: `${Math.max(0, endPct - startPct)}%`,
                  boxShadow: `inset 0 0 0 2px ${accent}`,
                  borderRadius: 10,
                }}
              >
                {/* Handle inicio */}
                <span
                  onPointerDown={(e) => startDrag("start", e)}
                  className="absolute top-0 -left-1 flex h-full w-3 cursor-ew-resize touch-none items-center justify-center rounded-l-lg"
                  style={{ backgroundColor: accent }}
                >
                  <span className="h-6 w-0.5 rounded bg-black/40" />
                </span>
                {/* Handle fin */}
                <span
                  onPointerDown={(e) => startDrag("end", e)}
                  className="absolute top-0 -right-1 flex h-full w-3 cursor-ew-resize touch-none items-center justify-center rounded-r-lg"
                  style={{ backgroundColor: accent }}
                >
                  <span className="h-6 w-0.5 rounded bg-black/40" />
                </span>
              </div>
            </div>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {t("profileBuilder.videoTrim.error")}
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-silver-200 font-mono">
                {fmt(sel.start)} – {fmt(sel.end)}
              </span>
              <span className="text-silver-400">
                {t("profileBuilder.videoTrim.length", { value: fmt(length) })}
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
              <p className="text-silver-300 mt-2 text-center text-xs">
                {progress < 1
                  ? t("profileBuilder.videoTrim.processing")
                  : t("profileBuilder.videoTrim.uploading")}
              </p>
            </div>
          )}

          {/* Acciones */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <GlassButton onClick={onCancel} disabled={processing}>
              {t("profileBuilder.videoTrim.cancel")}
            </GlassButton>
            <GlassButton
              onClick={handleConfirm}
              disabled={!ready || processing || error}
              className="ring-white/50 !text-white"
            >
              {processing ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <ScissorsIcon className="size-4" />
              )}
              {t("profileBuilder.videoTrim.confirm")}
            </GlassButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
