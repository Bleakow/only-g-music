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
import type { SocialPlatform } from "@only-g/shared-types/artist";
import {
  type EditableProfile,
  type ProfileTrack,
  type PhotoTransform,
  type PlayerSize,
  type GalleryItem,
  type FeaturedMedia,
  type Premium,
  FEATURED_VIDEO_MAX_SECONDS,
  featuredMediaItems,
  featuredMediaPolicy,
  DEFAULT_PHOTO_TRANSFORM,
  DEFAULT_PLAYER_X,
  DEFAULT_PLAYER_Y,
  DEFAULT_PLAYER_SIZE,
  GALLERY_LIMIT,
  nextGallerySpan,
  insigniaDePuntos,
  photoTransformCss,
  premiumEstado,
} from "@only-g/shared-types/artist-profile";
import type { Role } from "@only-g/shared-types/user";
import {
  isSectionOn,
  type SectionId,
  type SectionPrefs,
} from "@only-g/shared-types/profile-sections";
import type {
  FichaTecnica,
  Reconocimiento,
  TrayectoriaItem,
} from "@only-g/shared-types/profile-role-data";
import { createPaymentConversation } from "@/features/conversations/lib/conversations-repo";
import {
  openChat,
  openConversation,
} from "@/features/conversations/lib/open-conversation";
import { usePrecios } from "@/features/pricing/components/PreciosProvider";
import { PaymentMethodPicker } from "@/features/conversations/components/PaymentMethodPicker";
import type { MetodoPago } from "@only-g/shared-types/payment-method";
import {
  createProfile,
  getProfileBySlug,
  updateProfile,
} from "../../lib/artist-profile-repo";
import { SocialPalette } from "./SocialPalette";
import { ProfileAudioPlayer, PLAYER_SIZE_W } from "./ProfileAudioPlayer";
import { AudioTrimModal } from "./AudioTrimModal";
import { GalleryBento } from "./GalleryBento";
import { BioAiModal } from "./BioAiModal";
import { RelatedArtistsPicker } from "./RelatedArtistsPicker";
import { ProfileChip, ProfileChipField } from "./ProfileChip";
import { AccentColorPicker } from "./AccentColorPicker";
import { SectionManager } from "./SectionManager";
import {
  ChipListEditor,
  FichaTecnicaEditor,
  HitosEditor,
  LIMITES,
  MarcasEditor,
  CATEGORIAS_MODELO,
  GENEROS_BAILE,
  categoriaColor,
} from "./RoleSectionsEditor";
import { FeaturedMediaEditor } from "./FeaturedMediaEditor";
import { PhotoScreenPreview, type ScreenTarget } from "./PhotoScreenPreview";
import { StepButton, clampNum as clamp } from "./StepButton";
import { UploadButton } from "./UploadButton";
import { glassSurfaceSoft, GlassSheen } from "@/components/ui/glass";
import { Button } from "@/components/ui/Button";
import { GlassButton } from "@/components/ui/GlassButton";
import { GlassModal } from "@/components/ui/GlassModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { LocationPicker } from "@/features/location/components/LocationPicker";
import {
  formatLocation,
  type GeoLocation,
} from "@only-g/shared-types/location";
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
  SparklesIcon,
  ClockIcon,
  MonitorIcon,
  SmartphoneIcon,
  YouTubeIcon,
  SpotifyIcon,
} from "@/components/icons";

const CURRENT_YEAR = new Date().getFullYear();
const MAX_MB = 25;
/**
 * Tope del clip destacado. Coincide con el límite de las reglas de Storage
 * (`uploads/{uid}`: 25 MB); un clip corto (≤8s) cabe de sobra. Subir de más lo
 * rechazaría Storage, no solo el cliente.
 */
const FEATURED_VIDEO_MAX_MB = 25;
const GENRE_OPTIONS = MUSIC_GENRES.map((g) => ({ value: g, label: g }));

/** Lee la duración (s) de un archivo de video por sus metadatos, sin subirlo. */
function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("metadata"));
    };
    v.src = url;
  });
}

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
  // Colaboradores / artistas relacionados que el artista destaca (slugs).
  const [relatedArtists, setRelatedArtists] = useState<string[]>([]);
  // Modal "Mejorar biografía con IA".
  const [showBioAi, setShowBioAi] = useState(false);
  const [accent, setAccent] = useState("#8b5cf6");
  const [startYear, setStartYear] = useState(CURRENT_YEAR);
  const [photoURL, setPhotoURL] = useState("");
  // Foto vertical opcional para móvil (art direction). La principal es para PC.
  const [photoMobile, setPhotoMobile] = useState("");
  // Media destacada (pantalla 2, junto a la bio): clip corto o foto.
  const [featuredList, setFeaturedList] = useState<FeaturedMedia[]>([]);
  // Clip que se está viendo en el hueco del player del editor.
  const [featuredActive, setFeaturedActive] = useState(0);
  // Qué secciones ha encendido/apagado el artista (§05).
  const [sectionPrefs, setSectionPrefs] = useState<SectionPrefs>({});
  // §05 — datos de las secciones que desbloquean las etiquetas de talento.
  const [fichaTecnica, setFichaTecnica] = useState<FichaTecnica>({});
  const [categorias, setCategorias] = useState<string[]>([]);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [generosBaile, setGenerosBaile] = useState<string[]>([]);
  const [trayectoria, setTrayectoria] = useState<TrayectoriaItem[]>([]);
  const [reconocimientos, setReconocimientos] = useState<Reconocimiento[]>([]);
  // Disciplinas (solo lectura) para calcular la política de media destacada.
  const [disciplines, setDisciplines] = useState<Role[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [songURL, setSongURL] = useState("");
  // Archivo elegido pendiente de recortar (abre el AudioTrimModal). Lo que se
  // sube es el FRAGMENTO, no este archivo.
  const [trimFile, setTrimFile] = useState<File | null>(null);
  // Video de media destacada pendiente de recortar (abre el VideoTrimModal). Guarda
  // si el clip pendiente lleva audio → define el modo del recortador.
  const [videoTrim, setVideoTrim] = useState<{
    file: File;
    withAudio: boolean;
  } | null>(null);
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
  const [manualFollowers, setManualFollowers] = useState<
    Partial<Record<SocialPlatform, number>>
  >({});
  const [primarySocial, setPrimarySocial] = useState<SocialPlatform | null>(
    null,
  );

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploading, setUploading] = useState<string | null>(null);
  const [premiumData, setPremiumData] = useState<Premium | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Encuadre POR PANTALLA: el marco pasa de 16:9 a 9:19.5, así que el encuadre
  // que funciona en escritorio casi nunca funciona en móvil.
  const [pt, setPt] = useState<PhotoTransform>(DEFAULT_PHOTO_TRANSFORM);
  const [ptMobile, setPtMobile] = useState<PhotoTransform>(
    DEFAULT_PHOTO_TRANSFORM,
  );
  const [adjusting, setAdjusting] = useState(false);
  // Detecta la pantalla actual (mismo corte que el perfil público: 640px/sm)
  // para saber a qué slot va la primera foto subida.
  const isMobileScreen = useMediaQuery("(max-width: 639.98px)");
  // Vista previa de la foto en la OTRA pantalla: solo la foto dentro del marco
  // de esa resolución. `justUploaded` cambia el copy a "acabas de cambiarla".
  const [screenPreview, setScreenPreview] = useState<{
    target: ScreenTarget;
    justUploaded: boolean;
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

  // Editor inmersivo: frena el rebote de scroll (overscroll) del navegador móvil,
  // que al llegar al fondo "regresaba" un poco hacia arriba. Scoped: se restaura
  // al salir del editor para no afectar el pull-to-refresh del resto de la web.
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.overscrollBehaviorY;
    el.style.overscrollBehaviorY = "contain";
    return () => {
      el.style.overscrollBehaviorY = prev;
    };
  }, []);

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
          setRelatedArtists(p.relatedArtists ?? []);
          setAccent(p.accent);
          setStartYear(p.trajectoryStartYear || CURRENT_YEAR);
          setPhotoURL(p.photoURL);
          setPhotoMobile(p.photoURLMobile ?? "");
          setFeaturedList(
            featuredMediaItems(p.featuredMediaList, p.featuredMedia),
          );
          setDisciplines(p.disciplines ?? []);
          setSectionPrefs(p.sectionPrefs ?? {});
          setFichaTecnica(p.fichaTecnica ?? {});
          setCategorias(p.categorias ?? []);
          setMarcas(p.marcas ?? []);
          setGenerosBaile(p.generosBaile ?? []);
          setTrayectoria(p.trayectoria ?? []);
          setReconocimientos(p.reconocimientos ?? []);
          setPt(p.photoTransform ?? DEFAULT_PHOTO_TRANSFORM);
          setPtMobile(p.photoTransformMobile ?? DEFAULT_PHOTO_TRANSFORM);
          setGallery(p.gallery);
          setSongURL(p.entryTrackUrl ?? "");
          setPlayerOverlay(p.playerOverlay ?? true);
          setPlayerX(p.playerX ?? DEFAULT_PLAYER_X);
          setPlayerY(p.playerY ?? DEFAULT_PLAYER_Y);
          setPlayerSize(p.playerSize ?? DEFAULT_PLAYER_SIZE);
          setTracks(p.tracks.map((t) => ({ ...t, _id: `t${trackSeq++}` })));
          setSocials(p.socials);
          setManualFollowers(p.manualFollowers ?? {});
          setPrimarySocial(p.primarySocial ?? null);
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
    // Seguidores manuales: solo de redes que quedaron con link y con nº positivo.
    const cleanFollowers: Partial<Record<SocialPlatform, number>> = {};
    for (const [k, n] of Object.entries(manualFollowers)) {
      const key = k as SocialPlatform;
      if (cleanSocials[key] && typeof n === "number" && n > 0) {
        cleanFollowers[key] = Math.round(n);
      }
    }
    return {
      artisticName: artisticName.trim(),
      tagline: tagline.trim(),
      genre: genres[0] ?? "",
      genres,
      city: city.trim() || undefined,
      location: location ?? undefined,
      bio: bio.trim(),
      relatedArtists,
      accent,
      photoURL,
      photoURLMobile: photoMobile || undefined,
      photoTransform: pt,
      photoTransformMobile: ptMobile,
      sectionPrefs,
      // §05 — se guardan SIEMPRE, aunque la sección esté apagada: apagar una
      // sección la oculta, no borra lo que el artista escribió. Al volver a
      // encenderla, sus datos siguen ahí.
      fichaTecnica,
      categorias,
      marcas,
      generosBaile,
      trayectoria,
      reconocimientos,
      featuredMedia: undefined,
      featuredMediaList: featuredList,
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
      manualFollowers: cleanFollowers,
      // Solo si la red principal sigue teniendo link.
      primarySocial:
        primarySocial && cleanSocials[primarySocial]
          ? primarySocial
          : undefined,
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
    relatedArtists,
    accent,
    startYear,
    photoURL,
    photoMobile,
    pt,
    ptMobile,
    sectionPrefs,
    fichaTecnica,
    categorias,
    marcas,
    generosBaile,
    trayectoria,
    reconocimientos,
    gallery,
    featuredList,
    songURL,
    playerOverlay,
    playerX,
    playerY,
    playerSize,
    tracks,
    socials,
    manualFollowers,
    primarySocial,
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

  // Pantalla que se está editando ahora mismo (el hero es WYSIWYG de ESTA).
  const currentScreen: ScreenTarget = isMobileScreen ? "mobile" : "desktop";
  const otherScreen: ScreenTarget = isMobileScreen ? "desktop" : "mobile";
  /** Foto que se ve en una pantalla. Móvil cae a la principal si no tiene propia. */
  const photoFor = (s: ScreenTarget) =>
    s === "mobile" ? photoMobile || photoURL : photoURL;
  const transformFor = (s: ScreenTarget) => (s === "mobile" ? ptMobile : pt);
  const setTransformFor = (s: ScreenTarget, next: PhotoTransform) =>
    s === "mobile" ? setPtMobile(next) : setPt(next);
  /** Actualiza (funcionalmente) el encuadre de la pantalla que se está editando. */
  const patchTransform = (fn: (p: PhotoTransform) => PhotoTransform) =>
    currentScreen === "mobile" ? setPtMobile(fn) : setPt(fn);

  // Subida principal, consciente de la pantalla. La foto va al slot de la
  // pantalla actual y acto seguido se abre la vista previa de la OTRA: ahí se
  // ajusta el encuadre para esa resolución o se sube una imagen distinta.
  async function onPhotoUpload(files: File[]) {
    setUploading("photo");
    setError(null);
    try {
      const [url] = await uploadFiles(files.slice(0, 1));
      if (!url) return;
      if (isMobileScreen) {
        setPhotoMobile(url);
        if (!photoURL) setPhotoURL(url); // la principal (escritorio) es obligatoria
      } else {
        setPhotoURL(url);
      }
      setScreenPreview({ target: otherScreen, justUploaded: true });
    } finally {
      setUploading(null);
    }
  }

  // Subir una foto DISTINTA dedicada a la pantalla que se está previsualizando.
  // El preview sigue abierto para poder encuadrarla ahí mismo.
  async function onPhotoOther(files: File[]) {
    const target = screenPreview?.target;
    if (!target) return;
    setUploading("photoOther");
    setError(null);
    try {
      const [url] = await uploadFiles(files.slice(0, 1));
      if (!url) return;
      if (target === "desktop") setPhotoURL(url);
      else setPhotoMobile(url);
      setTransformFor(target, DEFAULT_PHOTO_TRANSFORM); // encuadre limpio
      setScreenPreview({ target, justUploaded: false });
    } finally {
      setUploading(null);
    }
  }

  // Política de media destacada según disciplina (cuántos mudos / con audio).
  const mediaPolicy = featuredMediaPolicy(disciplines);

  // ¿Se le piden los datos de esta sección? Solo si su etiqueta la desbloquea Y
  // la tiene encendida en el gestor — el editor no pregunta por lo que no se va
  // a publicar.
  const seccionActiva = (id: SectionId) =>
    isSectionOn(id, sectionPrefs, disciplines);

  function addFeatured(item: FeaturedMedia) {
    // El clip recién añadido pasa al player: se ve lo que se acaba de subir.
    setFeaturedActive(featuredList.length);
    setFeaturedList((prev) => [...prev, item]);
  }
  function removeFeatured(i: number) {
    setFeaturedList((prev) => prev.filter((_, idx) => idx !== i));
    setFeaturedActive((a) => (a > i ? a - 1 : a === i ? 0 : a));
  }
  function setFeaturedTitle(i: number, title: string) {
    setFeaturedList((prev) =>
      prev.map((m, idx) =>
        idx === i ? { ...m, title: title || undefined } : m,
      ),
    );
  }

  // Media destacada: sube foto o clip. `withAudio` decide el tipo de clip — mudo
  // (≤8s, imágenes solo aquí) vs con audio (≤30s general; sin tope para bailarines).
  // El que excede duración/tamaño abre el recortador; el que ya cabe sube tal cual.
  async function onFeaturedUpload(files: File[], withAudio: boolean) {
    const file = files[0];
    if (!file || !user) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) return;
    setError(null);

    if (isImage) {
      if (withAudio) return; // una imagen no puede ser el clip con audio
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(
          t("profileBuilder.errors.fileTooLarge", {
            name: file.name,
            maxMb: MAX_MB,
          }),
        );
        return;
      }
      setUploading("featured");
      try {
        const u = await uploadUserFile(user.uid, file);
        addFeatured({ url: u.url, type: "image" });
      } finally {
        setUploading(null);
      }
      return;
    }

    // Video: ¿necesita recorte? Duración según el modo (mudo 8s / audio 30s|libre) o tamaño.
    const maxSec = withAudio
      ? mediaPolicy.audioMaxSeconds
      : FEATURED_VIDEO_MAX_SECONDS;
    const seconds = await videoDuration(file).catch(() => null);
    const overDuration =
      maxSec != null && seconds != null && seconds > maxSec + 0.5;
    const overSize = file.size > FEATURED_VIDEO_MAX_MB * 1024 * 1024;
    if (overDuration || overSize) {
      setVideoTrim({ file, withAudio }); // abre el recortador en el modo correcto
      return;
    }
    setUploading("featured");
    try {
      const u = await uploadUserFile(user.uid, file);
      addFeatured({
        url: u.url,
        type: "video",
        withAudio: withAudio || undefined,
      });
    } finally {
      setUploading(null);
    }
  }

  // Sube el clip recortado (Blob) y lo añade a la lista. Si falla, relanza para que
  // el modal muestre el error y siga abierto (no perdemos el recorte hecho).
  async function onVideoTrimConfirm(blob: Blob, ext: string) {
    if (!user || !videoTrim) return;
    const withAudio = videoTrim.withAudio;
    setUploading("featured");
    setError(null);
    try {
      const up = await uploadUserBlob(user.uid, blob, `featured.${ext}`);
      addFeatured({
        url: up.url,
        type: "video",
        withAudio: withAudio || undefined,
      });
      setVideoTrim(null);
    } catch (e) {
      console.error("[builder] video trim upload:", e);
      throw e;
    } finally {
      setUploading(null);
    }
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

  // Arrastre para reposicionar la foto (pan) en modo ajuste. Opera sobre el
  // encuadre de la pantalla actual — el otro no se toca.
  function startDrag(e: React.PointerEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cur = transformFor(currentScreen);
    dragRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      bx: cur.x,
      by: cur.y,
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
    const apply = (p: PhotoTransform) => ({
      ...p,
      x: d.bx + dx,
      y: d.by + dy,
    });
    if (currentScreen === "mobile") setPtMobile(apply);
    else setPt(apply);
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
          <div className="flex shrink-0 items-center gap-2">
            {!adminMode && mostrarRenovar && (
              <button
                type="button"
                onClick={renovar}
                title={renovarLabel}
                aria-label={renovarLabel}
                className="from-silver-100 to-amethyst-300 text-ink inline-flex min-h-9 items-center gap-1.5 rounded-full bg-gradient-to-r px-3 py-1.5 text-sm font-semibold tracking-[1px] uppercase transition hover:shadow-[0_0_18px_rgba(139,92,246,0.5)] sm:px-4"
              >
                <RepeatIcon className="size-4" />
                <span className="hidden sm:inline">{renovarLabel}</span>
              </button>
            )}
            {adminMode || estadoPremium === "activo" ? (
              <GlassButton
                href={`/artistas/${slug}`}
                className="!px-3 sm:!px-4"
                title={t("profileBuilder.statusBar.viewProfile")}
                ariaLabel={t("profileBuilder.statusBar.viewProfile")}
              >
                <EyeIcon className="size-4" />
                <span className="hidden sm:inline">
                  {t("profileBuilder.statusBar.viewProfile")}
                </span>
              </GlassButton>
            ) : (
              <GlassButton
                onClick={() => setShowPublishGate(true)}
                className="!px-3 sm:!px-4"
                title={t("profileBuilder.statusBar.viewProfile")}
                ariaLabel={t("profileBuilder.statusBar.viewProfile")}
              >
                <EyeIcon className="size-4" />
                <span className="hidden sm:inline">
                  {t("profileBuilder.statusBar.viewProfile")}
                </span>
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
        {/* La foto y el encuadre son los de la pantalla en la que estás: lo que
            ves aquí es exactamente lo que verá quien entre desde este tamaño. */}
        {photoFor(currentScreen) ? (
          <Image
            src={photoFor(currentScreen)}
            alt={t("profileBuilder.photo.alt")}
            fill
            sizes="100vw"
            className="object-cover"
            style={{
              transform: photoTransformCss(transformFor(currentScreen)),
              transformOrigin: "center",
            }}
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />

        {/* Slot de foto vacío */}
        {!photoFor(currentScreen) && (
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

        {/* Controles de foto. Cambiar · Encuadrar, y el selector de PANTALLA:
            la que estás usando aparece marcada (es la que ves detrás) y la otra
            abre su vista previa —solo la foto, con su propio encuadre—. */}
        {photoFor(currentScreen) && !adjusting && (
          <div className="absolute top-4 right-4 z-20 flex flex-wrap justify-end gap-2">
            <UploadButton
              glass
              accept="image/*"
              onFiles={onPhotoUpload}
              disabled={uploading === "photo"}
              className="!px-3 sm:!px-4"
              title={t("profileBuilder.photo.change")}
              ariaLabel={t("profileBuilder.photo.change")}
            >
              {uploading === "photo" ? (
                <SpinnerIcon className="size-4 animate-spin" />
              ) : (
                <ImageIcon className="size-4" />
              )}
              <span className="hidden sm:inline">
                {t("profileBuilder.photo.change")}
              </span>
            </UploadButton>
            <GlassButton
              onClick={() => setAdjusting(true)}
              className="!size-11 !justify-center !p-0"
              title={t("profileBuilder.photo.adjust")}
              ariaLabel={t("profileBuilder.photo.adjust")}
            >
              <CropIcon className="size-4" />
            </GlassButton>

            <div
              className={`${glassSurfaceSoft} flex items-center gap-1 rounded-full p-1`}
              role="group"
              aria-label={t("profileBuilder.screenPreview.groupLabel")}
            >
              <GlassSheen />
              {(["desktop", "mobile"] as ScreenTarget[]).map((s) => {
                const Icon = s === "mobile" ? SmartphoneIcon : MonitorIcon;
                const here = s === currentScreen;
                const label =
                  s === "mobile"
                    ? t("profileBuilder.screenPreview.mobile")
                    : t("profileBuilder.screenPreview.desktop");
                return (
                  <button
                    key={s}
                    type="button"
                    // La pantalla actual ya se ve detrás; la otra se previsualiza.
                    onClick={() =>
                      here
                        ? setAdjusting(true)
                        : setScreenPreview({ target: s, justUploaded: false })
                    }
                    aria-current={here}
                    title={
                      here
                        ? t("profileBuilder.screenPreview.adjustHere", { label })
                        : t("profileBuilder.screenPreview.previewOn", { label })
                    }
                    className={`relative inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold tracking-[2px] uppercase transition ${
                      here
                        ? "bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                        : "text-white/60 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Modo ajuste: arrastrar para mover + zoom/rotación */}
        {photoFor(currentScreen) && adjusting && (
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
                {/* Deja claro QUÉ encuadre se está tocando: cada pantalla tiene
                    el suyo y tocar este no altera el de la otra. */}
                <p className="relative mb-3 flex items-center justify-center gap-1.5 text-[10px] font-semibold tracking-[2px] text-white/55 uppercase">
                  {currentScreen === "mobile" ? (
                    <SmartphoneIcon className="size-3.5" />
                  ) : (
                    <MonitorIcon className="size-3.5" />
                  )}
                  {t("profileBuilder.photoAdjust.editingScreen", {
                    label:
                      currentScreen === "mobile"
                        ? t("profileBuilder.screenPreview.mobile")
                        : t("profileBuilder.screenPreview.desktop"),
                  })}
                </p>
                <div className="relative flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
                  {/* Zoom */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-[2px] text-white/55 uppercase">
                      {t("profileBuilder.photoAdjust.zoom")}
                    </span>
                    <StepButton
                      ariaLabel={t("profileBuilder.photoAdjust.zoomOut")}
                      onStep={() =>
                        patchTransform((p) => ({
                          ...p,
                          scale: clamp(p.scale - 0.1, 1, 3),
                        }))
                      }
                    >
                      <MinusIcon className="size-4" />
                    </StepButton>
                    <span className="w-11 text-center text-sm text-white tabular-nums">
                      {transformFor(currentScreen).scale.toFixed(1)}×
                    </span>
                    <StepButton
                      ariaLabel={t("profileBuilder.photoAdjust.zoomIn")}
                      onStep={() =>
                        patchTransform((p) => ({
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
                        patchTransform((p) => ({
                          ...p,
                          rotation: clamp(p.rotation - 2, -180, 180),
                        }))
                      }
                    >
                      <RotateCcwIcon className="size-4" />
                    </StepButton>
                    <span className="w-11 text-center text-sm text-white tabular-nums">
                      {Math.round(transformFor(currentScreen).rotation)}°
                    </span>
                    <StepButton
                      ariaLabel={t("profileBuilder.photoAdjust.rotateRight")}
                      onStep={() =>
                        patchTransform((p) => ({
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
                      patchTransform((p) => ({
                        ...p,
                        rotation: (p.rotation + 90) % 360,
                      }))
                    }
                  >
                    <RotateCwIcon className="size-4" />
                    {t("profileBuilder.photoAdjust.rotate90")}
                  </GlassButton>
                  <GlassButton
                    onClick={() =>
                      setTransformFor(currentScreen, DEFAULT_PHOTO_TRANSFORM)
                    }
                  >
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
            <AccentColorPicker value={accent} onChange={setAccent} />
          </div>

          {/* Sobre la foto solo queda la CIUDAD. Los géneros tienen su propia
              sección y la trayectoria vive junto a la biografía: la portada es
              para la imagen y el nombre, no para un formulario. */}
          <div className="flex flex-wrap items-center gap-2">
            <ProfileChip
              accent={accent}
              onClick={() => setLocOpen(true)}
              ariaLabel={t("profileBuilder.identity.cityPlaceholder")}
              title={t("profileBuilder.identity.cityPlaceholder")}
            >
              {formatLocation(location) ||
                city ||
                t("profileBuilder.identity.cityPlaceholder")}
            </ProfileChip>
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

      {/* Reproductor del perfil: la canción que suena al entrar, dónde se coloca
          y de qué tamaño. Los controles van juntos en un panel para que se lean
          como UN ajuste y no como botones sueltos flotando. */}
      <Block title={t("profileBuilder.player.sectionTitle")}>
        <p className="text-silver-400 mb-4 text-sm leading-relaxed">
          {t("profileBuilder.player.sectionHint")}
        </p>
        {songURL ? (
          <div>
            {/* En modo "sobre la foto" el reproductor se ve arriba (preview en el
                hero); aquí solo mostramos la tarjeta cuando va debajo. */}
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

            <div className={`${glassSurfaceSoft} mt-5 rounded-2xl p-4`}>
              <GlassSheen />
              <div className="relative">
                <p className="mb-3 text-[10px] font-semibold tracking-[2px] text-white/50 uppercase">
                  {t("profileBuilder.player.controlsLabel")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
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
                    <GlassButton
                      onClick={recenterPlayer}
                      title={t("profileBuilder.player.recenterTitle")}
                    >
                      <CrosshairIcon className="size-4" />
                      {t("profileBuilder.player.recenter")}
                    </GlassButton>
                  )}
                  <GlassButton onClick={() => setConfirmRemoveSong(true)}>
                    <TrashIcon className="size-4 text-red-300" />
                    {t("profileBuilder.song.remove")}
                  </GlassButton>
                </div>
                <p className="text-silver-500 mt-3 text-xs leading-relaxed">
                  {playerOverlay
                    ? t("profileBuilder.player.hintOverlay")
                    : t("profileBuilder.player.hintBelow")}
                </p>
              </div>
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
      </Block>

      {/* ── A partir de aquí, el editor sigue el MISMO orden que el perfil
             público: media destacada → galería → temas → sobre ti → géneros →
             redes → relacionados. Editar y ver dejan de ser dos mapas distintos. */}

      {/* Media destacada: los mismos contenedores que el perfil (player + lista),
          con el recortador ocupando el hueco del player cuando hace falta. */}
      <Block title={t("profileBuilder.featured.sectionTitle")}>
        <p className="text-silver-400 mb-5 text-sm leading-relaxed">
          {t("profileBuilder.featured.hint")}
        </p>
        <FeaturedMediaEditor
          items={featuredList}
          active={featuredActive}
          onActiveChange={setFeaturedActive}
          onTitleChange={setFeaturedTitle}
          onRemove={removeFeatured}
          onUpload={onFeaturedUpload}
          uploading={uploading === "featured"}
          accent={accent}
          policy={mediaPolicy}
          pending={videoTrim}
          onCancelTrim={() => setVideoTrim(null)}
          onConfirmTrim={onVideoTrimConfirm}
          maxBytes={FEATURED_VIDEO_MAX_MB * 1024 * 1024}
        />
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
        {/* Mismo contenedor (borde + ancho tope) que el panel público → lo que
            armas aquí se ve idéntico en tu perfil. */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 lg:max-w-[780px]">
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
        </div>
      </Block>

      {/* Más sonadas: los links llevan el logo de la plataforma DENTRO del campo
          para que se sepa cuál es cada uno también cuando ya hay texto escrito
          (con placeholder solo, al escribir se perdía la pista). */}
      <Block title={t("profileBuilder.tracks.sectionTitle")}>
        <p className="text-silver-400 mb-4 text-sm leading-relaxed">
          {t("profileBuilder.tracks.hint")}
        </p>
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
                  <div className="relative">
                    <YouTubeIcon
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/45"
                      aria-hidden="true"
                    />
                    <input
                      value={track.youtubeUrl ?? ""}
                      onChange={(e) =>
                        setTrack(i, { youtubeUrl: e.target.value })
                      }
                      placeholder={t(
                        "profileBuilder.tracks.youtubePlaceholder",
                      )}
                      aria-label={t("profileBuilder.tracks.youtubeAria")}
                      className={`${ghostInput} w-full pl-9`}
                    />
                  </div>
                  <div className="relative">
                    <SpotifyIcon
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/45"
                      aria-hidden="true"
                    />
                    <input
                      value={track.spotifyUrl ?? ""}
                      onChange={(e) =>
                        setTrack(i, { spotifyUrl: e.target.value })
                      }
                      placeholder={t(
                        "profileBuilder.tracks.spotifyPlaceholder",
                      )}
                      aria-label={t("profileBuilder.tracks.spotifyAria")}
                      className={`${ghostInput} w-full pl-9`}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {tracks.length === 0 && (
            <p className="text-silver-500 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center text-sm">
              {t("profileBuilder.tracks.empty")}
            </p>
          )}
          <GlassButton
            onClick={() => setTracks((prev) => [...prev, newTrack()])}
          >
            <PlusIcon className="size-4" />{" "}
            {t("profileBuilder.tracks.addButton")}
          </GlassButton>
        </div>
      </Block>

      {/* Sobre ti: la TRAYECTORIA vive aquí (junto a la historia que cuenta),
          no encima de la foto. */}
      <Block title={t("profileBuilder.bio.sectionTitle")}>
        <div className="mb-4">
          <ProfileChipField
            accent={accent}
            icon={<ClockIcon className="size-4" />}
            label={t("profileBuilder.identity.startYearLabel")}
          >
            <span className="text-xs font-semibold tracking-[2px] text-white/60 uppercase">
              {t("profileBuilder.identity.startYearSince")}
            </span>
            <input
              type="number"
              value={startYear}
              min={1950}
              max={CURRENT_YEAR}
              onChange={(e) => setStartYear(Number(e.target.value))}
              title={t("profileBuilder.identity.startYearTitle")}
              aria-label={t("profileBuilder.identity.startYearTitle")}
              className="w-16 bg-transparent text-sm font-bold text-white tabular-nums outline-none"
            />
            <span className="text-silver-400 text-xs whitespace-nowrap">
              {t("profileBuilder.identity.startYearYears", {
                count: Math.max(0, CURRENT_YEAR - (Number(startYear) || CURRENT_YEAR)),
              })}
            </span>
          </ProfileChipField>
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t("profileBuilder.bio.placeholder")}
          className="text-silver-100 min-h-32 w-full resize-y rounded-lg bg-white/5 px-4 py-3 text-lg leading-relaxed transition outline-none placeholder:text-white/30 focus:bg-white/10"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBioAi(true)}
            disabled={!bio.trim()}
            className="hover:shadow-[0_0_20px_rgba(139,92,246,0.45)]"
          >
            <SparklesIcon className="size-4" />
            {t("profileBuilder.aiBio.button")}
          </Button>
          <p className="text-silver-400 text-xs">
            {t("profileBuilder.aiBio.hint")}
          </p>
        </div>
      </Block>

      {/* Gestor de secciones (§05): tus etiquetas deciden qué puedes mostrar, y
          tú decides qué muestras. Sustituye a la vieja lista de "tus artes" de
          solo lectura — las etiquetas siguen siendo del equipo, pero ahora se ve
          para qué sirven. */}
      <Block title={t("sections.sectionTitle")}>
        <p className="text-silver-400 mb-5 text-sm leading-relaxed">
          {t("sections.sectionHint")}
        </p>
        <SectionManager
          disciplines={disciplines}
          prefs={sectionPrefs}
          onChange={setSectionPrefs}
          // Las etiquetas las asigna el equipo (las reglas las cierran al
          // cliente), así que "pedirla" abre el chat en vez de concederla sola.
          onRequestTag={() => openChat()}
        />
      </Block>

      {/* ── Secciones por ETIQUETA (§05) ──────────────────────────────────
          Solo se piden los datos de lo que tu etiqueta desbloquea Y tienes
          encendido: a un beatmaker no se le pregunta por su talla de calzado. */}
      {seccionActiva("fichaTecnica") && (
        <Block title={t("sections.item.fichaTecnica")}>
          <p className="text-silver-400 mb-4 text-sm leading-relaxed">
            {t("roleSections.fichaHint")}
          </p>
          <FichaTecnicaEditor value={fichaTecnica} onChange={setFichaTecnica} />
        </Block>
      )}

      {seccionActiva("portafolio") && (
        <>
          <Block title={t("roleSections.categorias")}>
            <p className="text-silver-400 mb-4 text-sm leading-relaxed">
              {t("roleSections.categoriasHint")}
            </p>
            <ChipListEditor
              value={categorias}
              onChange={setCategorias}
              sugerencias={CATEGORIAS_MODELO.map((c) => c.value)}
              max={10}
              placeholder={t("roleSections.categoriasPlaceholder")}
              colorDe={categoriaColor}
            />
          </Block>

          <Block title={t("roleSections.marcas")}>
            <p className="text-silver-400 mb-4 text-sm leading-relaxed">
              {t("roleSections.marcasHint")}
            </p>
            <MarcasEditor value={marcas} onChange={setMarcas} />
          </Block>
        </>
      )}

      {seccionActiva("generosBaile") && (
        <Block title={t("roleSections.generosBaile")}>
          <p className="text-silver-400 mb-4 text-sm leading-relaxed">
            {t("roleSections.generosBaileHint")}
          </p>
          <ChipListEditor
            value={generosBaile}
            onChange={setGenerosBaile}
            sugerencias={GENEROS_BAILE}
            max={12}
            placeholder={t("roleSections.generosBailePlaceholder")}
            accent={accent}
          />
        </Block>
      )}

      {seccionActiva("trayectoria") && (
        <Block title={t("roleSections.trayectoria")}>
          <p className="text-silver-400 mb-4 text-sm leading-relaxed">
            {t("roleSections.trayectoriaHint")}
          </p>
          <HitosEditor
            value={trayectoria}
            onChange={(v) => setTrayectoria(v as typeof trayectoria)}
            max={LIMITES.trayectoria}
            addLabel={t("roleSections.addHito")}
          />
        </Block>
      )}

      {seccionActiva("reconocimientos") && (
        <Block title={t("roleSections.reconocimientos")}>
          <p className="text-silver-400 mb-4 text-sm leading-relaxed">
            {t("roleSections.reconocimientosHint")}
          </p>
          <HitosEditor
            value={reconocimientos}
            onChange={(v) => setReconocimientos(v as typeof reconocimientos)}
            max={LIMITES.reconocimientos}
            addLabel={t("roleSections.addPremio")}
          />
        </Block>
      )}

      {/* Géneros: sección propia (en el perfil también la tienen), con los mismos
          chips premium que se publican. */}
      <Block title={t("profileBuilder.genres.sectionTitle")}>
        <p className="text-silver-400 mb-4 text-sm leading-relaxed">
          {t("profileBuilder.genres.hint")}
        </p>
        {genres.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2.5">
            {genres.map((g) => (
              <ProfileChip
                key={g}
                accent={accent}
                onRemove={() => setGenres(genres.filter((x) => x !== g))}
                removeLabel={t("profileBuilder.identity.genreRemove", {
                  value: g,
                })}
              >
                {g}
              </ProfileChip>
            ))}
          </div>
        )}
        <div
          className={`${glassSurfaceSoft} inline-flex max-w-full items-center rounded-full px-3 py-1.5`}
        >
          <GlassSheen />
          <SearchableSelect
            value=""
            onChange={(v) => {
              const g = v.trim();
              if (g && !genres.includes(g)) setGenres([...genres, g]);
            }}
            options={GENRE_OPTIONS}
            allowCustom
            placeholder={t("profileBuilder.identity.genreAdd")}
            searchPlaceholder={t("profileBuilder.identity.genreSearch")}
            emptyText={t("profileBuilder.identity.genreEmpty")}
            customLabel={(v) =>
              t("profileBuilder.identity.genreCustom", { value: v })
            }
            ariaLabel={t("profileBuilder.identity.genreAdd")}
            className="relative flex min-w-[9rem] items-center justify-between gap-2 bg-transparent px-1.5 py-0.5 text-left text-sm text-white/85"
          />
        </div>
      </Block>

      {/* Redes */}
      <Block title={t("profileBuilder.socials.sectionTitle")}>
        <SocialPalette
          value={socials}
          onChange={setSocials}
          followers={manualFollowers}
          onFollowersChange={setManualFollowers}
          primary={primarySocial}
          onPrimaryChange={setPrimarySocial}
        />
      </Block>

      {/* Artistas relacionados / colaboradores: el artista destaca a mano otros
          perfiles de la plataforma (red interna). */}
      <Block title={t("profileBuilder.relatedArtists.sectionTitle")}>
        <p className="text-silver-400 mb-4 text-sm leading-relaxed">
          {t("profileBuilder.relatedArtists.hint")}
        </p>
        <RelatedArtistsPicker
          value={relatedArtists}
          onChange={setRelatedArtists}
          excludeSlug={slug}
        />
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

      <BioAiModal
        open={showBioAi}
        onClose={() => setShowBioAi(false)}
        seed={bio}
        name={artisticName}
        city={city}
        genres={genres}
        startYear={Number(startYear) || undefined}
        onAccept={(text) => setBio(text)}
      />

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

      {/* Vista previa de la foto en la OTRA pantalla. Se abre sola tras cambiar
          la foto (para ajustar el encuadre de esa resolución o subir una imagen
          distinta) y a mano desde los botones Escritorio/Móvil. */}
      <PhotoScreenPreview
        open={screenPreview !== null}
        target={screenPreview?.target ?? otherScreen}
        justUploaded={screenPreview?.justUploaded ?? false}
        url={photoFor(screenPreview?.target ?? otherScreen)}
        transform={transformFor(screenPreview?.target ?? otherScreen)}
        onTransformChange={(next) =>
          setTransformFor(screenPreview?.target ?? otherScreen, next)
        }
        onClose={() => setScreenPreview(null)}
        onUploadOther={onPhotoOther}
        uploading={uploading === "photoOther"}
        accent={accent}
      />
    </article>
  );
}

/** Etiquetas cortas de los tamaños del reproductor (S/M/L). */
const SIZE_LABEL: Record<PlayerSize, string> = {
  sm: "S",
  md: "M",
  lg: "L",
};

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
