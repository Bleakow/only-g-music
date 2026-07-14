"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/features/auth/components/AuthProvider";
import {
  uploadUserFile,
  uploadUserBlob,
} from "@/features/uploads/lib/uploads-repo";
import type { SocialPlatform } from "@/domain/artist";
import {
  type EditableProfile,
  type ProfileTrack,
  type PhotoTransform,
  type PlayerSize,
  type GalleryItem,
  type Premium,
  DEFAULT_PHOTO_TRANSFORM,
  DEFAULT_PLAYER_X,
  DEFAULT_PLAYER_Y,
  DEFAULT_PLAYER_SIZE,
  GALLERY_LIMIT,
  nextGallerySpan,
  insigniaDePuntos,
  photoTransformCss,
  premiumEstado,
} from "@/domain/artist-profile";
import { createPaymentConversation } from "@/features/conversations/lib/conversations-repo";
import { openConversation } from "@/features/conversations/lib/open-conversation";
import { usePrecios } from "@/features/pricing/components/PreciosProvider";
import { PaymentMethodPicker } from "@/features/conversations/components/PaymentMethodPicker";
import type { MetodoPago } from "@/domain/payment-method";
import {
  createProfile,
  getProfileBySlug,
  updateProfile,
} from "../../lib/artist-profile-repo";
import { SocialPalette } from "./SocialPalette";
import { ProfileAudioPlayer, PLAYER_SIZE_W } from "./ProfileAudioPlayer";
import { AudioTrimModal } from "./AudioTrimModal";
import { GalleryBento } from "./GalleryBento";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { LocationPicker } from "@/features/location/components/LocationPicker";
import { formatLocation, type GeoLocation } from "@/domain/location";
import { useMediaQuery } from "@/lib/use-media-query";
import { MUSIC_GENRES } from "../../data/genres";
import {
  PlusIcon,
  CloseIcon,
  CheckIcon,
  SpinnerIcon,
  MoveIcon,
  EyeIcon,
  EyeOffIcon,
  EditIcon,
  ImageIcon,
  CropIcon,
  RepeatIcon,
  MusicIcon,
  TrashIcon,
  CrosshairIcon,
  MinusIcon,
  RotateCwIcon,
  RotateCcwIcon,
  ArrowLeftIcon,
} from "@/components/icons";

const CURRENT_YEAR = new Date().getFullYear();
const MAX_MB = 25;
const GENRE_OPTIONS = MUSIC_GENRES.map((g) => ({ value: g, label: g }));

let trackSeq = 0;
interface EditorTrack extends ProfileTrack {
  _id: string;
}
const newTrack = (): EditorTrack => ({
  _id: `t${trackSeq++}`,
  title: "",
  youtubeUrl: "",
  spotifyUrl: "",
});

type SaveState = "idle" | "saving" | "saved" | "error";

/** Botón que abre un selector de archivos oculto y entrega los File elegidos.
 *  `glass` lo renderiza como GlassButton (mismo estilo que Atrás/Ajustes). */
function UploadButton({
  accept,
  multiple,
  disabled,
  onFiles,
  className,
  children,
  glass,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  children: React.ReactNode;
  glass?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      {glass ? (
        <GlassButton onClick={() => ref.current?.click()} disabled={disabled}>
          {children}
        </GlassButton>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => ref.current?.click()}
          className={className}
        >
          {children}
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

/**
 * Editor in-place del perfil de artista (WYSIWYG). En vez de un formulario, se
 * rellenan slots sobre una plantilla fija. Auto-guardado (debounced) con
 * indicador. El perfil vive como borrador hasta publicarse (15d-5).
 */
/**
 * Editor del perfil. En modo artista (por defecto) edita el perfil del usuario
 * logueado (su `artistSlug`). En modo ADMIN (`adminMode` + `slugOverride`) edita
 * CUALQUIER perfil por slug y oculta el flujo de pago/publicación (el admin
 * gestiona la membresía desde la grilla, no desde aquí).
 */
export function ProfileBuilder({
  slugOverride,
  adminMode = false,
}: {
  slugOverride?: string;
  adminMode?: boolean;
} = {}) {
  const t = useTranslations();
  const { user, account, refreshAccount } = useAuth();
  const { precioPerfil } = usePrecios();
  const slug = adminMode ? (slugOverride ?? "") : (account?.artistSlug ?? "");

  const [showPagoPicker, setShowPagoPicker] = useState(false);
  const [puntos, setPuntos] = useState(0);
  const [synced, setSynced] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const existsRef = useRef(false);
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef("");

  const [artisticName, setArtisticName] = useState("");
  const [tagline, setTagline] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [locOpen, setLocOpen] = useState(false);
  const [bio, setBio] = useState("");
  const [accent, setAccent] = useState("#8b5cf6");
  const [startYear, setStartYear] = useState(CURRENT_YEAR);
  const [photoURL, setPhotoURL] = useState("");
  // Foto vertical opcional para móvil (art direction). La principal es para PC.
  const [photoMobile, setPhotoMobile] = useState("");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [songURL, setSongURL] = useState("");
  // Archivo elegido pendiente de recortar (abre el AudioTrimModal). Lo que se
  // sube es el FRAGMENTO, no este archivo.
  const [trimFile, setTrimFile] = useState<File | null>(null);
  // Confirmación antes de quitar la canción (acción destructiva).
  const [confirmRemoveSong, setConfirmRemoveSong] = useState(false);
  // Aviso de "publica tu perfil" al intentar verlo sin membresía vigente.
  const [showPublishGate, setShowPublishGate] = useState(false);
  const [playerOverlay, setPlayerOverlay] = useState(true);
  const [playerX, setPlayerX] = useState(DEFAULT_PLAYER_X);
  const [playerY, setPlayerY] = useState(DEFAULT_PLAYER_Y);
  const [playerSize, setPlayerSize] = useState<PlayerSize>(DEFAULT_PLAYER_SIZE);
  const [tracks, setTracks] = useState<EditorTrack[]>([]);
  const [socials, setSocials] = useState<
    Partial<Record<SocialPlatform, string>>
  >({});

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploading, setUploading] = useState<string | null>(null);
  const [premiumData, setPremiumData] = useState<Premium | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pt, setPt] = useState<PhotoTransform>(DEFAULT_PHOTO_TRANSFORM);
  const [adjusting, setAdjusting] = useState(false);
  // Detecta la pantalla actual (mismo corte que el perfil público: 640px/sm)
  // para saber a qué slot va la primera foto subida.
  const isMobileScreen = useMediaQuery("(max-width: 639.98px)");
  // Modal de sincronización: pide confirmar/encuadrar la foto para la OTRA
  // pantalla (la que no se acaba de subir). `target` = esa otra pantalla.
  const [syncPrompt, setSyncPrompt] = useState<{
    url: string;
    target: "desktop" | "mobile";
  } | null>(null);
  const dragRef = useRef({
    active: false,
    sx: 0,
    sy: 0,
    bx: 0,
    by: 0,
    w: 1,
    h: 1,
  });
  const heroRef = useRef<HTMLElement | null>(null);
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const playerDragRef = useRef({ active: false, dx: 0, dy: 0 });

  useEffect(() => {
    let active = true;
    refreshAccount().finally(() => active && setSynced(true));
    return () => {
      active = false;
    };
  }, [refreshAccount]);

  useEffect(() => {
    if (!slug) {
      setLoaded(true);
      return;
    }
    let active = true;
    getProfileBySlug(slug)
      .then((p) => {
        if (!active) return;
        if (p) {
          existsRef.current = true;
          setArtisticName(p.artisticName);
          setTagline(p.tagline);
          setGenres(
            p.genres && p.genres.length ? p.genres : p.genre ? [p.genre] : [],
          );
          setCity(p.city ?? "");
          setLocation(p.location ?? null);
          setBio(p.bio);
          setAccent(p.accent);
          setStartYear(p.trajectoryStartYear || CURRENT_YEAR);
          setPhotoURL(p.photoURL);
          setPhotoMobile(p.photoURLMobile ?? "");
          setPt(p.photoTransform ?? DEFAULT_PHOTO_TRANSFORM);
          setGallery(p.gallery);
          setSongURL(p.entryTrackUrl ?? "");
          setPlayerOverlay(p.playerOverlay ?? true);
          setPlayerX(p.playerX ?? DEFAULT_PLAYER_X);
          setPlayerY(p.playerY ?? DEFAULT_PLAYER_Y);
          setPlayerSize(p.playerSize ?? DEFAULT_PLAYER_SIZE);
          setTracks(p.tracks.map((t) => ({ ...t, _id: `t${trackSeq++}` })));
          setSocials(p.socials);
          setPremiumData(p.premium);
          setPuntos(p.puntos ?? 0);
        } else if (!adminMode && account?.artistDraft) {
          const d = account.artistDraft;
          setArtisticName(d.artisticName);
          setStartYear(d.trajectoryStartYear || CURRENT_YEAR);
          if (d.photoURL) setPhotoURL(d.photoURL);
        }
        setLoaded(true);
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
    // Carga una vez por slug; no dependemos de `account` para no pisar la edición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const ready = synced && loaded;

  function buildEditable(): EditableProfile {
    const cleanSocials: Partial<Record<SocialPlatform, string>> = {};
    for (const [k, v] of Object.entries(socials)) {
      const trimmed = v?.trim();
      if (trimmed) cleanSocials[k as SocialPlatform] = trimmed;
    }
    return {
      artisticName: artisticName.trim(),
      tagline: tagline.trim(),
      genre: genres[0] ?? "",
      genres,
      city: city.trim() || undefined,
      location: location ?? undefined,
      bio: bio.trim(),
      accent,
      photoURL,
      photoURLMobile: photoMobile || undefined,
      photoTransform: pt,
      gallery,
      tracks: tracks
        .filter((t) => t.title.trim())
        .map((t) => ({
          title: t.title.trim(),
          youtubeUrl: t.youtubeUrl?.trim() || undefined,
          spotifyUrl: t.spotifyUrl?.trim() || undefined,
        })),
      entryTrackUrl: songURL || undefined,
      playerOverlay,
      playerX: Math.round(playerX),
      playerY: Math.round(playerY),
      playerSize,
      socials: cleanSocials,
      trajectoryStartYear: Number(startYear) || CURRENT_YEAR,
    };
  }

  // Auto-guardado: al cambiar algo, debounce y guarda. Adopta el estado cargado
  // como línea base (primer run) para no guardar de más justo tras cargar.
  useEffect(() => {
    if (!ready || !slug || !user) return;
    const snapshot = JSON.stringify(buildEditable());
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      lastSavedRef.current = snapshot;
      return;
    }
    if (snapshot === lastSavedRef.current) return;
    const timer = setTimeout(async () => {
      setSaveState("saving");
      setError(null);
      try {
        const editable: EditableProfile = JSON.parse(snapshot);
        if (existsRef.current) await updateProfile(slug, editable);
        else {
          await createProfile(user.uid, slug, editable, null);
          existsRef.current = true;
        }
        lastSavedRef.current = snapshot;
        setSaveState("saved");
      } catch (e) {
        console.error("[builder] save:", e);
        setSaveState("error");
        setError(t("profileBuilder.errors.autoSave"));
      }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    artisticName,
    tagline,
    genres,
    city,
    location,
    bio,
    accent,
    startYear,
    photoURL,
    photoMobile,
    pt,
    gallery,
    songURL,
    playerOverlay,
    playerX,
    playerY,
    playerSize,
    tracks,
    socials,
    ready,
    slug,
    user,
  ]);

  async function uploadFiles(files: File[]): Promise<string[]> {
    if (!user) return [];
    const out: string[] = [];
    for (const f of files) {
      if (f.size > MAX_MB * 1024 * 1024) {
        setError(
          t("profileBuilder.errors.fileTooLarge", {
            name: f.name,
            maxMb: MAX_MB,
          }),
        );
        continue;
      }
      const u = await uploadUserFile(user.uid, f);
      out.push(u.url);
    }
    return out;
  }

  // Subida principal, consciente de la pantalla. La foto va al slot de la
  // pantalla actual; luego se ofrece configurar la OTRA pantalla (reusar la
  // misma o subir una versión dedicada).
  async function onPhotoUpload(files: File[]) {
    setUploading("photo");
    setError(null);
    try {
      const [url] = await uploadFiles(files.slice(0, 1));
      if (!url) return;
      if (isMobileScreen) {
        setPhotoMobile(url);
        if (!photoURL) setPhotoURL(url); // la principal (escritorio) es obligatoria
        setSyncPrompt({ url, target: "desktop" });
      } else {
        setPhotoURL(url);
        setSyncPrompt({ url, target: "mobile" });
      }
    } finally {
      setUploading(null);
    }
  }

  // Subir una foto DISTINTA para la otra pantalla (desde el modal de sync).
  async function onPhotoOther(files: File[]) {
    const target = syncPrompt?.target;
    setUploading("photoOther");
    setError(null);
    try {
      const [url] = await uploadFiles(files.slice(0, 1));
      if (!url) return;
      if (target === "desktop") setPhotoURL(url);
      else setPhotoMobile(url);
    } finally {
      setUploading(null);
      setSyncPrompt(null);
    }
  }

  // Reutilizar la misma foto recién subida para la otra pantalla.
  function reuseForOther() {
    if (!syncPrompt) return;
    if (syncPrompt.target === "desktop") setPhotoURL(syncPrompt.url);
    else setPhotoMobile(""); // móvil reutiliza la principal (fallback centrado)
    setSyncPrompt(null);
  }

  // Abrir el modal para gestionar la OTRA pantalla manualmente (sin resubir).
  function openOtherScreen() {
    const target: "desktop" | "mobile" = isMobileScreen ? "desktop" : "mobile";
    const url = target === "desktop" ? photoURL : photoMobile || photoURL;
    if (!url) return;
    setSyncPrompt({ url, target });
  }
  // Elegir canción = abrir el recortador con el archivo. La subida real ocurre
  // en onTrimConfirm con SOLO el fragmento recortado.
  function pickSong(files: File[]) {
    const f = files[0];
    if (!f) return;
    setError(null);
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(
        t("profileBuilder.errors.fileTooLarge", {
          name: f.name,
          maxMb: MAX_MB,
        }),
      );
      return;
    }
    setTrimFile(f);
  }

  // Sube el Blob recortado (MP3) y cierra el modal. Si falla, relanza para que el
  // modal muestre el error y siga abierto (no perdemos el recorte hecho).
  async function onTrimConfirm(blob: Blob) {
    if (!user) return;
    setUploading("song");
    setError(null);
    try {
      const up = await uploadUserBlob(user.uid, blob, "intro.mp3");
      setSongURL(up.url);
      setTrimFile(null);
    } catch (e) {
      console.error("[builder] trim upload:", e);
      throw e;
    } finally {
      setUploading(null);
    }
  }
  async function onGallery(files: File[]) {
    setUploading("gallery");
    setError(null);
    try {
      const room = GALLERY_LIMIT - gallery.length;
      const urls = await uploadFiles(files.slice(0, Math.max(0, room)));
      if (urls.length)
        setGallery((g) =>
          [...g, ...urls.map((url) => ({ url, span: "sq" as const }))].slice(
            0,
            GALLERY_LIMIT,
          ),
        );
    } finally {
      setUploading(null);
    }
  }

  // Redimensiona (cicla el tamaño) una foto del bento.
  function cycleGallerySpan(i: number) {
    setGallery((g) =>
      g.map((it, idx) =>
        idx === i ? { ...it, span: nextGallerySpan(it.span) } : it,
      ),
    );
  }

  function setTrack(i: number, patch: Partial<ProfileTrack>) {
    setTracks((prev) =>
      prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    );
  }

  // Arrastre para reposicionar la foto (pan) en modo ajuste.
  function startDrag(e: React.PointerEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      bx: pt.x,
      by: pt.y,
      w: rect.width,
      h: rect.height,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onDrag(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = ((e.clientX - d.sx) / d.w) * 100;
    const dy = ((e.clientY - d.sy) / d.h) * 100;
    setPt((p) => ({ ...p, x: d.bx + dx, y: d.by + dy }));
  }
  function endDrag() {
    dragRef.current.active = false;
  }

  // Arrastre libre del reproductor sobre la foto. Mueve el CENTRO del player
  // conservando el punto de agarre (offset puntero↔centro) para que no pegue un
  // brinco al agarrar el asa (que está por encima del player).
  function startPlayerDrag(e: React.PointerEvent) {
    const box = playerBoxRef.current?.getBoundingClientRect();
    const cx = box ? box.left + box.width / 2 : e.clientX;
    const cy = box ? box.top + box.height / 2 : e.clientY;
    playerDragRef.current = {
      active: true,
      dx: cx - e.clientX,
      dy: cy - e.clientY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPlayerDrag(e: React.PointerEvent) {
    if (!playerDragRef.current.active) return;
    const hero = heroRef.current?.getBoundingClientRect();
    if (!hero) return;
    // Clamp con el TAMAÑO REAL del reproductor (medido) para que nunca se salga
    // del marco. Si la caja es más grande que el hero, se centra en ese eje.
    const box = playerBoxRef.current?.getBoundingClientRect();
    const halfW = box ? (box.width / 2 / hero.width) * 100 : 12;
    const halfH = box ? (box.height / 2 / hero.height) * 100 : 14;
    const minX = Math.min(50, halfW);
    const maxX = Math.max(50, 100 - halfW);
    const minY = Math.min(50, halfH);
    const maxY = Math.max(50, 100 - halfH);
    const px = e.clientX + playerDragRef.current.dx;
    const py = e.clientY + playerDragRef.current.dy;
    const x = ((px - hero.left) / hero.width) * 100;
    const y = ((py - hero.top) / hero.height) * 100;
    setPlayerX(Math.min(maxX, Math.max(minX, x)));
    setPlayerY(Math.min(maxY, Math.max(minY, y)));
  }
  function endPlayerDrag() {
    playerDragRef.current.active = false;
  }
  /** Recupera el reproductor si quedó atascado en una esquina. */
  function recenterPlayer() {
    setPlayerX(DEFAULT_PLAYER_X);
    setPlayerY(DEFAULT_PLAYER_Y);
  }

  // Activa/renueva la suscripción: abre el selector de método; al elegir, crea el
  // chat de pago de premium y abre la burbuja en él. El admin confirma el pago
  // (Cloud Function confirmPayment) → premium activado + hilo cerrado.
  function renovar() {
    if (!user || !slug) return;
    setShowPagoPicker(true);
  }

  async function iniciarPago(metodo: MetodoPago) {
    if (!user || !slug) return;
    setShowPagoPicker(false);
    try {
      const id = await createPaymentConversation({
        uid: user.uid,
        concepto: "premium",
        ref: { kind: "premium", id: slug },
        metodo,
        monto: precioPerfil,
      });
      openConversation(id);
    } catch (e) {
      console.error("[builder] iniciarPago:", e);
      setError(t("pago.startError"));
    }
  }

  if (!slug) {
    return (
      <main className="mx-auto min-h-dvh max-w-lg px-6 pt-28 pb-24 text-center">
        <h1 className="font-narrow text-4xl font-bold uppercase">
          {t("profileBuilder.noSlug.title")}
        </h1>
        <p className="text-silver-300 mt-3">
          {t("profileBuilder.noSlug.description")}
        </p>
        <Link
          href="/artista/nuevo"
          className="from-silver-100 to-amethyst-300 text-ink mt-8 inline-flex rounded-full bg-gradient-to-r px-7 py-3 text-sm font-semibold tracking-[2px] uppercase"
        >
          {t("profileBuilder.noSlug.cta")}
        </Link>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="min-h-dvh pb-24">
        <Skeleton className="h-dvh w-full rounded-none" />
        <div className="mx-auto mt-8 max-w-3xl px-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="mt-4 h-20 w-full" />
          <Skeleton className="mt-3 h-20 w-full" />
        </div>
      </main>
    );
  }

  const titleInput =
    "w-full bg-transparent font-narrow text-5xl font-bold uppercase leading-[0.9] text-white outline-none placeholder:text-white/30 sm:text-7xl";
  const ghostInput =
    "rounded-lg bg-white/[0.02] px-3 py-2 text-silver-50 outline-none ring-1 ring-inset ring-white/15 backdrop-blur-md transition focus:bg-white/[0.06] focus:ring-white/40 placeholder:text-white/30";
  // Campo de cristal MÁS visible para los chips sobre la foto (género/ciudad/año):
  // ahí sí hay imagen detrás, así que el blur frostea la foto = cristal real.
  const glassField =
    "rounded-full bg-white/[0.08] px-4 py-2 text-center outline-none ring-1 ring-inset ring-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur-md transition placeholder:text-white/50 focus:bg-white/[0.14] focus:ring-white/60";

  // Visibilidad en la vitrina = suscripción (premium) vigente: pagar = publicar.
  // El chip refleja el estado real y avisa cuando vence / está por vencer.
  const now = Date.now();
  const estadoPremium = premiumEstado(premiumData, now);
  const diasRestantes = premiumData
    ? Math.ceil((premiumData.expiresAt - now) / 86_400_000)
    : 0;
  const porVencer = estadoPremium === "activo" && diasRestantes <= 7;
  const pubChip =
    estadoPremium === "activo"
      ? porVencer
        ? {
            label: t("profileBuilder.premium.expiresIn", {
              days: diasRestantes,
            }),
            cls: "bg-amber-500/15 text-amber-300",
          }
        : {
            label: t("profileBuilder.premium.published"),
            cls: "bg-emerald-500/15 text-emerald-300",
          }
      : estadoPremium === "expirado"
        ? {
            label: t("profileBuilder.premium.expired"),
            cls: "bg-red-500/15 text-red-300",
          }
        : {
            label: t("profileBuilder.premium.draft"),
            cls: "bg-white/10 text-silver-300",
          };
  // ¿Mostrar acción de pago? Sin suscripción, vencida, o por vencer.
  const mostrarRenovar = estadoPremium !== "activo" || porVencer;
  const renovarLabel =
    estadoPremium === "ninguno"
      ? t("profileBuilder.statusBar.activar")
      : t("profileBuilder.statusBar.renovar");

  return (
    <article className="relative min-h-dvh pb-24">
      {/* Barra de estado (publicación + guardado + acción). Abajo para no quedar
          bajo el botón de menú/perfil; oculta mientras se ajusta la foto. */}
      {!adjusting && (
        <div className="bg-ink/90 fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            {adminMode ? (
              <Link
                href="/admin/perfiles"
                className="text-silver-200 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[2px] uppercase transition hover:bg-white/20 hover:text-white"
              >
                <ArrowLeftIcon className="size-3.5" />
                {t("profileBuilder.statusBar.backToAdmin")}
              </Link>
            ) : (
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-[2px] uppercase ${pubChip.cls}`}
                title={
                  estadoPremium === "activo"
                    ? t("profileBuilder.statusBar.titleActive")
                    : t("profileBuilder.statusBar.titleInactive")
                }
              >
                {pubChip.label}
              </span>
            )}
            <SaveIndicator state={saveState} />
          </div>
          <div className="flex items-center gap-2">
            {!adminMode && mostrarRenovar && (
              <button
                type="button"
                onClick={renovar}
                className="from-silver-100 to-amethyst-300 text-ink inline-flex min-h-9 items-center gap-1.5 rounded-full bg-gradient-to-r px-4 py-1.5 text-sm font-semibold tracking-[1px] uppercase transition hover:shadow-[0_0_18px_rgba(139,92,246,0.5)]"
              >
                <RepeatIcon className="size-4" />
                {renovarLabel}
              </button>
            )}
            {adminMode || estadoPremium === "activo" ? (
              <GlassButton href={`/artistas/${slug}`}>
                <EyeIcon className="size-4" />
                {t("profileBuilder.statusBar.viewProfile")}
              </GlassButton>
            ) : (
              <GlassButton onClick={() => setShowPublishGate(true)}>
                <EyeIcon className="size-4" />
                {t("profileBuilder.statusBar.viewProfile")}
              </GlassButton>
            )}
          </div>
        </div>
      )}

      {/* Hero: foto + identidad editables. Misma altura que el perfil público
          (h-dvh) para que el encuadre de la foto y la posición del reproductor
          coincidan exactamente (WYSIWYG). */}
      <section
        ref={heroRef}
        className="relative flex h-dvh w-full items-end overflow-hidden bg-neutral-950"
      >
        {photoURL ? (
          <Image
            src={photoURL}
            alt={t("profileBuilder.photo.alt")}
            fill
            sizes="100vw"
            className="object-cover"
            style={{
              transform: photoTransformCss(pt),
              transformOrigin: "center",
            }}
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />

        {/* Slot de foto vacío */}
        {!photoURL && (
          <div className="absolute inset-0 z-10 grid place-items-center">
            <UploadButton
              accept="image/*"
              onFiles={onPhotoUpload}
              disabled={uploading === "photo"}
              className="hover:border-amethyst-300 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/30 px-10 py-8 text-white/70 transition hover:text-white"
            >
              {uploading === "photo" ? (
                <SpinnerIcon className="size-7 animate-spin" />
              ) : (
                <PlusIcon className="size-7" />
              )}
              <span className="text-sm">
                {t("profileBuilder.photo.upload")}
              </span>
            </UploadButton>
          </div>
        )}

        {/* Foto puesta: un solo botón para cambiar (screen-aware) + ajustar +
            gestionar la versión de la otra pantalla (mismos GlassButton que
            Atrás/Ajustes). */}
        {photoURL && !adjusting && (
          <div className="absolute top-20 right-4 z-20 flex max-w-[min(80vw,22rem)] flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <UploadButton
                glass
                accept="image/*"
                onFiles={onPhotoUpload}
                disabled={uploading === "photo"}
              >
                {uploading === "photo" ? (
                  <SpinnerIcon className="size-4 animate-spin" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
                {t("profileBuilder.photo.change")}
              </UploadButton>
              <GlassButton onClick={() => setAdjusting(true)}>
                <CropIcon className="size-4" />
                {t("profileBuilder.photo.adjust")}
              </GlassButton>
              <GlassButton onClick={openOtherScreen}>
                <ImageIcon className="size-4" />
                {isMobileScreen
                  ? t("profileBuilder.photoSync.manageDesktop")
                  : t("profileBuilder.photoSync.manageMobile")}
              </GlassButton>
            </div>
            <p className="max-w-xs rounded-lg bg-black/45 px-2.5 py-1 text-right text-[11px] leading-snug text-white/75 backdrop-blur">
              {t("profileBuilder.photoSync.hint")}
            </p>
          </div>
        )}

        {/* Modo ajuste: arrastrar para mover + zoom/rotación */}
        {photoURL && adjusting && (
          <>
            <div
              className="absolute inset-0 z-20 cursor-move touch-none"
              onPointerDown={startDrag}
              onPointerMove={onDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
            {/* Barra flotante de cristal (no a todo el ancho): zoom y giro por
                pasos (−/+ con press-and-hold) + acciones rápidas. */}
            <div className="absolute bottom-6 left-1/2 z-30 w-[min(92vw,560px)] -translate-x-1/2">
              <div className={`${glassSurfaceSoft} rounded-3xl px-4 py-3`}>
                <GlassSheen />
                <div className="relative flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
                  {/* Zoom */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-[2px] text-white/55 uppercase">
                      {t("profileBuilder.photoAdjust.zoom")}
                    </span>
                    <StepButton
                      ariaLabel={t("profileBuilder.photoAdjust.zoomOut")}
                      onStep={() =>
                        setPt((p) => ({
                          ...p,
                          scale: clamp(p.scale - 0.1, 1, 3),
                        }))
                      }
                    >
                      <MinusIcon className="size-4" />
                    </StepButton>
                    <span className="w-11 text-center text-sm text-white tabular-nums">
                      {pt.scale.toFixed(1)}×
                    </span>
                    <StepButton
                      ariaLabel={t("profileBuilder.photoAdjust.zoomIn")}
                      onStep={() =>
                        setPt((p) => ({
                          ...p,
                          scale: clamp(p.scale + 0.1, 1, 3),
                        }))
                      }
                    >
                      <PlusIcon className="size-4" />
                    </StepButton>
                  </div>

                  {/* Girar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-[2px] text-white/55 uppercase">
                      {t("profileBuilder.photoAdjust.rotate")}
                    </span>
                    <StepButton
                      ariaLabel={t("profileBuilder.photoAdjust.rotateLeft")}
                      onStep={() =>
                        setPt((p) => ({
                          ...p,
                          rotation: clamp(p.rotation - 2, -180, 180),
                        }))
                      }
                    >
                      <RotateCcwIcon className="size-4" />
                    </StepButton>
                    <span className="w-11 text-center text-sm text-white tabular-nums">
                      {Math.round(pt.rotation)}°
                    </span>
                    <StepButton
                      ariaLabel={t("profileBuilder.photoAdjust.rotateRight")}
                      onStep={() =>
                        setPt((p) => ({
                          ...p,
                          rotation: clamp(p.rotation + 2, -180, 180),
                        }))
                      }
                    >
                      <RotateCwIcon className="size-4" />
                    </StepButton>
                  </div>
                </div>

                <div className="relative mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 pt-3">
                  <GlassButton
                    onClick={() =>
                      setPt((p) => ({
                        ...p,
                        rotation: (p.rotation + 90) % 360,
                      }))
                    }
                  >
                    <RotateCwIcon className="size-4" />
                    {t("profileBuilder.photoAdjust.rotate90")}
                  </GlassButton>
                  <GlassButton onClick={() => setPt(DEFAULT_PHOTO_TRANSFORM)}>
                    <CrosshairIcon className="size-4" />
                    {t("profileBuilder.photoAdjust.reset")}
                  </GlassButton>
                  <GlassButton
                    onClick={() => setAdjusting(false)}
                    className="!text-amethyst-200"
                  >
                    <CheckIcon className="size-4" />
                    {t("profileBuilder.photoAdjust.done")}
                  </GlassButton>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] tracking-[2px] text-white/45 uppercase">
                {t("profileBuilder.photoAdjust.hint")}
              </p>
            </div>
          </>
        )}

        <div className="relative z-10 w-full p-6 sm:p-12">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              title={t("profileBuilder.identity.accentColorTitle")}
              className="size-7 cursor-pointer rounded-full border border-white/20 bg-transparent"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm font-bold tracking-[3px] uppercase">
            {genres.map((g) => (
              <span
                key={g}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/30 px-3 py-1 backdrop-blur"
                style={{ color: accent }}
              >
                {g}
                <button
                  type="button"
                  onClick={() => setGenres(genres.filter((x) => x !== g))}
                  aria-label={t("profileBuilder.identity.genreRemove", {
                    value: g,
                  })}
                  className="text-white/50 transition hover:text-white"
                >
                  ×
                </button>
              </span>
            ))}
            <SearchableSelect
              value=""
              onChange={(v) => {
                const g = v.trim();
                if (g && !genres.includes(g)) setGenres([...genres, g]);
              }}
              options={GENRE_OPTIONS}
              allowCustom
              placement="top"
              placeholder={t("profileBuilder.identity.genreAdd")}
              searchPlaceholder={t("profileBuilder.identity.genreSearch")}
              emptyText={t("profileBuilder.identity.genreEmpty")}
              customLabel={(v) =>
                t("profileBuilder.identity.genreCustom", { value: v })
              }
              ariaLabel={t("profileBuilder.identity.genreAdd")}
              className={`${glassField} flex items-center justify-between gap-2`}
              style={{ color: accent }}
            />
            <button
              type="button"
              onClick={() => setLocOpen(true)}
              aria-label={t("profileBuilder.identity.cityPlaceholder")}
              className={`${glassField} flex w-44 items-center justify-between gap-2`}
              style={{ color: accent }}
            >
              <span className="truncate">
                {formatLocation(location) ||
                  city ||
                  t("profileBuilder.identity.cityPlaceholder")}
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-4 shrink-0 opacity-60"
                aria-hidden="true"
              >
                <path
                  d="m6 9 6 6 6-6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <input
              type="number"
              value={startYear}
              min={1950}
              max={CURRENT_YEAR}
              onChange={(e) => setStartYear(Number(e.target.value))}
              title={t("profileBuilder.identity.startYearTitle")}
              className={`${glassField} w-28`}
              style={{ color: accent }}
            />
          </div>

          {/* Nombre: con etiqueta + lápiz + subrayado punteado para que se note
              que es editable (antes, si no tocabas las letras, no se veía). */}
          <div className="mt-3">
            <span className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-[2px] text-white/55 uppercase">
              <EditIcon className="size-3" />
              {t("profileBuilder.identity.artisticNameLabel")}
            </span>
            <input
              value={artisticName}
              onChange={(e) => setArtisticName(e.target.value)}
              placeholder={t("profileBuilder.identity.artisticNamePlaceholder")}
              className={`${titleInput} focus:border-amethyst-300 border-b-2 border-dashed border-white/25 pb-1`}
            />
          </div>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder={t("profileBuilder.identity.taglinePlaceholder")}
            className="focus:border-amethyst-300/70 mt-3 w-full max-w-xl border-b border-dashed border-white/20 bg-transparent pb-1 text-lg text-white/80 transition outline-none placeholder:text-white/40"
          />
        </div>

        {/* Reproductor sobre la foto. La CAJA posicionada es solo el reproductor
            pelado (idéntico al que se ve publicado), por eso la posición cuadra
            exacta. Los controles FLOTAN (absolute) y no desplazan esa caja.
            Oculto solo mientras se ajusta la foto. */}
        {songURL && playerOverlay && !adjusting && (
          <div
            ref={playerBoxRef}
            className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-2xl ring-1 ring-white/20 ${PLAYER_SIZE_W[playerSize]}`}
            style={{ left: `${playerX}%`, top: `${playerY}%` }}
          >
            {/* Asa flotante: arrastra para mover (no afecta la caja). */}
            <div
              onPointerDown={startPlayerDrag}
              onPointerMove={onPlayerDrag}
              onPointerUp={endPlayerDrag}
              onPointerCancel={endPlayerDrag}
              aria-label={t("profileBuilder.player.dragHandleAriaLabel")}
              className="absolute -top-9 left-1/2 flex -translate-x-1/2 cursor-move touch-none items-center justify-center rounded-full bg-black/55 px-4 py-1.5 text-white/80 backdrop-blur transition active:cursor-grabbing"
            >
              <MoveIcon className="size-4" />
            </div>

            {/* Reproductor pelado = caja posicionada (igual que en público). */}
            <ProfileAudioPlayer
              variant="overlay"
              src={songURL}
              accent={accent}
              title={artisticName}
              dockBottomClass="bottom-20"
            />

            {/* Toolbar flotante: ocultar (enviar abajo) + tamaño. */}
            <div className="absolute -bottom-11 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 px-2 py-1 backdrop-blur">
              <button
                type="button"
                onClick={() => setPlayerOverlay(false)}
                aria-label={t("profileBuilder.player.hideAriaLabel")}
                className="flex size-7 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <EyeOffIcon className="size-4" />
              </button>
              <span className="mx-0.5 h-4 w-px bg-white/20" />
              {(["sm", "md", "lg"] as PlayerSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPlayerSize(s)}
                  aria-pressed={playerSize === s}
                  className={`size-7 rounded-md text-xs font-semibold transition ${
                    playerSize === s
                      ? "bg-white/25 text-white"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {SIZE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {error && (
        <p className="mx-auto mt-4 max-w-3xl rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* Canción de fondo */}
      <section className="mx-auto max-w-3xl px-6 pt-8">
        {songURL ? (
          <div>
            {/* En modo "sobre la foto" el reproductor se ve arriba (preview en el
                hero); aquí solo mostramos la tarjeta cuando va debajo. */}
            {/* Debajo: tarjeta + botón (ojo) para volver a ponerlo sobre la foto.
                Sobre la foto: todos los controles flotan en el modal del hero. */}
            {!playerOverlay && (
              <>
                <ProfileAudioPlayer
                  src={songURL}
                  accent={accent}
                  dockBottomClass="bottom-20"
                />
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setPlayerOverlay(true)}
                    className="text-silver-300 hover:border-amethyst-300/60 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-sm transition hover:text-white"
                  >
                    <EyeIcon className="size-4" />
                    {t("profileBuilder.player.showOnPhoto")}
                  </button>
                </div>
              </>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <UploadButton
                glass
                accept="audio/*"
                onFiles={pickSong}
                disabled={uploading === "song"}
              >
                {uploading === "song" ? (
                  <SpinnerIcon className="size-4 animate-spin" />
                ) : (
                  <MusicIcon className="size-4" />
                )}
                {uploading === "song"
                  ? t("profileBuilder.song.changing")
                  : t("profileBuilder.song.change")}
              </UploadButton>
              {playerOverlay && (
                <GlassButton onClick={recenterPlayer}>
                  <CrosshairIcon className="size-4" />
                  {t("profileBuilder.player.recenter")}
                </GlassButton>
              )}
              <GlassButton onClick={() => setConfirmRemoveSong(true)}>
                <TrashIcon className="size-4 text-red-300" />
                {t("profileBuilder.song.remove")}
              </GlassButton>
            </div>
          </div>
        ) : (
          <UploadButton
            accept="audio/*"
            onFiles={pickSong}
            disabled={uploading === "song"}
            className={`${glassSurfaceSoft} group flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-7 text-white/80 transition hover:text-white`}
          >
            <GlassSheen />
            <span className="relative inline-flex items-center gap-3">
              {uploading === "song" ? (
                <SpinnerIcon className="size-5 animate-spin" />
              ) : (
                <MusicIcon className="size-5" />
              )}
              <span className="text-sm">{t("profileBuilder.song.add")}</span>
            </span>
          </UploadButton>
        )}
      </section>

      {/* Bio */}
      <Block title={t("profileBuilder.bio.sectionTitle")}>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t("profileBuilder.bio.placeholder")}
          className="text-silver-100 min-h-32 w-full resize-y rounded-lg bg-white/5 px-4 py-3 text-lg leading-relaxed transition outline-none placeholder:text-white/30 focus:bg-white/10"
        />
      </Block>

      {/* Redes */}
      <Block title={t("profileBuilder.socials.sectionTitle")}>
        <SocialPalette value={socials} onChange={setSocials} />
      </Block>

      {/* Galería bento ordenable (dnd-kit): arrastra una foto y las demás se
          acomodan solas; pulsa ⤢ para cambiar su tamaño. */}
      <Block
        title={t("profileBuilder.gallery.sectionTitle", {
          count: gallery.length,
          limit: GALLERY_LIMIT,
        })}
      >
        {gallery.length > 1 && (
          <p className="text-silver-400 mb-3 text-xs">
            {t("profileBuilder.gallery.hint")}
          </p>
        )}
        <GalleryBento
          items={gallery}
          onReorder={setGallery}
          onResize={cycleGallerySpan}
          onRemove={(url) =>
            setGallery((g) => g.filter((it) => it.url !== url))
          }
          addSlot={
            gallery.length < GALLERY_LIMIT ? (
              <UploadButton
                accept="image/*"
                multiple
                onFiles={onGallery}
                disabled={uploading === "gallery"}
                className="hover:border-amethyst-300 flex min-h-[110px] items-center justify-center rounded-xl border border-dashed border-white/20 text-white/60 transition hover:text-white"
              >
                {uploading === "gallery" ? (
                  <SpinnerIcon className="size-6 animate-spin" />
                ) : (
                  <PlusIcon className="size-6" />
                )}
              </UploadButton>
            ) : null
          }
        />
      </Block>

      {/* Temas */}
      <Block title={t("profileBuilder.tracks.sectionTitle")}>
        <div className="flex flex-col gap-3">
          {tracks.map((track, i) => (
            <div
              key={track._id}
              className={`${glassSurfaceSoft} rounded-xl p-3`}
            >
              <GlassSheen />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <input
                    value={track.title}
                    onChange={(e) => setTrack(i, { title: e.target.value })}
                    placeholder={t("profileBuilder.tracks.titlePlaceholder", {
                      n: i + 1,
                    })}
                    className={`${ghostInput} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setTracks((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    aria-label={t("profileBuilder.tracks.removeAriaLabel")}
                    className="text-silver-400 flex size-9 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 hover:text-white"
                  >
                    <CloseIcon className="size-4" />
                  </button>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    value={track.youtubeUrl ?? ""}
                    onChange={(e) =>
                      setTrack(i, { youtubeUrl: e.target.value })
                    }
                    placeholder={t("profileBuilder.tracks.youtubePlaceholder")}
                    className={ghostInput}
                  />
                  <input
                    value={track.spotifyUrl ?? ""}
                    onChange={(e) =>
                      setTrack(i, { spotifyUrl: e.target.value })
                    }
                    placeholder={t("profileBuilder.tracks.spotifyPlaceholder")}
                    className={ghostInput}
                  />
                </div>
              </div>
            </div>
          ))}
          <GlassButton
            onClick={() => setTracks((prev) => [...prev, newTrack()])}
          >
            <PlusIcon className="size-4" />{" "}
            {t("profileBuilder.tracks.addButton")}
          </GlassButton>
        </div>
      </Block>

      {showPagoPicker && (
        <PaymentMethodPicker
          onPick={iniciarPago}
          onClose={() => setShowPagoPicker(false)}
          insignia={insigniaDePuntos(puntos)}
        />
      )}

      {trimFile && (
        <AudioTrimModal
          file={trimFile}
          accent={accent}
          onCancel={() => setTrimFile(null)}
          onConfirm={onTrimConfirm}
        />
      )}

      <GlassModal
        open={showPublishGate}
        onClose={() => setShowPublishGate(false)}
        title={t("profileBuilder.publishGate.title")}
      >
        <p className="text-silver-300 text-sm">
          {t("profileBuilder.publishGate.message")}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <GlassButton href={`/artistas/${slug}`}>
            <EyeIcon className="size-4" />
            {t("profileBuilder.publishGate.preview")}
          </GlassButton>
          <GlassButton
            onClick={() => {
              setShowPublishGate(false);
              renovar();
            }}
            className="!text-amethyst-200"
          >
            <RepeatIcon className="size-4" />
            {t("profileBuilder.publishGate.pay")}
          </GlassButton>
        </div>
      </GlassModal>

      <GlassModal
        open={confirmRemoveSong}
        onClose={() => setConfirmRemoveSong(false)}
        title={t("profileBuilder.song.removeConfirm.title")}
      >
        <p className="text-silver-300 text-sm">
          {t("profileBuilder.song.removeConfirm.message")}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <GlassButton onClick={() => setConfirmRemoveSong(false)}>
            {t("profileBuilder.song.removeConfirm.cancel")}
          </GlassButton>
          <GlassButton
            onClick={() => {
              setSongURL("");
              setConfirmRemoveSong(false);
            }}
            className="!text-red-200"
          >
            <TrashIcon className="size-4" />
            {t("profileBuilder.song.removeConfirm.confirm")}
          </GlassButton>
        </div>
      </GlassModal>

      {/* Editor de ubicación (país → departamento/estado → ciudad) */}
      <GlassModal
        open={locOpen}
        onClose={() => setLocOpen(false)}
        title={t("profileBuilder.location.title")}
      >
        <LocationPicker
          value={location}
          onChange={(loc) => {
            setLocation(loc);
            setCity(loc?.city ?? "");
          }}
          className="grid gap-3"
        />
        <div className="mt-6 flex justify-end">
          <GlassButton
            onClick={() => setLocOpen(false)}
            className="!text-amethyst-200"
          >
            {t("profileBuilder.location.done")}
          </GlassButton>
        </div>
      </GlassModal>

      {/* Sincronización de foto: tras subir para una pantalla, ofrece reusar
          la misma imagen en la otra o subir una versión dedicada (vertical
          para móvil, horizontal para escritorio). */}
      <GlassModal
        open={syncPrompt !== null}
        onClose={() => setSyncPrompt(null)}
        title={
          syncPrompt?.target === "mobile"
            ? t("profileBuilder.photoSync.titleMobile")
            : t("profileBuilder.photoSync.titleDesktop")
        }
      >
        {syncPrompt && (
          <>
            <div className="flex justify-center">
              {syncPrompt.target === "mobile" ? (
                <div className="relative aspect-[3/4] w-56 overflow-hidden rounded-xl">
                  <Image
                    src={syncPrompt.url}
                    alt={t("profileBuilder.photo.alt")}
                    fill
                    sizes="14rem"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl">
                  <Image
                    src={syncPrompt.url}
                    alt={t("profileBuilder.photo.alt")}
                    fill
                    sizes="(min-width: 640px) 28rem, 90vw"
                    className="object-cover"
                  />
                </div>
              )}
            </div>
            <p className="text-silver-300 mt-4 text-sm">
              {syncPrompt.target === "mobile"
                ? t("profileBuilder.photoSync.bodyMobile")
                : t("profileBuilder.photoSync.bodyDesktop")}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <GlassButton
                onClick={reuseForOther}
                className="!text-amethyst-200"
              >
                <CheckIcon className="size-4" />
                {t("profileBuilder.photoSync.useSame")}
              </GlassButton>
              <UploadButton
                glass
                accept="image/*"
                onFiles={onPhotoOther}
                disabled={uploading === "photoOther"}
              >
                {uploading === "photoOther" ? (
                  <SpinnerIcon className="size-4 animate-spin" />
                ) : (
                  <ImageIcon className="size-4" />
                )}
                {syncPrompt.target === "mobile"
                  ? t("profileBuilder.photoSync.uploadVertical")
                  : t("profileBuilder.photoSync.uploadHorizontal")}
              </UploadButton>
            </div>
          </>
        )}
      </GlassModal>
    </article>
  );
}

/** Etiquetas cortas de los tamaños del reproductor (S/M/L). */
const SIZE_LABEL: Record<PlayerSize, string> = {
  sm: "S",
  md: "M",
  lg: "L",
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/**
 * Botón de paso (−/+) con press-and-hold: un toque = un paso; mantener pulsado
 * repite (tras un pequeño retraso) para mover rápido sin perder el ajuste fino.
 * `onStep` usa actualización funcional, así que la repetición siempre parte del
 * último valor aunque el componente se re-renderice durante el hold.
 */
function StepButton({
  onStep,
  ariaLabel,
  children,
}: {
  onStep: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const timers = useRef<{
    delay?: ReturnType<typeof setTimeout>;
    rep?: ReturnType<typeof setInterval>;
  }>({});

  const stop = () => {
    if (timers.current.delay) clearTimeout(timers.current.delay);
    if (timers.current.rep) clearInterval(timers.current.rep);
    timers.current = {};
  };
  const start = () => {
    onStep();
    timers.current.delay = setTimeout(() => {
      timers.current.rep = setInterval(onStep, 60);
    }, 300);
  };

  useEffect(() => stop, []);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className="flex size-9 touch-none items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/25 transition ring-inset hover:bg-white/20 active:scale-90"
    >
      {children}
    </button>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations();
  if (state === "saving")
    return (
      <span className="text-silver-300 inline-flex items-center gap-1.5 text-xs">
        <SpinnerIcon className="size-4 animate-spin" />{" "}
        {t("profileBuilder.save.saving")}
      </span>
    );
  if (state === "saved")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
        <CheckIcon className="size-4" /> {t("profileBuilder.save.saved")}
      </span>
    );
  if (state === "error")
    return (
      <span className="text-xs text-red-300">
        {t("profileBuilder.save.error")}
      </span>
    );
  return null;
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto mt-8 max-w-3xl px-6">
      <h2 className="font-narrow mb-3 text-2xl font-bold text-white uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
