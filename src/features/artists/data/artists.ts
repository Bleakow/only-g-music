import type { Artist } from "@/domain/artist";

/**
 * Datos semilla (placeholder). Las fotos son neutras (picsum) y los nombres son
 * de artistas grandes solo para poblar el diseño. Reemplazar por los artistas
 * reales de la disquera — idealmente moviendo esta fuente a Firestore.
 */
const portrait = (seed: string) =>
  `https://picsum.photos/seed/${seed}/600/800`;

export const artists: Artist[] = [
  {
    slug: "bad-bunny",
    name: "Bad Bunny",
    tagline: "El conejo malo que cambió el género urbano.",
    genre: "Reggaetón / Trap latino",
    bio: "Placeholder. Aquí irá la biografía real del artista: trayectoria, estilo, hitos y lo que lo hace parte del sonido de Only G.",
    image: "/hero/badbunny.jpg",
    accent: "#f5c518",
    city: "Barranquilla",
    role: "Artista",
    featured: true,
    socials: { spotify: "#", instagram: "#", youtube: "#" },
    topTracks: [
      { title: "Tití Me Preguntó" },
      { title: "Me Porto Bonito" },
      { title: "Ojitos Lindos" },
    ],
  },
  {
    slug: "the-weeknd",
    name: "The Weeknd",
    tagline: "R&B cinematográfico bañado en neón.",
    genre: "R&B / Pop alternativo",
    bio: "Placeholder. Biografía real del artista pendiente.",
    image: "/hero/theweeknd.jpg",
    // Vídeo placeholder (Google sample). Swap por el clip real del artista.
    video:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    accent: "#e11d2a",
    city: "Bogotá",
    role: "Productor",
    featured: true,
    socials: { spotify: "#", instagram: "#", youtube: "#", x: "#" },
    topTracks: [
      { title: "Blinding Lights" },
      { title: "Save Your Tears" },
      { title: "Starboy" },
    ],
  },
  {
    slug: "rosalia",
    name: "Rosalía",
    tagline: "Flamenco del futuro, sin pedir permiso.",
    genre: "Flamenco-pop / Experimental",
    bio: "Placeholder. Biografía real del artista pendiente.",
    image: "/hero/rosalia.jpg",
    accent: "#ff4d6d",
    city: "Barranquilla",
    role: "Artista",
    featured: true,
    socials: { spotify: "#", instagram: "#", youtube: "#" },
    topTracks: [{ title: "Despechá" }, { title: "Saoko" }, { title: "Bizcochito" }],
  },
  {
    slug: "drake",
    name: "Drake",
    tagline: "Del 6 al mundo, una vez más.",
    genre: "Hip-hop / R&B",
    bio: "Placeholder. Biografía real del artista pendiente.",
    image: "/hero/drake.jpg",
    accent: "#d4af37",
    city: "Bogotá",
    role: "Productor",
    featured: true,
    socials: { spotify: "#", instagram: "#", x: "#" },
    topTracks: [{ title: "God's Plan" }, { title: "One Dance" }, { title: "Hotline Bling" }],
  },
  {
    slug: "dua-lipa",
    name: "Dua Lipa",
    tagline: "Disco-pop para no parar de bailar.",
    genre: "Pop / Dance",
    bio: "Placeholder. Biografía real del artista pendiente.",
    image: portrait("dualipa"),
    accent: "#8b5cf6",
    socials: { spotify: "#", instagram: "#", youtube: "#" },
    topTracks: [{ title: "Levitating" }, { title: "Don't Start Now" }, { title: "Houdini" }],
  },
  {
    slug: "travis-scott",
    name: "Travis Scott",
    tagline: "Psicodelia, autotune y caos controlado.",
    genre: "Hip-hop / Trap",
    bio: "Placeholder. Biografía real del artista pendiente.",
    image: portrait("travis"),
    // Vídeo placeholder (Google sample). Swap por el clip real del artista.
    video:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    accent: "#6b8e23",
    socials: { spotify: "#", instagram: "#", youtube: "#" },
    topTracks: [{ title: "SICKO MODE" }, { title: "goosebumps" }, { title: "HIGHEST IN THE ROOM" }],
  },
];
