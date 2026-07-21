import type { Service } from "@only-g/shared-types/service";

/**
 * Catálogo de servicios. Precios de referencia en COP. Las FOTOS se sirven desde
 * Firebase Storage (misma carpeta `hero` que los fondos del home; `public/hero`
 * está gitignoreado por copyright). Fuente ÚNICA compartida por ambos catálogos
 * (/comprar y /cotizar) y la página de servicios. (Pendiente: mover a Firestore
 * para que el admin edite servicios/precios/fotos sin desplegar.)
 */
const HERO =
  "https://storage.googleapis.com/only-g-music-745ca.firebasestorage.app/hero";
/** Nombre real del archivo de foto de cada servicio (en la carpeta hero de
 *  Storage). ⚠ produccion/beat aún no están subidos con foto propia. */
const PHOTO: Record<string, string> = {
  grabacion: "grabacion.jpg",
  mezcla: "mezcla.jpg",
  master: "master.jpg",
  produccion: "produccion.jpg",
  renta: "rentar-studio.jpg",
  beat: "beat.jpg",
};
/** Foto de un servicio en Storage. */
const img = (seed: string) => `${HERO}/${PHOTO[seed] ?? seed}`;

/** Fondo compartido del catálogo (mismo en /comprar y /cotizar). */
export const CATALOG_BG_DESKTOP = `${HERO}/buy.png`;
export const CATALOG_BG_MOBILE = `${HERO}/buy-mobile.png`;

/** Fondo de la ventana "Mis cosas" (/solicitudes): la foto que antes usaba el
 *  catálogo, ahora guardada con su propio nombre en Storage. */
export const MIS_COSAS_BG_DESKTOP = `${HERO}/mis-cosas.png`;
export const MIS_COSAS_BG_MOBILE = `${HERO}/mis-cosas-mobile.png`;

/** Fondo de la lista de artistas (/artistas). */
export const LISTA_ARTISTAS_BG_DESKTOP = `${HERO}/lista-artistas.png`;
export const LISTA_ARTISTAS_BG_MOBILE = `${HERO}/lista-artistas-mobile.png`;

/** Fondo de la consola del productor (/consola). */
export const PANEL_PROD_BG_DESKTOP = `${HERO}/panel-prod.png`;
export const PANEL_PROD_BG_MOBILE = `${HERO}/panel-prod-mobile.png`;

export const services: Service[] = [
  {
    slug: "grabacion",
    name: "Grabación",
    description: "Sesión de grabación con ingeniero en estudio.",
    pricing: "por_hora",
    basePrice: 60000,
    image: img("grabacion"),
  },
  {
    slug: "mezcla",
    name: "Mezcla",
    description: "Mezcla profesional, equilibrio y carácter por canción.",
    pricing: "por_cancion",
    basePrice: 200000,
    image: img("mezcla"),
  },
  {
    slug: "masterizacion",
    name: "Masterización",
    description: "Máster final, listo para distribución en plataformas.",
    pricing: "por_cancion",
    basePrice: 120000,
    image: img("master"),
  },
  {
    slug: "produccion",
    name: "Producción completa",
    description: "Del beat al máster: producción integral del tema, a medida.",
    pricing: "a_cotizar",
    image: img("produccion"),
    singleChoice: true,
    variants: [
      {
        id: "1-artista",
        name: "1 artista",
        description: "Producción para un solo artista.",
        pricing: "a_cotizar",
        countable: false,
      },
      {
        id: "2-artistas",
        name: "2 artistas",
        description: "Colaboración o dúo.",
        pricing: "a_cotizar",
        countable: false,
      },
      {
        id: "agrupacion",
        name: "Agrupación / varios artistas",
        description: "Banda o grupo completo.",
        pricing: "a_cotizar",
      },
    ],
  },
  {
    slug: "renta-estudio",
    name: "Renta de estudio",
    description: "Alquila el estudio para tu propia sesión.",
    pricing: "a_cotizar",
    image: img("renta"),
    variants: [
      {
        id: "horas",
        name: "Por horas",
        description: "Bloques por hora.",
        pricing: "por_hora",
        basePrice: 45000,
      },
      {
        id: "dia",
        name: "Todo el día",
        description: "Jornada completa (8 h).",
        pricing: "por_proyecto",
        basePrice: 300000,
      },
      {
        id: "varios-dias",
        name: "Varios días",
        description: "Tarifa especial por proyecto.",
        pricing: "a_cotizar",
      },
    ],
  },
  {
    slug: "beat",
    name: "Beat / instrumental",
    description: "Instrumental a medida o licencia exclusiva.",
    // Precio fijo → comprable en /comprar. El precio real lo pone la config del
    // CEO (`precioBeat`); este basePrice es el fallback/etiqueta del catálogo.
    pricing: "por_proyecto",
    basePrice: 40000,
    image: img("beat"),
  },
];
