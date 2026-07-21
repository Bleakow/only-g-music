"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GlassModal } from "@/components/ui/GlassModal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CheckIcon, RotateCwIcon, SpinnerIcon } from "@/components/icons";
import { glassSurfaceSoft } from "@/components/ui/glass";
import { aiClient } from "@/features/ai/client";

interface BioAiModalProps {
  open: boolean;
  onClose: () => void;
  /** Germen: la frase o bio actual del artista. */
  seed: string;
  name?: string;
  city?: string;
  genres?: string[];
  startYear?: number;
  /** Se llama con la versión elegida al pulsar "Usar esta". */
  onAccept: (text: string) => void;
}

/**
 * "Mejorar biografía con IA": genera DOS versiones profesionales del germen y deja
 * al artista elegir/regenerar. No toca la bio original hasta aceptar (reversible).
 * Reusa GlassModal + el cliente compartido `aiClient` (que adjunta el ID token).
 */
export function BioAiModal({
  open,
  onClose,
  seed,
  name,
  city,
  genres,
  startYear,
  onAccept,
}: BioAiModalProps) {
  const t = useTranslations("profileBuilder.aiBio");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [variants, setVariants] = useState<string[]>([]);
  const [selected, setSelected] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(false);
    try {
      const res = await aiClient.improveBio(
        { seed, name, city, genres, startYear },
        ac.signal,
      );
      if (ac.signal.aborted) return;
      setVariants(res.variants);
      setSelected(0);
    } catch (e) {
      if (ac.signal.aborted) return;
      console.error("[bio-ai]", e);
      setError(true);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [seed, name, city, genres, startYear]);

  // Genera al abrir (una vez por apertura); al cerrar aborta la petición en vuelo.
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      return;
    }
    void generate();
    return () => abortRef.current?.abort();
    // Solo al alternar `open`: no queremos regenerar por cada cambio de prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={t("modalTitle")}
      className="max-w-lg"
    >
      <p className="text-silver-300 -mt-2 mb-4 text-sm">{t("subtitle")}</p>

      {loading ? (
        <div className="text-silver-300 flex flex-col items-center gap-3 py-10">
          <SpinnerIcon className="text-amethyst-300 size-7 animate-spin" />
          <p className="text-sm">{t("generating")}</p>
        </div>
      ) : error ? (
        <div className="flex flex-col gap-4 py-2">
          <Alert tone="error">{t("error")}</Alert>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void generate()}
            className="self-start"
          >
            <RotateCwIcon className="size-4" />
            {t("regenerate")}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {variants.map((text, i) => {
              const active = i === selected;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-pressed={active}
                  className={`${glassSurfaceSoft} relative rounded-2xl p-4 text-left transition ${
                    active
                      ? "ring-amethyst-300/80 ring-2"
                      : "hover:bg-white/5"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-narrow text-amethyst-300 text-xs font-bold tracking-[2px] uppercase">
                      {t("variantLabel", { n: i + 1 })}
                    </span>
                    {active && <CheckIcon className="text-amethyst-300 size-4" />}
                  </div>
                  <p className="text-silver-100 text-[0.95rem] leading-relaxed">
                    {text}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void generate()}
            >
              <RotateCwIcon className="size-4" />
              {t("regenerate")}
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!variants.length}
              onClick={() => {
                const chosen = variants[selected];
                if (!chosen) return;
                onAccept(chosen);
                onClose();
              }}
            >
              {t("use")}
            </Button>
          </div>
        </>
      )}
    </GlassModal>
  );
}
