"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const BARS = 60; // barras del espectro circular

/**
 * Loader "vinilo" (versión brutal): un disco con surcos que entra, el brazo baja
 * la aguja (flash de "needle drop") y arranca acelerando hasta girar infinito.
 * Alrededor, un ESPECTRO CIRCULAR de barras que late al beat; encima, un brillo
 * especular fijo que glinta sobre los surcos y una veta de luz que gira con el
 * disco. Glow + viñeta pulsan al beat. Todo GSAP, sin dependencias nuevas.
 */
export function VinylLoader() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // ── Intro: disco entra, brazo baja, needle drop + flash, spin-up ──────────
      const intro = gsap.timeline();
      intro
        .from(".vinyl-disc", {
          scale: 0.55,
          autoAlpha: 0,
          duration: 0.6,
          ease: "back.out(1.5)",
        })
        .fromTo(
          ".vinyl-arm",
          { rotate: -42 },
          { rotate: -11, duration: 0.7, ease: "power2.inOut" },
          0.25,
        )
        // Needle drop: destello al contacto de la aguja.
        .fromTo(
          ".vinyl-flash",
          { autoAlpha: 0, scale: 0.6 },
          { autoAlpha: 0.9, scale: 1, duration: 0.12, ease: "power2.out" },
          0.9,
        )
        .to(".vinyl-flash", { autoAlpha: 0, duration: 0.5, ease: "power2.in" })
        // Spin-up: de parado a velocidad de crucero, luego infinito lineal.
        .fromTo(
          ".vinyl-spin",
          { rotate: 0 },
          { rotate: 620, duration: 1.5, ease: "power2.in" },
          0.9,
        )
        .to(".vinyl-spin", {
          rotate: "+=360",
          duration: 0.8,
          repeat: -1,
          ease: "none",
        });

      // ── Espectro circular: cada barra late a su ritmo (random re-generado) ────
      gsap.utils.toArray<HTMLElement>(".vl-bar").forEach((bar, i) => {
        gsap.to(bar, {
          scaleY: () => 0.25 + Math.random() * 1.15,
          duration: () => 0.26 + Math.random() * 0.3,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: (i % 10) * 0.04,
        });
      });

      // ── Beat (~0.8s): glow + viñeta + un latido del anillo entero ─────────────
      const beat = gsap.timeline({ repeat: -1, repeatDelay: 0.66 });
      beat
        .to(".vinyl-glow", {
          scale: 1.14,
          opacity: 0.6,
          duration: 0.12,
          ease: "power2.out",
        })
        .to(".vinyl-vignette", { opacity: 0.55, duration: 0.12 }, "<")
        .to(".vinyl-ring", { scale: 1.03, duration: 0.12 }, "<")
        .to(".vinyl-glow", { scale: 1, opacity: 0.32, duration: 0.5 })
        .to(".vinyl-vignette", { opacity: 0.85, duration: 0.5 }, "<")
        .to(".vinyl-ring", { scale: 1, duration: 0.5 }, "<");

      // Brillo especular fijo con una leve oscilación (vida, no gira con el disco).
      gsap.to(".vinyl-sheen", {
        rotate: 8,
        duration: 2.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={ref}
      className="bg-ink fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
    >
      {/* Viñeta que respira al beat */}
      <div
        className="vinyl-vignette pointer-events-none absolute inset-0"
        style={{
          opacity: 0.85,
          background:
            "radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.85) 100%)",
        }}
      />
      {/* Glow amatista */}
      <div className="vinyl-glow bg-amethyst-500/25 pointer-events-none absolute size-[40vmin] rounded-full blur-[80px]" />

      <div className="vinyl-ring relative size-[52vmin] max-h-[340px] max-w-[340px]">
        {/* ── Espectro circular ── */}
        {Array.from({ length: BARS }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-0"
            style={{ transform: `rotate(${(360 / BARS) * i}deg)` }}
          >
            <div
              className="vl-bar from-amethyst-500 to-silver-100 absolute top-0 left-1/2 w-[3px] origin-top rounded-full bg-gradient-to-b"
              style={{
                height: "12%",
                marginLeft: "-1.5px",
                transform: "scaleY(0.3)",
              }}
            />
          </div>
        ))}

        {/* ── Disco ── */}
        <div className="vinyl-disc absolute inset-[16%] rounded-full">
          {/* Capa que gira (surcos + veta de luz + etiqueta) */}
          <div
            className="vinyl-spin absolute inset-0 rounded-full"
            style={{
              background:
                "repeating-radial-gradient(circle at center, #09090e 0 1.5px, #16141e 1.5px 3px)",
              boxShadow:
                "0 0 0 7px #050507, 0 34px 90px rgba(0,0,0,0.75), inset 0 0 70px rgba(0,0,0,0.9)",
            }}
          >
            {/* Veta de luz asimétrica: gira con el disco → revela la rotación */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, rgba(196,165,255,0.18) 24deg, transparent 60deg, transparent 360deg)",
              }}
            />
            {/* Etiqueta central */}
            <div className="from-amethyst-500 to-amethyst-700 absolute top-1/2 left-1/2 flex size-[34%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo/logo-white.png"
                alt="Only G Music"
                className="w-[68%]"
              />
              {/* Eje/spindle */}
              <span className="bg-ink absolute size-2.5 rounded-full ring-1 ring-white/25" />
            </div>
          </div>

          {/* Brillo especular FIJO (no gira): glinta sobre los surcos */}
          <div
            className="vinyl-sheen pointer-events-none absolute inset-0 rounded-full mix-blend-screen"
            style={{
              background:
                "conic-gradient(from 210deg, transparent 0deg, rgba(255,255,255,0.16) 30deg, transparent 90deg, transparent 180deg, rgba(255,255,255,0.08) 210deg, transparent 260deg)",
            }}
          />

          {/* Flash del needle drop */}
          <div className="vinyl-flash pointer-events-none absolute -inset-2 rounded-full opacity-0 shadow-[0_0_60px_20px_rgba(196,165,255,0.7)] ring-2 ring-white/70" />
        </div>

        {/* ── Brazo tocadiscos ── */}
        <div
          className="vinyl-arm from-silver-100 to-silver-500 absolute top-[6%] right-[4%] h-[46%] w-[6px] origin-top rounded-full bg-gradient-to-b shadow-lg"
          style={{ transformOrigin: "top center" }}
        >
          {/* Pivote */}
          <span className="bg-silver-200 absolute -top-2 left-1/2 size-5 -translate-x-1/2 rounded-full shadow ring-1 ring-black/30" />
          {/* Headshell + aguja */}
          <span className="bg-silver-300 absolute -bottom-1 left-1/2 h-4 w-3 -translate-x-1/2 rotate-6 rounded-sm shadow" />
        </div>
      </div>
    </div>
  );
}
