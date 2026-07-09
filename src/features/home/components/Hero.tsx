"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
  InstagramIcon,
  YouTubeIcon,
  SpotifyIcon,
  SoundCloudIcon,
} from "@/components/icons";
import styles from "./Hero.module.css";
import { SiteMenu } from "@/components/layout/SiteMenu";
import { ProducerCardsStrip } from "@/features/producers/components/ProducerCardsStrip";

gsap.registerPlugin(ScrollTrigger);

// Imágenes de fondo del hero servidas desde Firebase Storage (públicas). NO van en
// el repo por copyright (ver .gitignore de public/hero); viven en Storage.
const HERO_IMG =
  "https://storage.googleapis.com/only-g-music-745ca.firebasestorage.app/hero";

export function Hero() {
  const rootRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("home");

  // Baja al bloque de productores. Misma acción para el CTA del hero editorial y
  // el botón "Explorar" que aparece a mitad de scroll (comparten destino).
  const scrollToWork = () =>
    window.scrollTo({ top: window.innerHeight * 4.5, behavior: "smooth" });

  useEffect(() => {
    // El logo de la máscara sube más en DESKTOP (aislado arriba); en móvil se
    // queda en su sitio (12%). Con gsap.matchMedia la posición se resuelve por
    // viewport y reacciona al resize — nunca filtra el valor de desktop al móvil.
    const mm = gsap.matchMedia();
    // AMBAS condiciones para que el callback corra en desktop Y móvil (con solo
    // isDesktop, en móvil no se ejecutaría y el hero se quedaría sin timeline).
    mm.add(
      { isDesktop: "(min-width: 641px)", isMobile: "(max-width: 640px)" },
      (context) => {
        const isDesktop = Boolean(context.conditions?.isDesktop);
        // Estado inicial oculto del contenido revelado (no se ve hasta el final).
        gsap.set(".reveal-item", {
          autoAlpha: 0,
          y: 60,
          scale: 0.9,
          filter: "blur(12px)",
        });
        gsap.set("#hero-secondary", { autoAlpha: 0 });

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
          // La flecha de scroll inicial se desvanece apenas el usuario empieza a bajar.
          .to("#hero-scroll-hint", { autoAlpha: 0, duration: 0.12 }, 0)
          // El contenido editorial (texto + redes) se desvanece al empezar a bajar.
          .to("#hero-intro", { autoAlpha: 0, y: -40, duration: 0.25 }, 0.02)
          .to(
            "#logo-mask",
            {
              maskSize: "clamp(20vh, 25%, 30vh)",
              maskPosition: isDesktop ? "center 5%" : "center 12%",
              ease: "expo.out",
            },
            0.15,
          )
          .to("#hero-key", { opacity: 0, duration: 0.2 }, 0.5)
          // La imagen secundaria aparece PROGRESIVAMENTE al terminar la máscara.
          .to(
            "#hero-secondary",
            { autoAlpha: 1, ease: "power1.out", duration: 0.6 },
            0.35,
          )
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
            0.7,
          )
          // Salida: el logo se difumina (viñeta) y los botones se van hacia ARRIBA,
          // justo cuando empieza a entrar el primer productor.
          .to("#logo-mask", { autoAlpha: 0, duration: 0.4 }, 2.2)
          .to(
            "#hero-reveal",
            { autoAlpha: 0, y: -60, filter: "blur(8px)", duration: 0.35 },
            2.25,
          )
          // La imagen secundaria se va con los botones, cediendo a los productores.
          .to("#hero-secondary", { autoAlpha: 0, duration: 0.4 }, 2.25);
      },
    );

    return () => mm.revert();
  }, []);

  return (
    <div ref={rootRef} className={styles.scrollTrack}>
      <div
        id="logo-mask"
        className={`${styles.logoMask} fixed top-0 z-[1] h-screen w-full`}
      >
        <section>
          <div
            id="hero-key"
            className="fixed block h-screen w-screen scale-105 overflow-hidden"
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
            {/* Fondo responsive: imagen dedicada para móvil (vertical) y desktop.
                Nombres con espacios → URL-encoded (los espacios en srcSet rompen). */}
            <picture>
              <source
                media="(max-width: 640px)"
                srcSet={`${HERO_IMG}/web-principal-mobile.png`}
              />
              <img
                id="hero-key-background"
                src={`${HERO_IMG}/web-principal.png`}
                alt=""
                className="h-full w-full object-cover"
              />
            </picture>
          </div>
        </section>
      </div>

      {/* Contenido editorial de la PRIMERA pantalla (según la foto de referencia):
          kicker, título, subtítulo, CTA y redes. Se desvanece al scrollear
          (#hero-intro en el timeline GSAP), dejando paso a la máscara. */}
      <div
        id="hero-intro"
        className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between px-6 pt-28 pb-20 sm:px-12 sm:pt-36 sm:pb-24"
      >
        <div className="flex max-w-2xl flex-1 flex-col justify-center">
          <p className="text-silver-300 text-xs tracking-[4px] uppercase sm:text-sm">
            {t("kicker")}
          </p>
          <h1 className="font-narrow mt-3 text-6xl leading-[0.9] font-bold tracking-tight text-white uppercase drop-shadow-[0_2px_14px_rgba(0,0,0,0.65)] sm:text-8xl">
            {t("heroTitle")}
          </h1>
          <p className="text-silver-200 mt-5 max-w-md text-sm drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)] sm:text-base">
            {t("heroSubtitle")}
          </p>
          <button
            type="button"
            onClick={scrollToWork}
            className="group text-silver-100 pointer-events-auto mt-8 inline-flex w-fit items-center gap-3 text-sm tracking-[2px] uppercase transition hover:text-white"
          >
            <span className="relative pb-1.5">
              {t("exploreWork")}
              {/* Subrayado amatista (color de marca) que se desvanece al final. */}
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[linear-gradient(to_right,var(--color-amethyst-400)_0%,var(--color-amethyst-400)_62%,transparent_100%)]" />
            </span>
            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </button>
        </div>

        {/* Redes: sin redirección por ahora (botones inertes). */}
        <div className="pointer-events-auto flex items-center gap-4">
          <span className="text-silver-400 text-xs tracking-[3px] uppercase">
            {t("follow")}
          </span>
          <div className="text-silver-200 flex items-center gap-4">
            <button
              type="button"
              aria-label="Instagram"
              className="cursor-pointer transition hover:text-white"
            >
              <InstagramIcon className="w-6" />
            </button>
            <button
              type="button"
              aria-label="YouTube"
              className="cursor-pointer transition hover:text-white"
            >
              <YouTubeIcon className="w-6" />
            </button>
            <button
              type="button"
              aria-label="Spotify"
              className="cursor-pointer transition hover:text-white"
            >
              <SpotifyIcon className="w-6" />
            </button>
            <button
              type="button"
              aria-label="SoundCloud"
              className="cursor-pointer transition hover:text-white"
            >
              <SoundCloudIcon className="w-7" />
            </button>
          </div>
        </div>
      </div>

      {/* Flecha indicadora de scroll (estado inicial). GSAP la desvanece apenas
          el usuario empieza a bajar; reaparece al volver arriba (scrub). */}
      <div
        id="hero-scroll-hint"
        className="text-silver-200 fixed inset-x-0 bottom-7 z-20 flex flex-col items-center gap-1.5"
      >
        <span className="text-[10px] tracking-[3px] uppercase sm:text-xs">
          {t("scrollHint")}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="animate-bounce-pulse text-amethyst-300 w-6"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Fondo de la SEGUNDA interfaz (Web secondary): aparece progresivamente al
          terminar la máscara, DETRÁS de los botones revelados. Arranca oculto;
          GSAP lo sube por opacidad con el scrub. */}
      <div
        id="hero-secondary"
        className="pointer-events-none fixed inset-0 z-0 opacity-0"
      >
        <picture>
          <source
            media="(max-width: 640px)"
            srcSet={`${HERO_IMG}/web-secondary-mobile.png`}
          />
          <img
            src={`${HERO_IMG}/web-secondary.png`}
            alt=""
            className="h-full w-full object-cover"
          />
        </picture>
        {/* Oscurecido suave para que el texto revelado se lea encima. */}
        <div className="bg-ink/50 absolute inset-0" />
      </div>

      {/* Contenido que se revela al terminar la máscara */}
      <div
        id="hero-reveal"
        className="pointer-events-none fixed inset-0 z-[2] flex flex-col items-center px-6 pb-10 sm:px-12"
      >
        <div className="flex flex-1 flex-col items-center justify-start gap-5 pt-[22vh] text-center sm:pt-[20vh]">
          <h2 className="reveal-item font-narrow invisible text-5xl leading-[0.95] font-bold tracking-tight text-white uppercase sm:text-7xl">
            {t("heroHeadline")}{" "}
            <span className="from-amethyst-300 to-amethyst-500 bg-gradient-to-r bg-clip-text text-transparent">
              {t("heroHeadlineAccent")}
            </span>
          </h2>
          <p className="reveal-item text-silver-400 invisible text-xs tracking-[4px] uppercase sm:text-sm">
            {t("tagline")}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
            <button
              type="button"
              onClick={scrollToWork}
              className="reveal-item from-silver-100 to-amethyst-300 text-ink pointer-events-auto invisible rounded-full bg-gradient-to-r px-8 py-3 text-sm font-semibold tracking-[2px] uppercase transition hover:shadow-[0_0_22px_rgba(139,92,246,0.55)]"
            >
              {t("explore")}
            </button>
            <Link
              href="/artistas"
              className="reveal-item border-silver-300/40 text-silver-100 hover:border-silver-100 pointer-events-auto invisible rounded-full border px-8 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
            >
              {t("artists")}
            </Link>
            <Link
              href="/cotizar"
              className="reveal-item border-silver-300/40 text-silver-100 hover:border-silver-100 pointer-events-auto invisible rounded-full border px-8 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
            >
              {t("quote")}
            </Link>
            <Link
              href="/agenda"
              className="reveal-item border-amethyst-400/60 text-amethyst-300 hover:border-amethyst-300 hover:bg-amethyst-500/10 pointer-events-auto invisible rounded-full border px-8 py-3 text-sm tracking-[2px] uppercase transition"
            >
              {t("book")}
            </Link>
          </div>
        </div>

        {/* Tira de cards de productores: se revela junto a los botones (mismo
            efecto), en la parte inferior de esta segunda interfaz. */}
        <ProducerCardsStrip />
      </div>

      <SiteMenu />
    </div>
  );
}
