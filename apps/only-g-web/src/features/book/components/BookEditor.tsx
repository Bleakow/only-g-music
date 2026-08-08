"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { getProfileBySlug } from "@/features/artists/lib/artist-profile-repo";
import {
  uploadUserBlob,
  uploadUserFile,
} from "@/features/uploads/lib/uploads-repo";
import {
  imagenMeta,
  posterDeVideo,
  videoMeta,
} from "@/features/uploads/lib/media-meta";
import { VideoTrimmer } from "@/features/artists/components/profile/VideoTrimmer";
import { isSectionOn } from "@only-g/shared-types/profile-sections";
import {
  BOOK_MAX_ESCENAS,
  BOOK_MAX_PIEZAS,
  BOOK_VIDEO_MAX_MB,
  BOOK_VIDEO_MAX_SECONDS,
  anadirEscena as anadirEscenaAlBook,
  bookGuiado,
  bookPublicable,
  contarPiezas,
  escenaDef,
  escenasElegibles,
  moverEscena,
  puedeAnadirPieza,
  puedeAnadirEscena,
  type Book,
  type EscenaTipo,
  type PiezaBook,
} from "@only-g/shared-types/book";
import { CheckIcon, EyeIcon, PlusIcon } from "@/components/icons";
import { getBook, saveBook } from "../lib/book-repo";
import { BookSceneEditor, BorrarEscena } from "./BookSceneEditor";
import { BookSceneThumb } from "./BookSceneThumb";
import { AtmosferaPanel } from "./AtmosferaPanel";
import "../book.css";

/**
 * EDITOR DEL BOOK (§10).
 *
 * Pantalla propia y no un bloque más dentro de `ProfileBuilder`: ese archivo ya
 * pasa de dos mil líneas, y el book tiene su propio documento, su propio
 * guardado y su propio concepto de "publicado".
 *
 * Se guarda SOLO, con 900 ms de espera, comparando instantáneas en JSON contra
 * lo último guardado — el mismo patrón que el editor de perfil, por el mismo
 * motivo: nadie quiere buscar el botón de guardar después de mover una foto.
 *
 * El guardado devuelve el book NORMALIZADO y ese es el que se adopta como
 * estado: si el dominio recortó un texto o despublicó un book que se quedó sin
 * contenido, la pantalla tiene que enterarse. Si no, el editor enseñaría una
 * cosa y Firestore guardaría otra.
 */

type SaveState = "idle" | "saving" | "saved" | "error";

/** Ids de escena estables sin depender de aleatoriedad en el dominio. */
let secuencia = 0;
const nuevoId = () => `e${Date.now().toString(36)}${(secuencia++).toString(36)}`;

export function BookEditor({
  slugOverride,
  adminMode = false,
}: {
  slugOverride?: string;
  adminMode?: boolean;
} = {}) {
  const t = useTranslations("bookEditor");
  const { user, account } = useAuth();
  /**
   * En modo ADMIN se edita el book del slug que se pasa; si no, el del usuario
   * logueado. Mismo reparto que `ProfileBuilder`, y por el mismo motivo: sin
   * esto, un admin montando el book de un perfil MOCK lo estaba escribiendo en
   * el suyo —el documento, el espejo y la tarjeta de entrada— porque el slug
   * salía siempre de su propia cuenta.
   */
  const slug = adminMode ? (slugOverride ?? "") : (account?.artistSlug ?? "");

  const [book, setBook] = useState<Book | null>(null);
  const [perfil, setPerfil] = useState<{
    nombre: string;
    accent: string;
    permitido: boolean;
  } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [subiendoEn, setSubiendoEn] = useState<number | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [recorte, setRecorte] = useState<{ file: File; escena: number } | null>(
    null,
  );

  // Instantánea de lo último guardado. `hidratado` evita que la primera carga se
  // guarde a sí misma nada más llegar.
  const guardadoRef = useRef<string>("");
  const hidratadoRef = useRef(false);

  useEffect(() => {
    if (!slug) return;
    let vivo = true;
    Promise.all([getProfileBySlug(slug), getBook(slug)])
      .then(([p, b]) => {
        if (!vivo) return;
        setPerfil({
          nombre: p?.artisticName ?? "",
          accent: p?.accent ?? "#8b5cf6",
          permitido: !!p && isSectionOn("book", p.sectionPrefs, p.disciplines),
        });
        // Un book NUEVO nace GUIADO: la secuencia ya montada y vacía, no un
        // lienzo con dos escenas. Quitar es mucho más fácil que imaginar, y un
        // editor que te deja delante de la nada no guía a nadie.
        setBook(b ?? bookGuiado(() => nuevoId()));
      })
      // Sin esto, un fallo de red o de reglas hacía DOS cosas malas a la vez:
      // dejaba el editor colgado en el lienzo de carga para siempre, y soltaba
      // un rechazo sin capturar por cada montaje —dos en desarrollo, que es el
      // "2" del contador de la consola—. Se cae al guardarraíl que el propio
      // componente ya tiene en vez de inventar un estado de error nuevo.
      .catch(() => {
        if (!vivo) return;
        setPerfil({ nombre: "", accent: "#8b5cf6", permitido: false });
      });
    return () => {
      vivo = false;
    };
  }, [slug]);

  // ── Autoguardado ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!book || !slug || !user) return;
    const snapshot = JSON.stringify(book);
    if (!hidratadoRef.current) {
      hidratadoRef.current = true;
      guardadoRef.current = snapshot;
      return;
    }
    if (snapshot === guardadoRef.current) return;

    const timer = setTimeout(async () => {
      setSaveState("saving");
      try {
        const limpio = await saveBook(slug, JSON.parse(snapshot) as Book);
        guardadoRef.current = JSON.stringify(limpio);
        // Se adopta lo que quedó guardado, no lo que se mandó.
        setBook(limpio);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [book, slug, user]);

  // ── Subida de piezas ────────────────────────────────────────────────────
  const anadirPieza = useCallback(
    (indice: number, pieza: PiezaBook) => {
      setBook((b) => {
        if (!b) return b;
        const escena = b.escenas[indice];
        if (!escena || !puedeAnadirPieza(b, escena, pieza.tipo)) return b;
        const escenas = [...b.escenas];
        escenas[indice] = { ...escena, piezas: [...escena.piezas, pieza] };
        return { ...b, escenas };
      });
    },
    [],
  );

  async function subirVideo(file: Blob, indice: number, ratio?: number) {
    if (!user) return;
    // El póster va PRIMERO y en paralelo mental con la subida: si fallara, el
    // clip se sube igual y se queda sin miniatura — degradar, no bloquear.
    const poster = await posterDeVideo(file);
    const ext = file.type.includes("webm") ? "webm" : "mp4";
    const [subido, posterSubido] = await Promise.all([
      uploadUserBlob(user.uid, file, `book.${ext}`),
      poster ? uploadUserBlob(user.uid, poster, "book-poster.jpg") : null,
    ]);
    anadirPieza(indice, {
      url: subido.url,
      tipo: "video",
      poster: posterSubido?.url,
      ratio,
    });
  }

  async function onFiles(indice: number, files: File[]) {
    if (!user || !book) return;
    setSubiendoEn(indice);
    try {
      for (const file of files) {
        const esVideo = file.type.startsWith("video/");
        const escena = book.escenas[indice];
        if (!escena) break;
        if (!puedeAnadirPieza(book, escena, esVideo ? "video" : "foto")) break;

        if (esVideo) {
          const meta = await videoMeta(file).catch(() => null);
          const largo =
            meta != null && meta.duration > BOOK_VIDEO_MAX_SECONDS + 0.5;
          const pesado = file.size > BOOK_VIDEO_MAX_MB * 1024 * 1024;
          // Demasiado largo o demasiado pesado → al recortador, que además
          // recomprime para caber. Rechazarlo sin más dejaría a la modelo con un
          // clip del móvil que nunca cabe y ninguna forma de arreglarlo.
          if (largo || pesado) {
            setRecorte({ file, escena: indice });
            break;
          }
          await subirVideo(file, indice, meta?.ratio);
        } else {
          const { ratio } = await imagenMeta(file);
          const { url } = await uploadUserFile(user.uid, file);
          anadirPieza(indice, { url, tipo: "foto", ratio });
        }
      }
    } catch {
      setSaveState("error");
    } finally {
      setSubiendoEn(null);
    }
  }

  // ── Escenas ─────────────────────────────────────────────────────────────
  function anadirEscena(tipo: EscenaTipo) {
    // La colocación (siempre al final, justo antes del cierre) la decide el
    // dominio: es una regla del book, no de esta pantalla, y está probada.
    setBook((b) => (b ? anadirEscenaAlBook(b, tipo, nuevoId()) : b));
    setEligiendo(false);
  }

  if (!slug) {
    return <Aviso texto={t("noSlug")} cta={t("goToProfile")} />;
  }
  if (!book || !perfil) {
    return <div className="min-h-dvh" />;
  }
  if (!perfil.permitido) {
    // En modo admin el motivo casi nunca es "está apagada": es que el perfil no
    // tiene la etiqueta `modelo`. Un perfil sin `disciplines` se lee como
    // cantante (`effectiveDisciplines` cae a ["artista"]), y entonces la sección
    // ni siquiera está desbloqueada. Decir "tu book" ahí es mentir dos veces.
    return (
      <Aviso
        texto={adminMode ? t("noSectionAdmin") : t("noSection")}
        cta={adminMode ? t("goToAdminProfile") : t("goToProfile")}
        href={adminMode ? `/admin/perfiles/${slug}/editar` : "/artista/perfil"}
      />
    );
  }

  const piezas = contarPiezas(book);
  const publicable = bookPublicable(book);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pt-24 pb-32">
      <header className="mb-8">
        <h1 className="font-narrow text-3xl font-bold tracking-wide text-white uppercase sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-silver-400 mt-2 text-sm">{t("subtitle")}</p>
      </header>

      {/* Estado del guardado + acciones. Pegajoso: mover fotos hace scroll, y
          quedarse sin ver si se está guardando pone nerviosa a cualquiera. */}
      <div className="bg-ink/85 sticky top-16 z-30 -mx-5 mb-8 flex flex-wrap items-center gap-3 px-5 py-3 backdrop-blur-md">
        <span
          className={`text-xs tracking-[2px] uppercase ${
            saveState === "error" ? "text-danger" : "text-silver-400"
          }`}
        >
          {t(`save.${saveState}`)}
        </span>
        <span className="text-silver-500 text-xs">
          {t("counter", {
            escenas: book.escenas.length,
            maxEscenas: BOOK_MAX_ESCENAS,
            piezas,
            maxPiezas: BOOK_MAX_PIEZAS,
          })}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/artistas/${slug}/book`}
            className="text-silver-200 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs tracking-[2px] uppercase transition hover:border-white/50 hover:text-white"
          >
            <EyeIcon className="size-4" />
            {t("preview")}
          </Link>
          <button
            type="button"
            disabled={!publicable && !book.publicado}
            onClick={() =>
              setBook((b) => (b ? { ...b, publicado: !b.publicado } : b))
            }
            title={!publicable && !book.publicado ? t("cannotPublish") : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs tracking-[2px] uppercase transition disabled:cursor-not-allowed disabled:opacity-40 ${
              book.publicado
                ? "bg-success/20 text-success ring-success/40 ring-1 ring-inset"
                : "btn-amethyst"
            }`}
          >
            {book.publicado && <CheckIcon className="size-4" />}
            {book.publicado ? t("published") : t("publish")}
          </button>
        </div>
      </div>

      {!publicable && (
        <p className="text-silver-500 mb-8 text-xs">{t("cannotPublish")}</p>
      )}

      {/* ── Escenas ── */}
      <div className="flex flex-col gap-5">
        {book.escenas.map((escena, i) => {
          const def = escenaDef(escena.tipo)!;
          const fija = Boolean(def.fija);
          return (
            <section
              key={escena.id}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="min-w-0">
                  <h2 className="font-narrow truncate text-lg font-bold tracking-wide text-white uppercase">
                    {t(`escenas.${escena.tipo}`)}
                  </h2>
                  <p className="text-silver-500 text-xs">
                    {t(`escenasHint.${escena.tipo}`)}
                  </p>
                </div>

                {!fija && (
                  <div className="ml-auto flex items-center gap-1.5">
                    <Flecha
                      dir="up"
                      // La primera de contenido va en el índice 1: la 0 es la portada.
                      disabled={i <= 1}
                      label={t("sceneUp")}
                      onClick={() =>
                        setBook((b) => (b ? moverEscena(b, i, i - 1) : b))
                      }
                    />
                    <Flecha
                      dir="down"
                      disabled={i >= book.escenas.length - 2}
                      label={t("sceneDown")}
                      onClick={() =>
                        setBook((b) => (b ? moverEscena(b, i, i + 1) : b))
                      }
                    />
                    <BorrarEscena
                      label={t("sceneRemove")}
                      onClick={() =>
                        setBook((b) =>
                          b
                            ? { ...b, escenas: b.escenas.filter((_, j) => j !== i) }
                            : b,
                        )
                      }
                    />
                  </div>
                )}
              </div>

              <BookSceneEditor
                escena={escena}
                subiendo={subiendoEn === i}
                puedeSubir={piezas < BOOK_MAX_PIEZAS}
                onFiles={(files) => onFiles(i, files)}
                onChange={(nueva) =>
                  setBook((b) => {
                    if (!b) return b;
                    const escenas = [...b.escenas];
                    escenas[i] = nueva;
                    return { ...b, escenas };
                  })
                }
              />
            </section>
          );
        })}
      </div>

      {/* ── Añadir escena ── */}
      <div className="mt-6">
        {eligiendo ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            <div className="mb-4 flex items-center">
              <p className="text-silver-400 text-xs tracking-[2px] uppercase">
                {t("addSceneTitle")}
              </p>
              <button
                type="button"
                onClick={() => setEligiendo(false)}
                className="text-silver-400 ml-auto text-xs uppercase hover:text-white"
              >
                {t("cancel")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {escenasElegibles().map((def) => (
                <button
                  key={def.tipo}
                  type="button"
                  onClick={() => anadirEscena(def.tipo)}
                  className="text-silver-300 flex flex-col items-start gap-2 rounded-xl p-2.5 text-left ring-1 ring-white/15 transition ring-inset hover:bg-white/5 hover:text-white hover:ring-white/40"
                >
                  {/* Animada: la modelo tiene que ver QUÉ HACE la escena antes
                      de meterle sus fotos. Parada, un díptico y un retrato son
                      el mismo par de rectángulos. */}
                  <BookSceneThumb tipo={def.tipo} ancho={132} animada />
                  <span className="text-xs font-semibold tracking-wide uppercase">
                    {t(`escenas.${def.tipo}`)}
                  </span>
                  <span className="text-silver-500 text-[0.7rem] leading-snug">
                    {t(`escenasHint.${def.tipo}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={!puedeAnadirEscena(book)}
            onClick={() => setEligiendo(true)}
            className="hover:border-amethyst-300 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 py-5 text-sm text-white/60 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlusIcon className="size-4" />
            {puedeAnadirEscena(book) ? t("addScene") : t("limitScenes")}
          </button>
        )}
      </div>

      {/* ── Atmósfera ── */}
      <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
        <h2 className="font-narrow mb-1 text-lg font-bold tracking-wide text-white uppercase">
          {t("atmosfera.title")}
        </h2>
        <p className="text-silver-500 mb-5 text-xs">{t("atmosfera.hint")}</p>
        <AtmosferaPanel
          atmosfera={book.atmosfera}
          accentDelPerfil={perfil.accent}
          nombre={perfil.nombre}
          onChange={(atmosfera) =>
            setBook((b) => (b ? { ...b, atmosfera } : b))
          }
        />
      </section>

      {recorte && (
        <VideoTrimmer
          file={recorte.file}
          accent={perfil.accent}
          maxSeconds={BOOK_VIDEO_MAX_SECONDS}
          maxBytes={BOOK_VIDEO_MAX_MB * 1024 * 1024}
          onCancel={() => setRecorte(null)}
          onConfirm={async (blob) => {
            const indice = recorte.escena;
            setRecorte(null);
            setSubiendoEn(indice);
            try {
              const meta = await videoMeta(blob).catch(() => null);
              await subirVideo(blob, indice, meta?.ratio);
            } finally {
              setSubiendoEn(null);
            }
          }}
        />
      )}
    </main>
  );
}

function Aviso({
  texto,
  cta,
  href = "/artista/perfil",
}: {
  texto: string;
  cta: string;
  href?: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-silver-300 max-w-md text-sm sm:text-base">{texto}</p>
      <Link
        href={href}
        className="border-silver-300/40 text-silver-100 hover:border-silver-100 mt-8 rounded-full border px-8 py-3 text-sm tracking-[2px] uppercase transition hover:bg-white/5"
      >
        {cta}
      </Link>
    </main>
  );
}

function Flecha({
  dir,
  disabled,
  label,
  onClick,
}: {
  dir: "up" | "down";
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="text-silver-400 flex size-9 items-center justify-center rounded-full border border-white/15 transition hover:border-white/50 hover:text-white disabled:opacity-25"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-4 ${dir === "down" ? "rotate-180" : ""}`}
        aria-hidden="true"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
