"use client";

import { useEffect, useRef, useState } from "react";
import { PlayIcon, PauseIcon, ExpandIcon } from "@/components/icons";
import { useTrackPlay } from "./ProfileMetricsContext";

/** "1:24" a partir de segundos. */
function fmt(sec: number): string {
  if (!Number.isFinite(sec)) return "0:00";
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Player de video de la media destacada (§04), con controles PROPIOS (como el
 * mockup): botón central play/pausa, barra de progreso arrastrable, tiempo y
 * pantalla completa. Los clips MUDOS arrancan en bucle; los de AUDIO, pausados.
 */
export function FeaturedVideoPlayer({
  src,
  muted,
  name,
  accent,
}: {
  src: string;
  muted: boolean;
  name: string;
  accent?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const countPlay = useTrackPlay();
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  // Los clips mudos se autoreproducen (fondo); los de audio esperan al visitante.
  useEffect(() => {
    const v = ref.current;
    if (v && muted) void v.play().catch(() => {});
  }, [src, muted]);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      // Solo cuenta el play DELIBERADO: los clips mudos arrancan solos como
      // fondo y contarlos inflaría las cifras sin que nadie los haya visto.
      countPlay("destacado", name);
      void v.play().catch(() => {});
    } else v.pause();
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const v = ref.current;
    if (!v || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
  }
  function fullscreen() {
    void ref.current?.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="group bg-ink-soft relative aspect-video overflow-hidden rounded-2xl border border-white/10">
      <video
        ref={ref}
        src={src}
        muted={muted}
        loop
        playsInline
        aria-label={name}
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={() => setCur(ref.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDur(ref.current?.duration ?? 0)}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Botón central (visible al pausar; se oculta al reproducir). */}
      {!playing && (
        <button
          type="button"
          onClick={toggle}
          aria-label={name}
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid size-16 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/30 backdrop-blur-sm transition group-hover:scale-105">
            <PlayIcon className="size-7 translate-x-0.5" />
          </span>
        </button>
      )}

      {/* Barra inferior: play/pausa · tiempo · progreso · pantalla completa. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-linear-to-t from-black/75 to-transparent px-3 pt-8 pb-3"
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pausar" : "Reproducir"}
          className="shrink-0 text-white/90 hover:text-white"
        >
          {playing ? (
            <PauseIcon className="size-5" />
          ) : (
            <PlayIcon className="size-5" />
          )}
        </button>
        <span className="shrink-0 text-xs text-white/80 tabular-nums">
          {fmt(cur)}
        </span>
        <div
          onClick={seek}
          className="h-1.5 flex-1 cursor-pointer rounded-full bg-white/20"
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${dur ? (cur / dur) * 100 : 0}%`,
              backgroundColor: accent ?? "#a87bff",
            }}
          />
        </div>
        <span className="shrink-0 text-xs text-white/80 tabular-nums">
          {fmt(dur)}
        </span>
        <button
          type="button"
          onClick={fullscreen}
          aria-label="Pantalla completa"
          className="shrink-0 text-white/90 hover:text-white"
        >
          <ExpandIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
