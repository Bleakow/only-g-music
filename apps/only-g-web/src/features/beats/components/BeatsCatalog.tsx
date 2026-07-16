"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { Beat } from "@/domain/beat";
import { formatCOP } from "@/domain/service";
import type { MetodoPago } from "@/domain/payment-method";
import { usePrecios } from "@/features/pricing/components/PreciosProvider";
import { listBeats } from "@/features/beats/lib/beats-repo";
import { comprarBeat } from "@/features/beats/lib/beat-sales-repo";
import { ContactBeatmakerButton } from "@/features/beats/components/ContactBeatmakerButton";
import { MUSIC_GENRES } from "@/features/artists/data/genres";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { PaymentMethodPicker } from "@/features/conversations/components/PaymentMethodPicker";
import { openConversation } from "@/features/conversations/lib/open-conversation";
import {
  SearchableSelect,
  type SelectOption,
} from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  MusicIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SpinnerIcon,
} from "@/components/icons";

const FILTER_TRIGGER =
  "flex w-full items-center justify-between gap-2 rounded-full bg-white/[0.06] px-4 py-2.5 text-left text-sm text-white ring-1 ring-white/20 transition outline-none ring-inset hover:ring-white/40 focus:ring-white/50 sm:w-56";

/**
 * Catálogo público de beats: filtra por género y por beatmaker (derivado de
 * los beats cargados), y deja escuchar un preview con un único reproductor
 * compartido (al abrir uno se cierra el que sonaba). Comprar abre el mismo
 * flujo de pago que `MembershipPayButton` (elegir método → crear el chat de
 * pago → abrir la burbuja), reutilizando `PaymentMethodPicker` +
 * `openConversation`; la venta y la entrega del máster las resuelve el
 * servidor al confirmar el pago.
 */
export function BeatsCatalog() {
  const t = useTranslations();
  const [beats, setBeats] = useState<Beat[] | null>(null);
  const [error, setError] = useState(false);
  const [genero, setGenero] = useState("");
  const [beatmaker, setBeatmaker] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let active = true;
    listBeats()
      .then((list) => {
        if (active) setBeats(list);
      })
      .catch((err) => {
        console.error("[beats-catalog]:", err);
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const generoOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: t("beats.todos") },
      ...MUSIC_GENRES.map((g) => ({ value: g, label: g })),
    ],
    [t],
  );

  // Solo los beatmakers que realmente tienen beats en el catálogo cargado.
  const beatmakerOptions: SelectOption[] = useMemo(() => {
    const byUid = new Map<string, string>();
    for (const b of beats ?? []) {
      if (!byUid.has(b.beatmakerUid)) {
        byUid.set(b.beatmakerUid, b.beatmakerNombre || b.beatmakerUid);
      }
    }
    return [
      { value: "", label: t("beats.todos") },
      ...Array.from(byUid, ([value, label]) => ({ value, label })),
    ];
  }, [beats, t]);

  const filtered = useMemo(
    () =>
      (beats ?? []).filter(
        (b) =>
          (!genero || b.genero === genero) &&
          (!beatmaker || b.beatmakerUid === beatmaker),
      ),
    [beats, genero, beatmaker],
  );

  // Si el filtro cambia (género/beatmaker) y el beat que sonaba queda fuera
  // del conjunto visible, para el reproductor: no tiene sentido seguir
  // escuchando algo que ya no se muestra en pantalla.
  useEffect(() => {
    if (playingId && !filtered.some((b) => b.id === playingId)) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
  }, [filtered, playingId]);

  function toggle(beat: Beat) {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingId === beat.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    // Solo reasignamos `src` si cambia de pista: reasignar el mismo src
    // reinicia `currentTime` a 0, lo que rompería pausar→reanudar.
    if (audio.src !== beat.audioUrl) audio.src = beat.audioUrl;
    void audio.play().catch(() => {});
    setPlayingId(beat.id);
  }

  return (
    <div>
      {/* Reproductor único compartido por todas las cards (un solo audio a la vez). */}
      <audio
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        className="hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <SearchableSelect
            value={genero}
            onChange={setGenero}
            options={generoOptions}
            placeholder={t("beats.filtroGenero")}
            searchPlaceholder={t("beats.filtroGenero")}
            emptyText={t("beats.vacio")}
            ariaLabel={t("beats.filtroGenero")}
            className={FILTER_TRIGGER}
          />
          <SearchableSelect
            value={beatmaker}
            onChange={setBeatmaker}
            options={beatmakerOptions}
            placeholder={t("beats.filtroBeatmaker")}
            searchPlaceholder={t("beats.filtroBeatmaker")}
            emptyText={t("beats.vacio")}
            ariaLabel={t("beats.filtroBeatmaker")}
            className={FILTER_TRIGGER}
          />
        </div>

        <GlassButton href="/beats/peticiones" className="shrink-0">
          <PlusIcon className="size-4" />
          {t("beats.pedirAMedida")}
        </GlassButton>
      </div>

      {beats === null ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5]" />
          ))}
        </div>
      ) : error ? (
        <p className="mt-16 text-center text-white/50">
          {t("beats.errorCargar")}
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-16 text-center text-white/50">{t("beats.vacio")}</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((beat) => (
            <BeatCard
              key={beat.id}
              beat={beat}
              playing={playingId === beat.id}
              onToggle={() => toggle(beat)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BeatCard({
  beat,
  playing,
  onToggle,
}: {
  beat: Beat;
  playing: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  const { user } = useAuth();
  const { precioBeat } = usePrecios();
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [comprando, setComprando] = useState(false);
  const [error, setError] = useState(false);

  const esPropio = !!user && beat.beatmakerUid === user.uid;

  function onComprarClick() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent("/beats")}`);
      return;
    }
    setError(false);
    setShowPicker(true);
  }

  async function iniciarCompra(metodo: MetodoPago) {
    if (!user) return;
    setShowPicker(false);
    setComprando(true);
    setError(false);
    try {
      const conversationId = await comprarBeat(user.uid, beat, metodo, precioBeat);
      openConversation(conversationId);
    } catch (err) {
      console.error("[beats-catalog] comprar:", err);
      setError(true);
    } finally {
      setComprando(false);
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm transition hover:border-white/25">
      <div className="from-amethyst-500/35 relative aspect-square overflow-hidden bg-gradient-to-br to-black">
        {beat.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={beat.coverUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MusicIcon className="size-10 text-white/25" />
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-label={playing ? t("beats.pause") : t("beats.play")}
          aria-pressed={playing}
          className={`absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40 ${
            playing ? "bg-black/40" : ""
          }`}
        >
          <span
            className={`flex size-12 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow-lg transition group-focus-within:opacity-100 group-hover:opacity-100 ${
              playing ? "opacity-100" : ""
            }`}
          >
            {playing ? (
              <PauseIcon className="size-5" />
            ) : (
              <PlayIcon className="size-6 translate-x-0.5" />
            )}
          </span>
        </button>
      </div>

      <div className="p-3">
        <p className="text-amethyst-300 flex items-center gap-1.5 text-[0.62rem] font-medium tracking-[2px] uppercase">
          <span className="truncate">{beat.genero}</span>
          {beat.bpm != null && (
            <>
              <span className="text-white/30">·</span>
              <span className="text-white/50">
                {t("beats.bpm", { bpm: beat.bpm })}
              </span>
            </>
          )}
        </p>

        <h3 className="font-narrow mt-0.5 truncate text-lg leading-tight font-bold text-white uppercase">
          {beat.titulo}
        </h3>

        {beat.beatmakerNombre &&
          (beat.beatmakerSlug ? (
            <Link
              href={`/artistas/${beat.beatmakerSlug}`}
              className="mt-0.5 block truncate text-xs text-white/50 transition hover:text-white/80"
            >
              {t("beats.por", { nombre: beat.beatmakerNombre })}
            </Link>
          ) : (
            <p className="mt-0.5 truncate text-xs text-white/50">
              {t("beats.por", { nombre: beat.beatmakerNombre })}
            </p>
          ))}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white">
            {formatCOP(precioBeat)}
          </span>
          {esPropio ? (
            <span
              title={t("beats.esTuyo")}
              className="cursor-default rounded-full border border-white/10 px-3 py-1.5 text-xs tracking-[1px] text-white/30 uppercase"
            >
              {t("beats.esTuyo")}
            </span>
          ) : (
            <button
              type="button"
              onClick={onComprarClick}
              disabled={comprando}
              aria-label={t("beats.comprar")}
              title={t("beats.elegirMetodo")}
              className="hover:border-amethyst-300/60 hover:text-amethyst-200 flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs tracking-[1px] text-white uppercase transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {comprando && <SpinnerIcon className="size-3.5 animate-spin" />}
              {t("beats.comprar")}
            </button>
          )}
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-300">{t("beats.errorComprar")}</p>
        )}

        {!esPropio && (
          <ContactBeatmakerButton
            beatmakerUid={beat.beatmakerUid}
            beatmakerNombre={beat.beatmakerNombre || t("roles.beatmaker")}
            beatTitulo={beat.titulo}
            className="mt-2"
          />
        )}
      </div>

      {showPicker && (
        // `insignia={null}` es A PROPÓSITO: el efectivo requiere insignia
        // diamante de un PERFIL DE ARTISTA, y aquí el comprador es genérico
        // (no necesariamente artista) — no cargamos su perfil solo para esto,
        // así que el picker bloquea efectivo por defecto para esta compra.
        <PaymentMethodPicker
          onPick={iniciarCompra}
          onClose={() => setShowPicker(false)}
          insignia={null}
        />
      )}
    </div>
  );
}
