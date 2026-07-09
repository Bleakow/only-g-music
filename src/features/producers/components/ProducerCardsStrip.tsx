"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Producer } from "@/domain/producer";
import { listProducers } from "../lib/producers-repo";
import { SEED_PRODUCERS } from "../data/producers";
import { ProducerCard } from "./ProducerCard";

/**
 * Tira de cards de productores para la SEGUNDA interfaz del hero. Se REVELA junto
 * a los botones: el wrapper lleva `.reveal-item` y existe desde el montaje, así que
 * GSAP lo captura aunque los datos lleguen async (las cards se rellenan dentro).
 * En móvil es un carrusel horizontal (cabe en una fila); en desktop, grid.
 */
export function ProducerCardsStrip() {
  const t = useTranslations("home");
  const [producers, setProducers] = useState<Producer[]>([]);

  useEffect(() => {
    let active = true;
    listProducers()
      .then(
        (list) => active && setProducers(list.length ? list : SEED_PRODUCERS),
      )
      .catch(() => active && setProducers(SEED_PRODUCERS));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="reveal-item pointer-events-auto invisible w-full max-w-6xl">
      <div className="mb-5 text-center">
        <h2 className="font-narrow text-amethyst-300 text-sm font-bold tracking-[4px] uppercase">
          {t("meetProducers")}
        </h2>
        <div className="via-amethyst-400/60 mx-auto mt-3 h-px w-40 max-w-full bg-gradient-to-r from-transparent to-transparent" />
      </div>

      <div className="flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-x-visible sm:pb-0 lg:grid-cols-4">
        {producers.map((p) => (
          <div key={p.id} className="w-[82%] shrink-0 snap-start sm:w-auto">
            <ProducerCard producer={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
