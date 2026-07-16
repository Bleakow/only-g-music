"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { hasRole } from "@/domain/user";
import type { BeatRequest, BeatRequestEstado } from "@/domain/beat";
import {
  createBeatRequest,
  listBeatRequestsAbiertas,
  listMisPeticiones,
  tomarBeatRequest,
} from "@/features/beats/lib/beat-requests-repo";
import { uploadUserFile } from "@/features/uploads/lib/uploads-repo";
import { MUSIC_GENRES } from "@/features/artists/data/genres";
import { fechaCorta } from "@/features/solicitudes/lib/estados";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { MusicIcon, PlusIcon, SpinnerIcon } from "@/components/icons";

const INPUT =
  "rounded-lg border border-white/15 bg-black/30 px-4 py-2.5 text-silver-50 outline-none transition focus:border-amethyst-300 focus:ring-1 focus:ring-amethyst-300/80";

const ESTADO_BADGE: Record<BeatRequestEstado, string> = {
  abierta: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  tomada: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  entregada: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  cerrada: "border-white/20 bg-white/5 text-silver-200",
};

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
 * Peticiones de beat a medida (slice 2b): cualquier usuario con sesión puede
 * pedir un beat (describe su idea + sube un ejemplo/referencia opcional) y
 * seguir sus peticiones ("Mis peticiones"). Un usuario con rol `beatmaker`
 * ve además las peticiones abiertas de otros y puede TOMAR una (asignársela);
 * el hilo de chat beatmaker↔cliente para coordinar la entrega es otro slice —
 * aquí solo se avisa de coordinarlo manualmente.
 */
export function PeticionesBeats() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, account } = useAuth();
  const esBeatmaker = hasRole(account, "beatmaker");
  const ejemploInputRef = useRef<HTMLInputElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [genero, setGenero] = useState("");
  const [ejemploUrl, setEjemploUrl] = useState("");
  const [ejemploName, setEjemploName] = useState("");
  const [uploadingEjemplo, setUploadingEjemplo] = useState(false);
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [misPeticiones, setMisPeticiones] = useState<BeatRequest[] | null>(
    null,
  );
  const [misError, setMisError] = useState(false);

  const [abiertas, setAbiertas] = useState<BeatRequest[] | null>(null);
  const [abiertasError, setAbiertasError] = useState(false);
  const [tomarBusyId, setTomarBusyId] = useState<string | null>(null);
  const [tomarError, setTomarError] = useState<string | null>(null);

  async function loadMisPeticiones() {
    if (!user) return;
    try {
      setMisPeticiones(await listMisPeticiones(user.uid));
      setMisError(false);
    } catch (err) {
      console.error("[peticiones-beats] mis peticiones:", err);
      setMisError(true);
    }
  }

  useEffect(() => {
    loadMisPeticiones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  async function loadAbiertas() {
    try {
      setAbiertas(await listBeatRequestsAbiertas());
      setAbiertasError(false);
    } catch (err) {
      console.error("[peticiones-beats] abiertas:", err);
      setAbiertasError(true);
    }
  }

  useEffect(() => {
    if (esBeatmaker) loadAbiertas();
  }, [esBeatmaker]);

  async function onPickEjemplo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 25 * 1024 * 1024) {
      // Copy genérico: el ejemplo puede ser audio o imagen, no asumir "imagen".
      setFormError(t("fileUpload.tooLarge", { name: file.name, maxMb: 25 }));
      return;
    }
    setFormError(null);
    setUploadingEjemplo(true);
    try {
      const up = await uploadUserFile(user.uid, file);
      setEjemploUrl(up.url);
      setEjemploName(up.name);
    } catch (err) {
      console.error("[peticiones-beats] ejemplo upload:", err);
      setFormError(t("beats.peticionError"));
    } finally {
      setUploadingEjemplo(false);
    }
  }

  function resetForm() {
    setDescripcion("");
    setGenero("");
    setEjemploUrl("");
    setEjemploName("");
  }

  async function enviar() {
    if (!user || !descripcion.trim()) return;
    setFormError(null);
    setSending(true);
    try {
      await createBeatRequest({
        uid: user.uid,
        clientName: account?.displayName ?? null,
        descripcion: descripcion.trim(),
        genero: genero || undefined,
        ejemploUrl: ejemploUrl || undefined,
      });
      resetForm();
      setShowModal(false);
      await loadMisPeticiones();
    } catch (err) {
      console.error("[peticiones-beats] crear:", err);
      setFormError(t("beats.peticionError"));
    } finally {
      setSending(false);
    }
  }

  async function tomar(req: BeatRequest) {
    if (!user) return;
    setTomarError(null);
    setTomarBusyId(req.id);
    try {
      await tomarBeatRequest(req.id, user.uid);
      // La quitamos de "abiertas" SOLO al confirmar: así el spinner de la fila
      // es visible durante la toma y, si falla, la fila permanece (revert).
      setAbiertas((list) => (list ?? []).filter((r) => r.id !== req.id));
    } catch (err) {
      console.error("[peticiones-beats] tomar:", err);
      setTomarError(t("beats.tomarError"));
    } finally {
      setTomarBusyId(null);
    }
  }

  const generoOptions = [
    { value: "", label: t("beats.cualquiera") },
    ...MUSIC_GENRES.map((g) => ({ value: g, label: g })),
  ];

  return (
    <div className="mx-auto max-w-2xl px-6 pt-28 pb-24">
      <h1 className="font-narrow text-4xl font-bold uppercase sm:text-5xl">
        {t("beats.peticionesTitle")}
      </h1>
      <p className="text-silver-300 mt-3">{t("beats.peticionesIntro")}</p>

      <GlassButton
        onClick={() => {
          setFormError(null);
          setShowModal(true);
        }}
        className="mt-6"
      >
        <PlusIcon className="size-4" />
        {t("beats.solicitar")}
      </GlassButton>

      {/* ── Mis peticiones ─────────────────────────────────────────── */}
      <h2 className="font-narrow mt-16 text-2xl font-bold uppercase">
        {t("beats.misPeticiones")}
      </h2>

      {misPeticiones === null ? (
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : misError ? (
        <p className="text-silver-400 mt-4 text-sm">
          {t("beats.peticionCargarError")}
        </p>
      ) : misPeticiones.length === 0 ? (
        <p className="text-silver-400 mt-4 text-sm">
          {t("beats.sinMisPeticiones")}
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {misPeticiones.map((req) => (
            <li
              key={req.id}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-silver-400 text-xs">
                    {fechaCorta(req.createdAt, locale)}
                  </p>
                  <p className="mt-1 text-sm text-white">{req.descripcion}</p>
                  {req.genero && (
                    <p className="text-silver-400 mt-1 text-xs">{req.genero}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${ESTADO_BADGE[req.estado]}`}
                >
                  {t(`beats.peticionEstado.${req.estado}`)}
                </span>
              </div>
              {req.tomadaPor && (
                <p className="text-amethyst-300 mt-2 text-xs">
                  {t("beats.tomadaAviso")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ── Peticiones abiertas (solo beatmaker) ──────────────────────── */}
      {esBeatmaker && (
        <>
          <h2 className="font-narrow mt-16 text-2xl font-bold uppercase">
            {t("beats.abiertas")}
          </h2>
          <p className="text-silver-400 mt-2 text-sm">
            {t("beats.tomarAviso")}
          </p>

          {abiertas === null ? (
            <div className="mt-4 flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : abiertasError ? (
            <p className="text-silver-400 mt-4 text-sm">
              {t("beats.peticionCargarError")}
            </p>
          ) : abiertas.filter((r) => r.uid !== user?.uid).length === 0 ? (
            <p className="text-silver-400 mt-4 text-sm">
              {t("beats.sinAbiertas")}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {abiertas
                .filter((r) => r.uid !== user?.uid)
                .map((req) => (
                  <li
                    key={req.id}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-silver-400 text-xs">
                          {fechaCorta(req.createdAt, locale)}
                          {req.clientName ? ` · ${req.clientName}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-white">
                          {req.descripcion}
                        </p>
                        <div className="text-silver-400 mt-1 flex flex-wrap items-center gap-2 text-xs">
                          {req.genero && <span>{req.genero}</span>}
                          {req.ejemploUrl && (
                            <a
                              href={req.ejemploUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-amethyst-300 hover:text-amethyst-200 underline-offset-2 hover:underline"
                            >
                              {t("beats.campoEjemplo")}
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => tomar(req)}
                        disabled={tomarBusyId === req.id}
                        className="border-silver-300/30 text-silver-200 hover:border-amethyst-300/60 flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs tracking-[1px] uppercase transition disabled:opacity-50"
                      >
                        {tomarBusyId === req.id ? (
                          <>
                            <SpinnerIcon className="size-3.5 animate-spin" />
                            {t("beats.tomando")}
                          </>
                        ) : (
                          t("beats.tomar")
                        )}
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}

          {tomarError && (
            <p className="mt-3 text-sm text-red-300">{tomarError}</p>
          )}
        </>
      )}

      <GlassModal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={t("beats.solicitar")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
          className="flex flex-col gap-5"
        >
          <FieldShell label={t("beats.campoDescripcion")}>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              maxLength={600}
              className={`${INPUT} resize-none`}
            />
          </FieldShell>

          <FieldShell label={t("beats.campoGeneroOpcional")}>
            <SearchableSelect
              value={genero}
              onChange={setGenero}
              options={generoOptions}
              placeholder={t("beats.cualquiera")}
              searchPlaceholder={t("beats.campoGeneroOpcional")}
            />
          </FieldShell>

          <FieldShell label={t("beats.campoEjemplo")}>
            <button
              type="button"
              onClick={() => ejemploInputRef.current?.click()}
              disabled={uploadingEjemplo}
              className={`${INPUT} flex items-center gap-2 text-left disabled:opacity-60`}
            >
              {uploadingEjemplo ? (
                <>
                  <SpinnerIcon className="size-4 animate-spin" />
                  {t("beats.subiendo")}
                </>
              ) : ejemploName ? (
                <>
                  <MusicIcon className="text-amethyst-300 size-4 shrink-0" />
                  <span className="truncate">{ejemploName}</span>
                </>
              ) : (
                <span className="text-silver-400">
                  {t("beats.campoEjemplo")}
                </span>
              )}
            </button>
            <input
              ref={ejemploInputRef}
              type="file"
              accept="audio/*,image/*"
              onChange={onPickEjemplo}
              className="hidden"
            />
          </FieldShell>

          {formError && <p className="text-sm text-red-300">{formError}</p>}

          <GlassButton
            onClick={() => void enviar()}
            disabled={sending || uploadingEjemplo || !descripcion.trim()}
            className="self-start"
          >
            {sending && <SpinnerIcon className="size-4 animate-spin" />}
            {sending ? t("beats.enviando") : t("beats.enviarPeticion")}
          </GlassButton>
        </form>
      </GlassModal>
    </div>
  );
}
