"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/components/AuthProvider";
import {
  uploadUserFile,
  uploadBeatMaster,
} from "@/features/uploads/lib/uploads-repo";
import {
  createBeat,
  deleteBeat,
  listBeatsByBeatmaker,
  updateBeat,
} from "@/features/beats/lib/beats-repo";
import { getProfileBySlug } from "@/features/artists/lib/artist-profile-repo";
import type { Beat } from "@/domain/beat";
import { MUSIC_GENRES } from "@/features/artists/data/genres";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { MusicIcon, SpinnerIcon, TrashIcon } from "@/components/icons";

const INPUT =
  "rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80";

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-silver-300 text-xs tracking-[2px] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * Publicación de beats (rol `beatmaker`): formulario para subir un beat nuevo
 * + "Mis beats" (listar/activar/desactivar/borrar los propios). La venta vive
 * en el catálogo `/beats` (botón "Comprar"); este formulario sube el PREVIEW
 * público (`audioUrl`) y, opcionalmente, el MÁSTER privado (`masterPath`) que
 * el servidor entrega al comprador tras confirmar el pago.
 */
export function PublicarBeats() {
  const t = useTranslations();
  const { user, account } = useAuth();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);

  const [titulo, setTitulo] = useState("");
  const [genero, setGenero] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioName, setAudioName] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [bpm, setBpm] = useState("");
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [masterPath, setMasterPath] = useState("");
  const [masterName, setMasterName] = useState("");
  const [uploadingMaster, setUploadingMaster] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [misBeats, setMisBeats] = useState<Beat[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [toDelete, setToDelete] = useState<Beat | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  async function loadMine() {
    if (!user) return;
    try {
      setMisBeats(await listBeatsByBeatmaker(user.uid));
      setLoadError(false);
    } catch (err) {
      console.error("[publicar-beats] load:", err);
      setLoadError(true);
    }
  }

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  async function onPickAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 25 * 1024 * 1024) {
      setError(t("photoUpload.tooLarge", { maxMb: 25 }));
      return;
    }
    setError(null);
    setUploadingAudio(true);
    try {
      const up = await uploadUserFile(user.uid, file);
      setAudioUrl(up.url);
      setAudioName(up.name);
    } catch (err) {
      console.error("[publicar-beats] audio upload:", err);
      setError(t("beats.errorPublicar"));
    } finally {
      setUploadingAudio(false);
    }
  }

  async function onPickMaster(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 100 * 1024 * 1024) {
      setError(t("photoUpload.tooLarge", { maxMb: 100 }));
      return;
    }
    setError(null);
    setUploadingMaster(true);
    try {
      const path = await uploadBeatMaster(user.uid, file);
      setMasterPath(path);
      setMasterName(file.name);
    } catch (err) {
      console.error("[publicar-beats] master upload:", err);
      setError(t("beats.errorPublicar"));
    } finally {
      setUploadingMaster(false);
    }
  }

  function resetForm() {
    setTitulo("");
    setGenero("");
    setAudioUrl("");
    setAudioName("");
    setCoverUrl("");
    setBpm("");
    setMasterPath("");
    setMasterName("");
  }

  async function publish() {
    if (!user) return;
    setError(null);

    if (!titulo.trim()) {
      setError(t("beats.faltaTitulo"));
      return;
    }
    if (!genero) {
      setError(t("beats.faltaGenero"));
      return;
    }
    if (!audioUrl) {
      setError(t("beats.faltaAudio"));
      return;
    }

    setBusy(true);
    try {
      const n = Number(bpm);
      const bpmValido =
        Number.isFinite(n) && n >= 1 && n <= 999 ? n : undefined;
      // Solo atribuimos el beat a un perfil si ese perfil EXISTE y es del propio
      // beatmaker: la regla valida PROPIEDAD (artistProfiles/{slug}.uid), no el
      // puntero users.artistSlug —que puede quedar huérfano si el alta falló a
      // medias o el admin borró el perfil—. Si no hay perfil vivo, se publica sin
      // atribución (el beat no enlaza a un perfil) en vez de bloquear la publicación.
      let beatmakerSlug: string | undefined;
      if (account?.artistSlug) {
        const perfil = await getProfileBySlug(account.artistSlug);
        if (perfil && perfil.uid === user.uid) beatmakerSlug = account.artistSlug;
      }
      await createBeat({
        beatmakerUid: user.uid,
        beatmakerSlug,
        beatmakerNombre: account?.displayName ?? undefined,
        titulo: titulo.trim(),
        genero,
        audioUrl,
        masterPath: masterPath || undefined,
        coverUrl: coverUrl || undefined,
        bpm: bpmValido,
      });
      resetForm();
      await loadMine();
    } catch (err) {
      console.error("[publicar-beats] create:", err);
      setError(t("beats.errorPublicar"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActivo(beat: Beat) {
    setRowBusy(beat.id);
    try {
      await updateBeat(beat.id, { activo: !beat.activo });
      await loadMine();
    } catch (err) {
      console.error("[publicar-beats] toggle:", err);
    } finally {
      setRowBusy(null);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setRowBusy(toDelete.id);
    try {
      await deleteBeat(toDelete.id);
      setToDelete(null);
      await loadMine();
    } catch (err) {
      console.error("[publicar-beats] delete:", err);
    } finally {
      setRowBusy(null);
    }
  }

  const generoOptions = MUSIC_GENRES.map((g) => ({ value: g, label: g }));

  return (
    <div className="mx-auto max-w-2xl px-6 pt-28 pb-24">
      <h1 className="font-narrow text-4xl font-bold uppercase sm:text-5xl">
        {t("beats.publicarTitle")}
      </h1>
      <p className="text-silver-300 mt-3">{t("beats.publicarIntro")}</p>

      {/* Alta del perfil público del beatmaker (foto/nombre/ciudad, sin cobro). */}
      <GlassButton href="/beats/perfil" className="mt-5">
        {t("beats.crearPerfilCta")}
      </GlassButton>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void publish();
        }}
        className="mt-8 flex flex-col gap-5"
      >
        <FieldShell label={t("beats.campoTitulo")}>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={INPUT}
            maxLength={80}
          />
        </FieldShell>

        <FieldShell label={t("beats.campoGenero")}>
          <SearchableSelect
            value={genero}
            onChange={setGenero}
            options={generoOptions}
            placeholder={t("beats.campoGenero")}
            searchPlaceholder={t("beats.campoGenero")}
          />
        </FieldShell>

        <FieldShell label={t("beats.campoAudioPreview")}>
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            disabled={uploadingAudio}
            className={`${INPUT} flex items-center gap-2 text-left disabled:opacity-60`}
          >
            {uploadingAudio ? (
              <>
                <SpinnerIcon className="size-4 animate-spin" />
                {t("beats.subiendo")}
              </>
            ) : audioName ? (
              <>
                <MusicIcon className="text-amethyst-300 size-4 shrink-0" />
                <span className="truncate">{audioName}</span>
              </>
            ) : (
              <span className="text-silver-400">
                {t("beats.campoAudioPreview")}
              </span>
            )}
          </button>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            onChange={onPickAudio}
            className="hidden"
          />
          <p className="text-silver-400 text-xs">
            {t("beats.audioPreviewHint")}
          </p>
        </FieldShell>

        <FieldShell label={t("beats.campoMaster")}>
          <button
            type="button"
            onClick={() => masterInputRef.current?.click()}
            disabled={uploadingMaster}
            className={`${INPUT} flex items-center gap-2 text-left disabled:opacity-60`}
          >
            {uploadingMaster ? (
              <>
                <SpinnerIcon className="size-4 animate-spin" />
                {t("beats.subiendo")}
              </>
            ) : masterName ? (
              <>
                <MusicIcon className="text-amethyst-300 size-4 shrink-0" />
                <span className="truncate">{masterName}</span>
              </>
            ) : (
              <span className="text-silver-400">{t("beats.campoMaster")}</span>
            )}
          </button>
          <input
            ref={masterInputRef}
            type="file"
            accept="audio/*"
            onChange={onPickMaster}
            className="hidden"
          />
          <p className="text-silver-400 text-xs">{t("beats.masterHint")}</p>
        </FieldShell>

        <FieldShell label={t("beats.campoPortada")}>
          <PhotoUpload
            value={coverUrl}
            onChange={setCoverUrl}
            aspect="aspect-square"
          />
        </FieldShell>

        <FieldShell label={t("beats.campoBpm")}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            className={INPUT}
          />
        </FieldShell>

        {error && <p className="text-sm text-red-300">{error}</p>}

        {/* GlassButton siempre renderiza <button type="button">, así que el
            submit real lo dispara este onClick (no la navegación nativa del
            form) — el <form> solo aporta el "Enter para enviar" en los campos
            de texto, que cae en el mismo onSubmit. */}
        <GlassButton
          onClick={() => void publish()}
          disabled={busy || uploadingAudio || uploadingMaster}
          className="self-start"
        >
          {busy ? t("beats.publicando") : t("beats.publicar")}
        </GlassButton>
      </form>

      <h2 className="font-narrow mt-16 text-2xl font-bold uppercase">
        {t("beats.misBeats")}
      </h2>

      {misBeats === null ? (
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : loadError ? (
        <p className="text-silver-400 mt-4 text-sm">{t("beats.errorCargar")}</p>
      ) : misBeats.length === 0 ? (
        <p className="text-silver-400 mt-4 text-sm">{t("beats.sinBeats")}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {misBeats.map((beat) => (
            <li
              key={beat.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3"
            >
              <div className="from-amethyst-500/35 flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br to-black">
                {beat.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={beat.coverUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <MusicIcon className="size-5 text-white/30" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {beat.titulo}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="text-silver-400 truncate text-xs">
                    {beat.genero}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] tracking-wide uppercase ${
                      beat.masterPath
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/[0.06] text-white/40"
                    }`}
                  >
                    {beat.masterPath
                      ? t("beats.conMaster")
                      : t("beats.sinMaster")}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleActivo(beat)}
                disabled={rowBusy === beat.id}
                className="border-silver-300/30 text-silver-200 hover:border-amethyst-300/60 shrink-0 rounded-full border px-3 py-1.5 text-xs tracking-[1px] uppercase transition disabled:opacity-50"
              >
                {beat.activo ? t("beats.desactivar") : t("beats.activar")}
              </button>

              <button
                type="button"
                onClick={() => setToDelete(beat)}
                disabled={rowBusy === beat.id}
                aria-label={t("beats.borrar")}
                className="shrink-0 rounded-full border border-red-500/25 p-2 text-red-300 transition hover:border-red-400/60 hover:text-red-200 disabled:opacity-50"
              >
                <TrashIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <GlassModal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={t("beats.borrarConfirm")}
      >
        <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
          <GlassButton
            onClick={() => setToDelete(null)}
            disabled={rowBusy === toDelete?.id}
          >
            {t("common.cancel")}
          </GlassButton>
          <GlassButton
            onClick={confirmDelete}
            disabled={rowBusy === toDelete?.id}
            className="!text-red-200"
          >
            {rowBusy === toDelete?.id ? (
              <SpinnerIcon className="size-4 animate-spin" />
            ) : (
              <TrashIcon className="size-4" />
            )}
            {t("beats.borrar")}
          </GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}
