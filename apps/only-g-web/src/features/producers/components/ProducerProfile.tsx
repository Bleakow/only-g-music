"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Producer } from "@only-g/shared-types/producer";
import { formatLocation } from "@only-g/shared-types/location";
import { ArrowLeftIcon } from "@/components/icons";
import { getProducer } from "../lib/producers-repo";
import { ProducerEditorial } from "./ProducerEditorial";

type State = "loading" | "ready" | "notfound";

/**
 * Página dedicada de UN productor: portada a pantalla completa (stage estático) +
 * editorial reutilizado + botón volver. Carga en cliente vía `getProducer` (mismo
 * SDK que la vitrina). URL propia = compartible y con navegación atrás natural.
 */
export function ProducerProfile({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [producer, setProducer] = useState<Producer | null>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let active = true;
    getProducer(id)
      .then((p) => {
        if (!active) return;
        setProducer(p);
        setState(p ? "ready" : "notfound");
      })
      .catch((e) => {
        if (!active) return;
        console.error("[producer] load:", e);
        setState("notfound");
      });
    return () => {
      active = false;
    };
  }, [id]);

  // Volver a DONDE se venía (la vitrina/lista desde donde se abrió el perfil), no
  // a Inicio. Fallback a "/" si no hay historial (entrada directa por URL).
  const backLink = (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      }}
      aria-label={t("producers.back")}
      className="text-silver-100 flex items-center gap-2 rounded-full border border-white/25 bg-black/40 px-4 py-2 text-sm backdrop-blur-sm transition hover:border-white hover:text-white"
    >
      <ArrowLeftIcon className="size-4" />
      {t("producers.back")}
    </button>
  );

  if (state === "loading") {
    return <div className="bg-ink min-h-screen" />;
  }

  if (state === "notfound" || !producer) {
    return (
      <div className="bg-ink flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <h1 className="font-narrow text-4xl font-bold text-white uppercase">
          {t("producers.notFound")}
        </h1>
        <p className="text-silver-400">{t("producers.notFoundHint")}</p>
        {backLink}
      </div>
    );
  }

  const p = producer;
  const location = formatLocation(p.location) || p.origin;

  return (
    <div className="bg-ink">
      <div className="fixed top-5 left-5 z-[60]">{backLink}</div>

      {/* Portada a pantalla completa (stage estático, sin scrub). */}
      <section className="relative h-[85vh] min-h-[520px] w-full overflow-hidden">
        <picture>
          {p.mainPhotoMobile && (
            <source media="(max-width: 640px)" srcSet={p.mainPhotoMobile} />
          )}
          <img
            src={p.mainPhoto}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
        <div className="from-ink via-ink/40 to-ink/5 absolute inset-0 bg-gradient-to-t" />

        <div className="absolute inset-0 flex flex-col justify-end px-6 pb-16 sm:px-12 sm:pb-24">
          <p className="text-amethyst-300 text-sm font-bold tracking-[4px] uppercase drop-shadow-[0_2px_8px_#000]">
            {p.role}
          </p>
          <h1 className="font-narrow mt-1 text-7xl leading-[0.88] font-bold text-white uppercase drop-shadow-[0_3px_16px_#000] sm:text-9xl">
            {p.name}
          </h1>
          {location && (
            <p className="text-silver-200 mt-2 text-sm tracking-[2px] uppercase drop-shadow-[0_2px_8px_#000]">
              {location}
            </p>
          )}
          <p className="mt-4 max-w-xl text-2xl text-white/95 drop-shadow-[0_2px_10px_#000] sm:text-3xl">
            {p.quote}
          </p>
        </div>
      </section>

      {/* Editorial reutilizado (bio + redes + galería + lightbox). */}
      <div className="px-6 pt-12 pb-28 sm:px-12">
        <ProducerEditorial producer={p} />
      </div>
    </div>
  );
}
