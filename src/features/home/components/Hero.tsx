"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { KeepScrolling } from "@/components/icons";
import styles from "./Hero.module.css";
import { SiteMenu } from "@/components/layout/SiteMenu";

gsap.registerPlugin(ScrollTrigger);

export function Hero() {
  const rootRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("home");

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Estado inicial oculto del contenido revelado (no se ve hasta el final).
      gsap.set(".reveal-item", {
        autoAlpha: 0,
        y: 60,
        scale: 0.9,
        filter: "blur(12px)",
      });

      gsap
        .timeline({
          defaults: { ease: "power2.out" },
          scrollTrigger: {
            trigger: rootRef.current!,
            start: "top top",
            end: "bottom bottom",
            scrub: 1,
          },
        })
        .to("#hero-key", { duration: 1, scale: 1 })
        .to("#hero-key-logo", { opacity: 0 }, "<")
        .to(
          "#logo-mask",
          {
            maskSize: "clamp(20vh, 25%, 30vh)",
            maskPosition: "center 12%",
            ease: "expo.out",
          },
          0.15,
        )
        .to("#hero-key", { opacity: 0, duration: 0.2 }, 0.5)
        .to(
          ".reveal-item",
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            stagger: 0.12,
            ease: "power3.out",
            duration: 0.5,
          },
          0.4,
        )
        // Salida: el logo se difumina (viñeta) y los botones se van hacia ARRIBA,
        // justo cuando empieza a entrar el primer productor.
        .to("#logo-mask", { autoAlpha: 0, duration: 0.4 }, 1.55)
        .to(
          "#hero-reveal",
          { autoAlpha: 0, y: -60, filter: "blur(8px)", duration: 0.35 },
          1.6,
        );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className={styles.scrollTrack}>
      <div
        id="logo-mask"
        className={`${styles.logoMask} fixed top-0 h-screen w-full`}
      >
        <section>
          <picture
            id="hero-key"
            className="fixed block h-screen w-screen scale-125 overflow-hidden"
          >
            <Image
              id="hero-key-logo"
              src="/only-g-logo.png"
              alt="Only G"
              width={768}
              height={512}
              priority
              className={styles.heroKeyLogo}
            />
            <img
              id="hero-key-background"
              src="/hero/hero-key-background.jpg"
              alt=""
              className="h-full w-full object-cover"
            />
          </picture>
        </section>
      </div>

      <div className="fixed flex h-screen w-full flex-col items-center justify-between px-6 pb-16 pt-3 sm:px-12 sm:pt-6">
        <header className="flex w-full">
          <Image
            src="/logo/logo-white.png"
            alt="Only G"
            width={384}
            height={256}
            className="h-12 w-auto cursor-pointer sm:h-32"
          />
        </header>
      </div>

      {/* Contenido que se revela al terminar la máscara */}
      <div
        id="hero-reveal"
        className="pointer-events-none fixed inset-0 flex flex-col items-center px-6 pb-10 sm:px-12"
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="reveal-item invisible text-xs uppercase tracking-[4px] text-silver-400 sm:text-sm">
            {t("tagline")}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
            <button
              type="button"
              onClick={() =>
                window.scrollTo({
                  top: window.innerHeight * 4.5,
                  behavior: "smooth",
                })
              }
              className="reveal-item invisible pointer-events-auto rounded-full bg-gradient-to-r from-silver-100 to-amethyst-300 px-8 py-3 text-sm font-semibold uppercase tracking-[2px] text-ink transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
            >
              {t("explore")}
            </button>
            <Link
              href="/artistas"
              className="reveal-item invisible pointer-events-auto rounded-full border border-silver-300/40 px-8 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
            >
              {t("artists")}
            </Link>
            <Link
              href="/cotizar"
              className="reveal-item invisible pointer-events-auto rounded-full border border-silver-300/40 px-8 py-3 text-sm uppercase tracking-[2px] text-silver-100 transition hover:border-silver-100 hover:bg-white/5"
            >
              {t("quote")}
            </Link>
            <Link
              href="/agenda"
              className="reveal-item invisible pointer-events-auto rounded-full border border-amethyst-400/60 px-8 py-3 text-sm uppercase tracking-[2px] text-amethyst-300 transition hover:border-amethyst-300 hover:bg-amethyst-500/10"
            >
              {t("book")}
            </Link>
          </div>
        </div>

        <div className="reveal-item invisible flex flex-col items-center gap-2">
          <span className="text-xs uppercase tracking-[3px] text-silver-300 sm:text-sm">
            {t("meetProducers")}
          </span>
          <KeepScrolling className="w-5 animate-bounce-pulse text-amethyst-300" />
        </div>
      </div>

      <SiteMenu />
    </div>
  );
}
