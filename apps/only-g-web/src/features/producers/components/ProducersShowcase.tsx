"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Producer } from "@only-g/shared-types/producer";
import { formatLocation } from "@only-g/shared-types/location";
import { listProducers } from "../lib/producers-repo";
import { SEED_PRODUCERS } from "../data/producers";
import { ProducerEditorial } from "./ProducerEditorial";

gsap.registerPlugin(ScrollTrigger);

// Solo los primeros N productores tienen la experiencia inmersiva de scroll en el
// home (el recorrido es largo por productor). El resto se descubre por las cards,
// que llevan a su página dedicada — así el home no crece sin límite.
const IMMERSIVE_COUNT = 2;

export function ProducersShowcase() {
  const ref = useRef<HTMLDivElement>(null);

  // Productores reales de Firestore; mientras el admin no migre, cae a la semilla
  // (N.A / Dr. Dre) para que el home nunca quede vacío. La sección se dimensiona
  // sola según cuántos haya (0 → no se renderiza nada).
  const [producers, setProducers] = useState<Producer[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    listProducers()
      .then((list) => {
        if (!active) return;
        setProducers(list.length ? list : SEED_PRODUCERS);
        setReady(true);
      })
      .catch((e) => {
        if (!active) return;
        console.error("[producers] load:", e);
        setProducers(SEED_PRODUCERS);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Animaciones GSAP: se montan SOLO cuando ya hay datos en el DOM (si no, los
  // ScrollTrigger no encontrarían los .producer-section y no dispararían).
  useEffect(() => {
    if (!ready || producers.length === 0) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const ctx = gsap.context(() => {
      gsap.utils
        .toArray<HTMLElement>(".producer-section")
        .forEach((section) => {
          const stage = section.querySelector<HTMLElement>(".producer-stage");
          const photo = section.querySelector<HTMLElement>(".producer-photo");
          const spacer = section.querySelector<HTMLElement>(".producer-spacer");
          if (!stage || !photo || !spacer) return;

          // La capa (foto + título) arranca INVISIBLE (opacidad 0) y se revela
          // por opacidad, por encima del contenido — no por recorte del scroll.
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
            {
              scale: 1,
              filter: "blur(0px)",
              ease: "power2.out",
              duration: 0.22,
            },
            0,
          );
          // 2. HOLD: nítida, foto + título solos (0.22 → 0.6).
          // 3. SALIDA: la foto se desenfoca/sube Y la capa se desvanece, mientras
          //    el editorial sube por DETRÁS en ese mismo momento → crossfade limpio.
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
  }, [ready, producers]);

  if (ready && producers.length === 0) return null;

  const featured = producers.slice(0, IMMERSIVE_COUNT);

  return (
    <div ref={ref}>
      {/* Experiencia inmersiva: SOLO los primeros N productores. */}
      {featured.map((p) => (
        <section key={p.id} className="producer-section relative">
          {/* Capa fija a pantalla completa, POR ENCIMA: foto + título.
              Se revela por opacidad (de la nada), no por recorte del scroll. */}
          <div className="producer-stage pointer-events-none fixed inset-0 z-20 opacity-0">
            {/* Portada con dirección de arte: en móvil sirve la foto VERTICAL si
                el admin la subió; en PC/escritorio, la HORIZONTAL. */}
            <picture>
              {p.mainPhotoMobile && (
                <source media="(max-width: 640px)" srcSet={p.mainPhotoMobile} />
              )}
              <img
                src={p.mainPhoto}
                alt=""
                className="producer-photo absolute inset-0 h-full w-full object-cover"
              />
            </picture>
            <div className="from-ink via-ink/40 to-ink/5 absolute inset-0 bg-gradient-to-t" />

            <div className="absolute inset-0 flex flex-col justify-end px-6 pb-16 sm:px-12 sm:pb-24">
              <p className="text-amethyst-300 text-sm font-bold tracking-[4px] uppercase drop-shadow-[0_2px_8px_#000]">
                {p.role}
              </p>
              <h2 className="font-narrow mt-1 text-7xl leading-[0.88] font-bold text-white uppercase drop-shadow-[0_3px_16px_#000] sm:text-9xl">
                {p.name}
              </h2>
              <p className="text-silver-200 mt-2 text-sm tracking-[2px] uppercase drop-shadow-[0_2px_8px_#000]">
                {formatLocation(p.location) || p.origin}
              </p>
              <p className="mt-4 max-w-xl text-2xl text-white/95 drop-shadow-[0_2px_10px_#000] sm:text-3xl">
                {p.quote}
              </p>
            </div>
          </div>

          {/* Espaciador: da el recorrido de scroll para la animación de la capa */}
          <div className="producer-spacer h-[220vh]" aria-hidden="true" />

          {/* Editorial: sube por DETRÁS de la capa (-mt) para el crossfade limpio */}
          <div className="bg-ink relative z-10 -mt-[100vh] px-6 pt-12 pb-28 sm:px-12">
            <ProducerEditorial producer={p} />
          </div>
        </section>
      ))}
    </div>
  );
}
