"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { producers } from "../data/producers";
import { FacebookIcon, InstagramIcon, ExpandIcon } from "@/components/icons";

gsap.registerPlugin(ScrollTrigger);

// Spans para la galería asimétrica (estilo editorial).
const GALLERY_LAYOUT = [
  "sm:col-span-7",
  "sm:col-span-5 sm:mt-24",
  "sm:col-span-6 sm:col-start-4",
];

function PhotoButton({
  src,
  alt,
  onOpen,
  className = "",
  iconSize = "size-4",
}: {
  src: string;
  alt: string;
  onOpen: (src: string) => void;
  className?: string;
  iconSize?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(src)}
      aria-label={`Ampliar foto de ${alt}`}
      className={`reveal group relative block overflow-hidden rounded-xl ring-1 ring-white/10 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 transition-colors duration-300 group-hover:bg-black/20" />
      <span className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
        <ExpandIcon className={iconSize} />
      </span>
    </button>
  );
}

export function ProducersShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".producer-section").forEach((section) => {
        const stage = section.querySelector<HTMLElement>(".producer-stage");
        const photo = section.querySelector<HTMLElement>(".producer-photo");
        const spacer = section.querySelector<HTMLElement>(".producer-spacer");
        if (!stage || !photo || !spacer) return;

        // La capa (foto + título) arranca INVISIBLE (opacidad 0) y se revela
        // por opacidad, por encima del contenido — no por recorte del scroll.
        // Desenfoque NORMAL (sin brightness/saturate → la foto nunca queda negra),
        // solo para que el borde se funda suave con el fondo de la ventana.
        gsap.set(stage, { autoAlpha: 0 });
        gsap.set(photo, { scale: 1.06, filter: "blur(12px)" });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: spacer,
            start: "top bottom",
            end: "bottom bottom",
            scrub: 1,
          },
        });

        // 1. ENTRADA: foto + título aparecen de la nada (opacidad), en su sitio.
        tl.to(stage, { autoAlpha: 1, ease: "power2.out", duration: 0.22 }, 0);
        tl.to(
          photo,
          { scale: 1, filter: "blur(0px)", ease: "power2.out", duration: 0.22 },
          0,
        );
        // 2. HOLD: nítida, foto + título solos (0.22 → 0.6).
        // 3. SALIDA: la foto se desenfoca/sube Y la capa se desvanece, mientras
        //    el editorial sube por DETRÁS en ese mismo momento → crossfade
        //    limpio foto → contenido (sin negro, sin foto borrosa pegada).
        tl.to(
          photo,
          {
            scale: 1.12,
            filter: "blur(16px)",
            yPercent: -6,
            ease: "none",
            duration: 0.4,
          },
          0.6,
        );
        tl.to(stage, { autoAlpha: 0, ease: "power1.in", duration: 0.4 }, 0.6);
      });

      // Bio, redes y galería se revelan al entrar en vista.
      if (!reduce) {
        gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
          gsap.from(el, {
            autoAlpha: 0,
            y: 60,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%" },
          });
        });
      }
    }, ref);

    return () => ctx.revert();
  }, []);

  // Lightbox: Escape cierra + bloquea scroll de fondo.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  return (
    <div ref={ref}>
      {producers.map((p) => (
        <section key={p.slug} className="producer-section relative">
          {/* Capa fija a pantalla completa, POR ENCIMA: foto + título.
              Se revela por opacidad (de la nada), no por recorte del scroll. */}
          <div className="producer-stage pointer-events-none fixed inset-0 z-20 opacity-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.mainPhoto}
              alt=""
              className="producer-photo absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/5" />

            <div className="absolute inset-0 flex flex-col justify-end px-6 pb-16 sm:px-12 sm:pb-24">
              <p className="text-sm font-bold uppercase tracking-[4px] text-amethyst-300 drop-shadow-[0_2px_8px_#000]">
                {p.role}
              </p>
              <h2 className="mt-1 font-narrow text-7xl font-bold uppercase leading-[0.88] text-white drop-shadow-[0_3px_16px_#000] sm:text-9xl">
                {p.name}
              </h2>
              <p className="mt-2 text-sm uppercase tracking-[2px] text-silver-200 drop-shadow-[0_2px_8px_#000]">
                {p.origin}
              </p>
              <p className="mt-4 max-w-xl text-2xl text-white/95 drop-shadow-[0_2px_10px_#000] sm:text-3xl">
                {p.quote}
              </p>
            </div>
          </div>

          {/* Espaciador: da el recorrido de scroll para la animación de la capa */}
          <div className="producer-spacer h-[220vh]" aria-hidden="true" />

          {/* Editorial: sube por DETRÁS de la capa (-mt) para el crossfade limpio */}
          <div className="relative z-10 -mt-[100vh] bg-ink px-6 pb-28 pt-12 sm:px-12">
            <div className="mx-auto max-w-5xl">
              <div className="grid gap-8 sm:grid-cols-2 sm:items-end sm:gap-12">
                <PhotoButton
                  src={p.photos[0]}
                  alt={p.name}
                  onOpen={setLightbox}
                  className="aspect-[3/4]"
                />

                <div className="reveal sm:pb-8">
                  <p className="text-xl leading-relaxed text-silver-100 sm:text-[1.6rem] sm:leading-[1.6] [&::first-letter]:float-left [&::first-letter]:mr-3 [&::first-letter]:font-narrow [&::first-letter]:text-7xl [&::first-letter]:font-bold [&::first-letter]:leading-[0.7] [&::first-letter]:text-amethyst-300">
                    {p.bio}
                  </p>

                  <div className="mt-8 flex gap-3">
                    {p.socials.facebook && (
                      <a
                        href={p.socials.facebook}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Facebook de ${p.name}`}
                        className="flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/30 text-silver-100 backdrop-blur-sm transition hover:border-white hover:text-white"
                      >
                        <FacebookIcon className="size-5" />
                      </a>
                    )}
                    {p.socials.instagram && (
                      <a
                        href={p.socials.instagram}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Instagram de ${p.name}`}
                        className="flex size-11 items-center justify-center rounded-full border border-white/25 bg-black/30 text-silver-100 backdrop-blur-sm transition hover:border-white hover:text-white"
                      >
                        <InstagramIcon className="size-5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {p.photos.length > 1 && (
                <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-12">
                  {p.photos.slice(1).map((photo, i) => (
                    <PhotoButton
                      key={photo}
                      src={photo}
                      alt={p.name}
                      onOpen={setLightbox}
                      iconSize="size-3.5"
                      className={`aspect-[3/4] ${GALLERY_LAYOUT[i] ?? "sm:col-span-4"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      ))}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/92 p-4 sm:p-10"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Cerrar"
            className="absolute right-5 top-5 flex size-11 items-center justify-center rounded-full border border-white/25 text-white transition hover:border-white hover:bg-white/10"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
