"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { FeaturedMedia } from "@only-g/shared-types/artist-profile";
import {
  FEATURED_VIDEO_MAX_SECONDS,
  featuredMediaPolicy,
} from "@only-g/shared-types/artist-profile";
import {
  MusicIcon,
  PlayIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from "@/components/icons";
import { UploadButton } from "./UploadButton";
import { VideoTrimmer } from "./VideoTrimmer";

/**
 * Editor de MEDIA DESTACADA (§04). Usa exactamente los mismos contenedores que
 * `FeaturedMediaPlayer` (el público): player grande a la izquierda + lista de
 * clips a la derecha. Lo que el artista monta aquí es, literalmente, lo que se
 * publica — sin traducir entre "formulario" y "resultado".
 *
 * El RECORTADOR vive en el hueco del player: al elegir un clip largo, el player
 * se convierte en la herramienta de recorte y vuelve a su sitio al confirmar.
 */
export function FeaturedMediaEditor({
  items,
  active,
  onActiveChange,
  onTitleChange,
  onRemove,
  onUpload,
  uploading,
  accent,
  policy,
  pending,
  onCancelTrim,
  onConfirmTrim,
  maxBytes,
}: {
  items: FeaturedMedia[];
  active: number;
  onActiveChange: (i: number) => void;
  onTitleChange: (i: number, title: string) => void;
  onRemove: (i: number) => void;
  onUpload: (files: File[], withAudio: boolean) => void;
  uploading: boolean;
  accent: string;
  policy: ReturnType<typeof featuredMediaPolicy>;
  /** Clip elegido pendiente de recortar: ocupa el hueco del player. */
  pending: { file: File; withAudio: boolean } | null;
  onCancelTrim: () => void;
  onConfirmTrim: (blob: Blob, ext: string) => Promise<void>;
  maxBytes: number;
}) {
  const t = useTranslations("profileBuilder.featured");

  const audioCount = items.filter(
    (m) => m.type === "video" && m.withAudio,
  ).length;
  const silentCount = items.length - audioCount;
  const canAddSilent = silentCount < policy.maxSilent;
  const canAddAudio = audioCount < policy.maxAudio;

  const idx = Math.min(active, Math.max(0, items.length - 1));
  const current = items[idx];

  return (
    // Misma estructura que el perfil (player + lista); la lista va algo más
    // estrecha porque el editor es una columna de 3xl, no el ancho del perfil.
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      {/* ── Hueco del player: recortador, clip activo o estado vacío ───────── */}
      <div>
        {pending ? (
          <VideoTrimmer
            file={pending.file}
            accent={accent}
            keepAudio={pending.withAudio}
            maxSeconds={
              pending.withAudio
                ? policy.audioMaxSeconds
                : FEATURED_VIDEO_MAX_SECONDS
            }
            maxBytes={maxBytes}
            onCancel={onCancelTrim}
            onConfirm={onConfirmTrim}
          />
        ) : current ? (
          <div>
            <div className="bg-ink-soft relative aspect-video overflow-hidden rounded-2xl border border-white/10">
              {current.type === "video" ? (
                <video
                  key={current.url}
                  src={current.url}
                  autoPlay={!current.withAudio}
                  loop
                  muted={!current.withAudio}
                  controls={current.withAudio}
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={current.url}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover"
                />
              )}
              {current.type === "video" && current.withAudio && (
                <span className="bg-amethyst-500/85 absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6rem] font-bold tracking-wide text-white uppercase">
                  <MusicIcon className="size-3" />
                  {t("withAudio")}
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                aria-label={t("remove")}
                title={t("remove")}
                className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-black/65 text-white/80 ring-1 ring-white/20 backdrop-blur transition hover:bg-black/80 hover:text-red-300"
              >
                <TrashIcon className="size-4" />
              </button>
            </div>

            {/* Título del clip: mismo sitio donde el perfil lo muestra. */}
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[10px] font-semibold tracking-[2px] text-white/50 uppercase">
                {t("titleLabel")}
              </span>
              <input
                type="text"
                value={current.title ?? ""}
                onChange={(e) => onTitleChange(idx, e.target.value)}
                placeholder={t("titlePlaceholder")}
                className="font-narrow focus:ring-amethyst-300/70 w-full rounded-xl bg-white/[0.03] px-4 py-2.5 text-xl font-bold text-white uppercase ring-1 ring-inset ring-white/15 outline-none placeholder:text-white/25 focus:bg-white/[0.06]"
              />
            </label>
          </div>
        ) : (
          <UploadButton
            accept="image/*,video/*"
            onFiles={(f) => onUpload(f, false)}
            disabled={uploading}
            className="hover:border-amethyst-300/60 flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] text-white/60 transition hover:bg-white/[0.04] hover:text-white"
          >
            {uploading ? (
              <SpinnerIcon className="size-8 animate-spin" />
            ) : (
              <PlusIcon className="size-8" />
            )}
            <span className="text-sm font-semibold tracking-[2px] uppercase">
              {t("emptyCta")}
            </span>
            <span className="text-silver-400 max-w-xs text-center text-xs normal-case">
              {t("emptyHint")}
            </span>
          </UploadButton>
        )}
      </div>

      {/* ── Lista de clips: mismo contenedor que "Más videos" del perfil ───── */}
      <div>
        <p className="text-silver-400 text-xs font-semibold tracking-[2px] uppercase">
          {t("listTitle", { count: items.length, max: policy.maxTotal })}
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {items.map((m, i) => {
            const on = i === idx && !pending;
            return (
              <div
                key={`${m.url}-${i}`}
                className={`group flex items-center gap-3 rounded-2xl border p-3 transition ${
                  on
                    ? "border-amethyst-300/50 bg-amethyst-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onActiveChange(i)}
                  aria-pressed={on}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-neutral-950">
                    {m.type === "video" ? (
                      <video
                        src={m.url}
                        preload="metadata"
                        muted
                        playsInline
                        className="absolute inset-0 h-full w-full object-cover opacity-70"
                      />
                    ) : (
                      <Image
                        src={m.url}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover opacity-80"
                      />
                    )}
                    <PlayIcon className="relative size-5 translate-x-0.5 text-white drop-shadow" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-white">
                      {m.title || t("clipN", { n: i + 1 })}
                    </span>
                    {m.type === "video" && m.withAudio && (
                      <span className="text-silver-400 flex items-center gap-1 text-xs">
                        <MusicIcon className="size-3" />
                        {t("withAudio")}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={t("remove")}
                  title={t("remove")}
                  className="text-silver-400 flex size-8 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 hover:text-red-300"
                >
                  <TrashIcon className="size-4" />
                </button>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="text-silver-500 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-xs">
              {t("listEmpty")}
            </div>
          )}

          {/* Añadir: al pie de la lista, donde el ojo termina de leerla. */}
          {canAddSilent && (
            <UploadButton
              accept="image/*,video/*"
              onFiles={(f) => onUpload(f, false)}
              disabled={uploading || Boolean(pending)}
              className="hover:border-amethyst-300/60 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 px-4 py-3 text-sm text-white/75 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
            >
              {uploading ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <PlusIcon className="size-4" />
              )}
              {t("addSilent", { max: policy.maxSilent })}
            </UploadButton>
          )}
          {canAddAudio && (
            <UploadButton
              accept="video/*"
              onFiles={(f) => onUpload(f, true)}
              disabled={uploading || Boolean(pending)}
              className="border-amethyst-400/40 text-amethyst-200 hover:border-amethyst-300 hover:bg-amethyst-500/10 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm transition hover:text-white disabled:opacity-40"
            >
              {uploading ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <MusicIcon className="size-4" />
              )}
              {t("addAudio")}
            </UploadButton>
          )}
        </div>
      </div>
    </div>
  );
}
