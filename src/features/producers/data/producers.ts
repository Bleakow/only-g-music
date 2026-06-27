import type { Producer } from "@/domain/producer";

/**
 * Semilla de productores: SOLO fallback para que el home no quede vacío antes de
 * que el admin migre los productores a Firestore (colección `producers`). El texto
 * va en línea (un idioma), no en i18n, porque ahora es contenido editable desde el
 * panel "Gestionar productores". `id` reusa los antiguos slugs. `createdAt`/
 * `updatedAt` van a 0: son placeholders, no documentos reales.
 */
export const SEED_PRODUCERS: Producer[] = [
  {
    id: "na",
    name: "N.A",
    origin: "Barranquilla, Atlántico",
    role: "Fundador y dueño de Only G Music",
    quote: "Del rap callejero a fundar un sello.",
    bio: "N.A empezó en el rap callejero de Barranquilla, y de esa raíz nació todo: fundó y dirige Only G Music, el sello que hoy impulsa a una nueva generación de artistas. Productor, beatmaker y empresario, es el pulso y la visión detrás del sonido de la casa.",
    socials: {
      facebook: "https://www.facebook.com/profile.php?id=100087040808218",
      instagram: "https://www.instagram.com/ogm_na/",
    },
    mainPhoto: "/hero/NA.jpg",
    photos: ["/hero/Na2.jpg", "/hero/na3.jpg", "/hero/na4.jpg"],
    orden: 0,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "dr-dre",
    name: "Dr. Dre",
    origin: "Compton, California",
    role: "Productor invitado",
    quote: "Una leyenda viva del hip-hop.",
    bio: "Andre Romelle Young, conocido como Dr. Dre, es uno de los productores más influyentes de la historia. Cofundador de N.W.A y de los sellos Death Row y Aftermath, descubrió y produjo a Snoop Dogg, Eminem, 50 Cent y Kendrick Lamar. Sus álbumes The Chronic y 2001 son pilares del hip-hop, y con Beats by Dre revolucionó el audio de consumo.",
    socials: {
      facebook: "https://www.facebook.com/drdre",
      instagram: "https://www.instagram.com/drdre/",
    },
    mainPhoto: "/hero/dre.jpg",
    photos: ["/hero/dre2.jpg", "/hero/dre3.jpg", "/hero/dre4.jpg"],
    orden: 1,
    createdAt: 0,
    updatedAt: 0,
  },
];
