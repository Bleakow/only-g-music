/**
 * Productores de Only G Music (entidad de dominio, PURA — sin Firebase ni React).
 *
 * A diferencia de los perfiles de artista, los productores NO tienen ruta propia,
 * ni premium/puntos/likes, ni dueño: son contenido CURADO por el admin que se
 * muestra como secciones del scroll del home. La plantilla visual es FIJA e
 * idéntica para todos; solo cambian los datos y las fotos. El texto va en un solo
 * idioma (lo que escribe el admin), igual que las bios de los artistas.
 */
import type { GeoLocation } from "./location";

export interface ProducerSocials {
  facebook?: string;
  instagram?: string;
}

export interface Producer {
  /** Id del documento de Firestore (auto-generado). */
  id: string;
  name: string;
  /** Ciudad/origen (p. ej. "Barranquilla, Atlántico"). */
  origin: string;
  /** Ubicación estructurada (país/depto/ciudad). `origin` queda como respaldo. */
  location?: GeoLocation;
  /** Rol dentro del sello (p. ej. "Fundador y dueño"). */
  role: string;
  /** Frase corta destacada sobre la portada. */
  quote: string;
  /** Biografía (párrafo). */
  bio: string;
  socials: ProducerSocials;
  /** Portada a pantalla completa (HORIZONTAL, para PC). Obligatoria. */
  mainPhoto: string;
  /**
   * Portada VERTICAL para móvil (art direction, estilo Netflix). Opcional: si no
   * se sube, el móvil usa `mainPhoto` centrada. Una foto horizontal recortada a
   * un móvil a pantalla completa queda como franja con zoom; esta lo evita.
   */
  mainPhotoMobile?: string;
  /** Galería editorial (la 1ª es la foto grande; el resto, la cuadrícula). */
  photos: string[];
  /** Curaduría: orden de aparición en el scroll (menor primero). */
  orden?: number;
  createdAt: number;
  updatedAt: number;
}

/** Datos editables de un productor (lo que el admin crea/modifica). */
export type EditableProducer = Omit<Producer, "id" | "createdAt" | "updatedAt">;

/** Productor "vacío" para inicializar el formulario de alta. */
export function emptyProducer(): EditableProducer {
  return {
    name: "",
    origin: "",
    role: "",
    quote: "",
    bio: "",
    socials: {},
    mainPhoto: "",
    photos: [],
  };
}

/** Orden de la vitrina: por `orden` curado (menor primero); empata por antigüedad. */
export function compararOrden(
  a: Pick<Producer, "orden" | "createdAt">,
  b: Pick<Producer, "orden" | "createdAt">,
): number {
  const oa = a.orden ?? Number.MAX_SAFE_INTEGER;
  const ob = b.orden ?? Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;
  return a.createdAt - b.createdAt;
}
