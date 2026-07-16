"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import type { PlayerSize } from "@only-g/shared-types/artist-profile";
import {
  PlayIcon,
  PauseIcon,
  RepeatIcon,
  RewindIcon,
  ForwardIcon,
} from "@/components/icons";

export const PLAYER_SIZE_W: Record<PlayerSize, string> = {
  sm: "w-52",
  md: "w-64",
  lg: "w-80",
};

/**
 * Reproductor de la canción de fondo del perfil. Onda reactiva al sonido (Web
 * Audio; sintética si el bucket no tiene CORS) + barra de progreso + controles
 * ◀◀ ▶ ▶▶. Dos variantes: `card` (tarjeta debajo, con título/acento) y `overlay`
 * (SIN marco — solo líneas/botones blancos sobre la foto, sin estorbar; el padre
 * lo posiciona/dimensiona con `className`). Al hacer scroll aparece un mini-player.
 */
export function ProfileAudioPlayer({
  src,
  accent,
  title,
  variant = "card",
  className,
  dockBottomClass = "bottom-5",
  autoPlay = false,
}: {
  src: string;
  accent: string;
  title?: string;
  variant?: "card" | "overlay";
  className?: string;
  /** Posición vertical del dock flotante. En el editor se sube para no tapar la
   *  barra de guardado (que es fija al fondo). */
  dockBottomClass?: string;
  /** Intenta reproducir al montar; si el navegador lo bloquea, suena al primer
   *  gesto del visitante (clic/scroll/tecla/touch). Solo en el perfil público. */
  autoPlay?: boolean;
}) {
  const t = useTranslations("artistProfile");
  const resolvedTitle = title ?? t("profileSong");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const inlineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef(0);
  const barsRef = useRef<number[]>([]);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  // La canción de intro del perfil se repite por defecto (al terminar, vuelve a
  // empezar). En la tarjeta el botón ◴ permite apagar la repetición.
  const [loop, setLoop] = useState(true);
  const [docked, setDocked] = useState(false);
  const [noCors, setNoCors] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isOverlay = variant === "overlay";

  // El dock va por portal a <body>: si quedara dentro de un ancestro con
  // transform/backdrop-filter (el wrapper del overlay), `position: fixed` se
  // ancla a ESE ancestro y no al viewport, así que no se vería al hacer scroll.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setDocked(!e.isIntersecting), {
      threshold: 0,
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const ensureGraph = useCallback(() => {
    if (noCors || ctxRef.current || !audioRef.current) return;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctor();
      const source = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      analyserRef.current = null;
    }
  }, [noCors]);

  const paintAll = useCallback(() => {
    const a = audioRef.current;
    const prog = a && a.duration ? a.currentTime / a.duration : 0;
    const isPlaying = a ? !a.paused : false;
    let freq: Uint8Array | null = null;
    if (analyserRef.current && dataRef.current && isPlaying) {
      analyserRef.current.getByteFrequencyData(dataRef.current);
      freq = dataRef.current;
    }
    if (isPlaying) phaseRef.current += 0.08;
    // Overlay: línea blanca sobre la foto. Card: teñida con el acento.
    const played = isOverlay ? "rgba(255,255,255,0.95)" : accent;
    for (const cv of [inlineCanvasRef.current, miniCanvasRef.current]) {
      if (cv)
        paint(cv, freq, barsRef.current, prog, phaseRef.current, isPlaying, played);
    }
  }, [accent, isOverlay]);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      paintAll();
      rafRef.current = requestAnimationFrame(tick);
    };
    if (playing) rafRef.current = requestAnimationFrame(tick);
    else paintAll();
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, paintAll]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      ctxRef.current?.close().catch(() => {});
      audio?.pause();
    };
  }, []);

  useEffect(() => {
    if (noCors) audioRef.current?.load();
  }, [noCors]);

  // Arranca el grafo de audio (analizador reactivo), reanuda el contexto y
  // reproduce. SOLO desde un gesto real del usuario (el botón): crear el grafo
  // enruta el <audio> por el AudioContext, y si está suspendido (sin gesto) suena
  // en silencio. Devuelve si logró reproducir.
  const startPlayback = useCallback(async () => {
    const a = audioRef.current;
    if (!a) return false;
    ensureGraph();
    await ctxRef.current?.resume().catch(() => {});
    try {
      await a.play();
      return true;
    } catch {
      return false;
    }
  }, [ensureGraph]);

  async function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) await startPlayback();
    else a.pause();
  }

  // Autoplay al entrar al perfil. CLAVE: aquí NO tocamos el grafo de Web Audio —
  // crearlo sin un gesto enruta el <audio> por un AudioContext suspendido y suena
  // en silencio (y como play() "resuelve", nada lo recupera = el bug de "queda en
  // pausa"). Reproducimos el ELEMENTO CRUDO: (1) con sonido si hay activación
  // pegajosa (p.ej. venir de la lista con un clic); (2) si el navegador lo bloquea,
  // arranca MUTEADO ya (permitido, la onda se mueve) y desmutea + suena al primer
  // gesto del visitante en cualquier parte de la página. La onda reactiva (grafo)
  // se enciende luego, si el visitante usa el botón.
  useEffect(() => {
    if (!autoPlay) return;
    const a = audioRef.current;
    if (!a) return;
    let cancelled = false;
    let cleanupGesture: (() => void) | null = null;
    const events = ["pointerdown", "keydown", "touchstart"] as const;

    const tryPlay = () => a.play().then(() => true, () => false);

    const armGesture = () => {
      const onGesture = () => {
        cleanupGesture?.();
        cleanupGesture = null;
        a.muted = false;
        void tryPlay();
      };
      events.forEach((ev) =>
        window.addEventListener(ev, onGesture, { passive: true }),
      );
      cleanupGesture = () =>
        events.forEach((ev) => window.removeEventListener(ev, onGesture));
    };

    (async () => {
      if (await tryPlay()) return; // sonó con sonido (activación pegajosa)
      if (cancelled) return;
      a.muted = true; // arranque muteado (permitido) → onda en movimiento
      await tryPlay();
      if (!cancelled) armGesture(); // desmutea + suena al primer gesto
    })();

    return () => {
      cancelled = true;
      cleanupGesture?.();
    };
  }, [autoPlay, src]);

  function seek(clientX: number, el: HTMLElement) {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    a.currentTime = ratio * a.duration;
    setCurrent(a.currentTime);
    paintAll();
  }

  function seekBy(delta: number) {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    a.currentTime = Math.min(a.duration, Math.max(0, a.currentTime + delta));
    setCurrent(a.currentTime);
    paintAll();
  }

  const pct = duration ? (current / duration) * 100 : 0;

  const inner = (
    <div className="relative">
      {!isOverlay && (
        <p className="mb-3 text-xs uppercase tracking-[3px] text-silver-300">
          {resolvedTitle}
        </p>
      )}

      {/* Repetir: solo en la tarjeta; en overlay el reproductor va minimalista. */}
      {!isOverlay && (
        <button
          type="button"
          onClick={() => setLoop((v) => !v)}
          aria-pressed={loop}
          aria-label="Repetir"
          className="absolute right-0 top-0 flex size-7 items-center justify-center rounded-full transition"
          style={{ color: loop ? accent : "rgba(255,255,255,0.4)" }}
        >
          <RepeatIcon className="size-4" />
        </button>
      )}

      <canvas
        ref={inlineCanvasRef}
        onClick={(e) => seek(e.clientX, e.currentTarget)}
        className={`w-full cursor-pointer ${isOverlay ? "h-7 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" : "h-16"}`}
      />

      <div
        onClick={(e) => seek(e.clientX, e.currentTarget)}
        className={`${isOverlay ? "mt-2 h-1" : "mt-3 h-1.5"} w-full cursor-pointer rounded-full ${isOverlay ? "bg-white/30" : "bg-white/25"}`}
      >
        <div
          className="relative h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: isOverlay ? "#fff" : accent,
          }}
        >
          <span
            className={`absolute -right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-white shadow ${isOverlay ? "size-2.5" : "size-3"}`}
          />
        </div>
      </div>

      <div
        className={`flex items-center justify-center ${isOverlay ? "mt-2 gap-6" : "mt-3 gap-5"}`}
      >
        <button
          type="button"
          onClick={() => seekBy(-10)}
          aria-label="Retroceder 10s"
          className={`transition hover:text-white ${isOverlay ? "text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" : "text-white/70"}`}
        >
          <RewindIcon className="size-5" />
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pausar" : "Reproducir"}
          className={
            isOverlay
              ? "flex size-11 items-center justify-center rounded-full border border-white/80 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition hover:bg-white/10 active:scale-95"
              : "flex size-12 items-center justify-center rounded-full bg-white text-ink shadow-lg transition hover:scale-105 active:scale-95"
          }
        >
          {playing ? (
            <PauseIcon className={isOverlay ? "size-4" : "size-5"} />
          ) : (
            <PlayIcon className={isOverlay ? "size-6" : "size-7"} />
          )}
        </button>
        <button
          type="button"
          onClick={() => seekBy(10)}
          aria-label="Avanzar 10s"
          className={`transition hover:text-white ${isOverlay ? "text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" : "text-white/70"}`}
        >
          <ForwardIcon className="size-5" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        loop={loop}
        crossOrigin={noCors ? undefined : "anonymous"}
        preload="metadata"
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          if (!noCors) setNoCors(true);
        }}
      />

      {isOverlay ? (
        <div ref={anchorRef} aria-label={resolvedTitle} className={className}>
          {inner}
        </div>
      ) : (
        <section
          ref={anchorRef}
          aria-label={resolvedTitle}
          className="mx-auto max-w-2xl px-6 py-8"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            {inner}
          </div>
        </section>
      )}

      {/* Mini-player (portal a <body>): al hacer scroll se ENCOGE hacia la
          esquina (origin bottom-right + scale) y al volver arriba SALE de un
          brinco (easing resorte). Permite pausar/reproducir sin volver arriba. */}
      {mounted &&
        createPortal(
          <div
            className={`fixed ${dockBottomClass} right-5 z-[60] origin-bottom-right transition-all duration-500 ${
              docked
                ? "translate-x-0 translate-y-0 scale-100 opacity-100 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                : "pointer-events-none translate-x-6 translate-y-16 scale-50 opacity-0 ease-in"
            }`}
          >
            {/* Contenedor "Liquid Glass" (estilo iPhone): superficie translúcida
                con desenfoque fuerte, borde-luz interior y brillo especular. El
                botón va limpio encima; el vidrio es el fondo. */}
            <div className="relative flex items-center gap-3 rounded-full bg-white/[0.04] p-2 pr-4 shadow-[0_8px_30px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-inset ring-white/30 backdrop-blur-[3px]">
              {/* Reflejo diagonal tipo cristal (de esquina a esquina). */}
              <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/30 via-transparent to-white/10" />
              {/* Brillo superior suave (sin línea recta: el canto lo da el inset). */}
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/20 to-transparent" />
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Pausar" : "Reproducir"}
                className="relative flex size-11 items-center justify-center rounded-full bg-white text-ink shadow transition hover:scale-105 active:scale-95"
              >
                {/* Halo que "respira" mientras suena: invita a tocar. */}
                {playing && (
                  <span
                    className="absolute inset-0 animate-ping rounded-full opacity-60"
                    style={{ backgroundColor: accent }}
                  />
                )}
                <span className="relative">
                  {playing ? (
                    <PauseIcon className="size-5" />
                  ) : (
                    <PlayIcon className="size-7" />
                  )}
                </span>
              </button>
              <canvas ref={miniCanvasRef} className="relative h-8 w-24" />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Waveform estilo editor de audio: BARRAS verticales simétricas respecto al
 * centro, con altura por energía del espectro (suavizada en el tiempo y
 * de-enfatizando lo bajo, para que no tiemble como señal cruda). El tramo
 * reproducido va en `accent`; el resto, tenue. `bars` persiste entre frames.
 */
function paint(
  canvas: HTMLCanvasElement,
  freq: Uint8Array | null,
  bars: number[],
  progress: number,
  phase: number,
  playing: boolean,
  accent: string,
) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  const c = canvas.getContext("2d");
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);

  const mid = h / 2;
  const maxAmp = h * 0.42;
  const N = 64;
  const step = w / N;
  const barW = Math.max(1, step * 0.38);
  if (bars.length !== N) {
    bars.length = 0;
    for (let i = 0; i < N; i++) bars.push(0);
  }

  for (let i = 0; i < N; i++) {
    let target: number;
    if (freq && freq.length) {
      const start = Math.floor((i / N) * freq.length);
      const end = Math.max(start + 1, Math.floor(((i + 1) / N) * freq.length));
      let sum = 0;
      for (let j = start; j < end; j++) sum += freq[j];
      target = Math.pow(sum / (end - start) / 255, 1.4);
    } else {
      target = playing
        ? 0.1 +
          0.5 *
            Math.abs(
              Math.sin(i * 0.7 + phase) * Math.sin(i * 0.27 - phase * 0.6),
            )
        : 0.02;
    }
    bars[i] += (target - bars[i]) * 0.3;
  }

  const splitX = w * progress;
  c.lineWidth = barW;
  c.lineCap = "round";
  for (let i = 0; i < N; i++) {
    const x = i * step + step / 2;
    const half = Math.max(barW * 0.5, bars[i] * maxAmp);
    c.beginPath();
    c.moveTo(x, mid - half);
    c.lineTo(x, mid + half);
    c.strokeStyle = x <= splitX ? accent : "rgba(255,255,255,0.4)";
    c.stroke();
  }
}
