import type { Service } from "@/domain/service";

/**
 * Catálogo de servicios — DATOS PLACEHOLDER. Precios de referencia en COP e
 * imágenes placeholder (picsum) solo para maquetar el embudo. Reemplazar por
 * los servicios/tarifas/fotos reales de Only G (idealmente en Firestore para
 * que el admin los edite). Las imágenes pueden moverse a /public/services/*.
 */
const img = (seed: string) => `https://picsum.photos/seed/ogm-${seed}/240/240`;

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
    variants: [
      {
        id: "1-artista",
        name: "1 artista",
        description: "Producción para un solo artista.",
        pricing: "a_cotizar",
      },
      {
        id: "2-artistas",
        name: "2 artistas",
        description: "Colaboración o dúo.",
        pricing: "a_cotizar",
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
    pricing: "a_cotizar",
    image: img("beat"),
  },
];
