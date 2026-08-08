/**
 * EL BOOK (§10) — portafolio inmersivo de un perfil de modelo.
 *
 * LA IDEA. La galería del perfil (§04) enseña seis fotos en un panel. El book es
 * otra cosa: una pieza aparte que se recorre haciendo scroll y que cuenta una
 * historia. Se abre desde el perfil y NO lo modifica.
 *
 * LA UNIDAD ES LA ESCENA, no la foto. Esto no es un capricho: `gallery-layout.ts`
 * documenta que el modelo "cada foto elige su tamaño" ya se probó y se retiró
 * porque dejaba huecos y se veía distinto en editor, perfil y móvil. Un lienzo
 * libre —"pon lo que quieras donde quieras"— es esa misma trampa elevada al
 * cubo, ahora también con movimiento. Aquí la modelo elige ESCENAS de un
 * catálogo cerrado; cada escena tiene ranuras fijas y una coreografía horneada.
 *
 * LA RESPIRACIÓN. La primera versión cableó tres escenas a `100svh` y no tenía
 * ningún concepto de "ancho de página": el book era una sucesión de pantallazos
 * sin margen, y eso se lee como abrumador por mucho que la coreografía sea
 * buena. De ahí el eje `medida` — y de ahí que `sangre` sea propiedad del TIPO y
 * no una preferencia: si fuera elegible, en dos clics el book volvería a ser
 * seis pantallazos seguidos.
 *
 * Reparto de responsabilidades, idéntico al de la galería:
 *   · este módulo   → QUÉ escenas existen, cuántas piezas admiten, a qué medida.
 *   · `book.css`    → la geometría (`.og-book-grid[data-escena=…]`).
 *   · `lib/motion`  → el movimiento (una timeline de GSAP por escena).
 *
 * ATMÓSFERA. El book es "ligeramente personalizable": la modelo expresa su
 * estilo sin poder romperlo. Por eso no hay selector de color libre ni caja de
 * tipografías, sino cuatro EJES cerrados donde cada opción trae su paquete
 * completo de tokens. Lo que nunca cambia —el catálogo de escenas, su
 * coreografía, la retícula, la firma— es la identidad.
 *
 * Módulo PURO: sin UI, sin Firebase y sin aleatoriedad (los ids los pone quien
 * llama, para que esto siga siendo testeable sin mockear nada).
 */
import { intercambiar } from "./gallery-layout";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "./artist";

// ─────────────────────────────────────────────────────────────────────────────
// Límites
// ─────────────────────────────────────────────────────────────────────────────

/** Escenas de un book, portada y cierre incluidas. */
export const BOOK_MAX_ESCENAS = 12;

/**
 * Piezas (fotos + vídeos) en todo el book. El tope no es estético: son las
 * descargas que se traga un móvil con datos.
 */
export const BOOK_MAX_PIEZAS = 28;

/** Duración de un vídeo en bucle. Es un gesto, no un clip. */
export const BOOK_VIDEO_MAX_SECONDS = 6;

/**
 * Peso de un vídeo del book. A propósito MUY por debajo de los 25 MB que
 * permite `storage.rules`: seis vídeos de 25 MB son 150 MB de portafolio, o sea
 * un portafolio que nadie llega a ver. Si el archivo se pasa, se recorta y
 * recomprime en el navegador (`video-trim.ts`) antes de subirlo.
 */
export const BOOK_VIDEO_MAX_MB = 8;

/** Textos: cortos a la fuerza. El book es visual; los datos están en el perfil. */
export const BOOK_TITULO_MAX = 60;
export const BOOK_NOTA_MAX = 220;
export const BOOK_ENCABEZADO_MAX = 48;
/** Chip de una línea en mono-mayúsculas (la categoría de una ficha del índice). */
export const BOOK_ETIQUETA_MAX = 24;
/** Texto de una esquina de la portada ("CLIENTE · VANTA STUDIO"). */
export const BOOK_META_MAX = 28;

// ─────────────────────────────────────────────────────────────────────────────
// Medida — cuánto sitio ocupa una escena
// ─────────────────────────────────────────────────────────────────────────────

export type MedidaEscena = "contenida" | "amplia" | "sangre";

export const MEDIDAS: MedidaEscena[] = ["contenida", "amplia", "sangre"];

/**
 * Lo que la modelo puede tocar. `sangre` NO está aquí a propósito: es propiedad
 * del TIPO de escena, no una preferencia. Si fuera elegible, el book volvería en
 * dos clics a ser lo que ya se rechazó una vez — pantallazos seguidos sin aire.
 */
export const MEDIDAS_ELEGIBLES: MedidaEscena[] = ["contenida", "amplia"];

// ─────────────────────────────────────────────────────────────────────────────
// Piezas
// ─────────────────────────────────────────────────────────────────────────────

/** Encuadre de una pieza recortada (equivale a `object-position`). */
export type FocoPieza = "centro" | "arriba" | "abajo";

export interface PiezaBook {
  url: string;
  tipo: "foto" | "video";
  /**
   * Primer fotograma del vídeo, generado en el navegador al subirlo. Sin él, un
   * vídeo con `preload="none"` pinta un rectángulo negro hasta que se descarga.
   */
  poster?: string;
  /**
   * Proporción ancho/alto leída de los metadatos AL SUBIR. Se guarda para que el
   * hueco esté reservado antes de que llegue el archivo: sin esto, cada pieza
   * que carga empuja a las de abajo y el scroll da saltos (CLS).
   */
  ratio?: number;
  /** La ocasión: "Editorial · Bogotá Fashion Week". */
  titulo?: string;
  /** Una o dos frases. En la vitrina es LA CITA que viaja con la foto. */
  nota?: string;
  /**
   * Chip corto en mono-mayúsculas, arriba de la ficha en `indice` ("EDITORIAL",
   * el crédito del fotógrafo). No se reutiliza `nota` —220 caracteres— porque
   * esto es una línea y el CSS depende de que lo sea.
   */
  etiqueta?: string;
  foco?: FocoPieza;
}

/** Bloque de texto suelto de una escena (`ancla` y las frases del `cierre`). */
export interface NotaBook {
  titulo?: string;
  texto?: string;
}

/**
 * Los cuatro textos de esquina de la portada: mono-mayúsculas, cortos.
 *
 * Nombres LÓGICOS (`inicio`/`fin`) y no físicos (`izq`/`der`): se pintan con
 * propiedades lógicas, así que el día que exista un idioma RTL la esquina de
 * "inicio" sigue siendo la primera que se lee, sin migrar un solo documento.
 *
 * El valor es texto ENTERO ("CLIENTE · VANTA STUDIO") y no `{etiqueta, valor}`:
 * partirlo obligaría a mantener un diccionario de etiquetas traducibles dentro
 * de Firestore, que es justo la clase de dato que se queda sin traducir. Lo que
 * sí se traduce son los marcadores de posición del editor.
 */
export interface MetadatosEsquina {
  arribaInicio?: string;
  arribaFin?: string;
  abajoInicio?: string;
  abajoFin?: string;
}

/** Orden de pintado: fila de arriba, fila de abajo. Lo usan el CSS y el editor. */
export const META_ESQUINAS = [
  "arribaInicio",
  "arribaFin",
  "abajoInicio",
  "abajoFin",
] as const satisfies readonly (keyof MetadatosEsquina)[];

// ─────────────────────────────────────────────────────────────────────────────
// Escenas
// ─────────────────────────────────────────────────────────────────────────────

export type EscenaTipo =
  | "portada"
  | "vitrina"
  | "retrato"
  | "diptico"
  | "indice"
  | "plena"
  | "ancla"
  | "tira"
  // RETIRADA: se sigue pintando, ya no se ofrece. El id vive en Firestore.
  | "rejilla"
  | "cierre";

export interface EscenaDef {
  tipo: EscenaTipo;
  /** Piezas mínimas para que la escena se pueda pintar. */
  min: number;
  /** Piezas máximas que caben en su composición. */
  max: number;
  /**
   * Vídeos que admite. No es un límite artístico: cuatro vídeos en bucle en la
   * misma pantalla son cuatro descargas y cuatro decodificaciones a la vez.
   */
  maxVideos: number;
  /** Bloques de texto sueltos (los que desfilan junto a una foto anclada). */
  maxNotas: number;
  /** ¿Cada pieza puede llevar su título y su nota? */
  admiteTextoPorPieza: boolean;
  /** Ancho al que respira la escena. Ver `medidaDeEscena`. */
  medida: MedidaEscena;
  /**
   * La escena COMPONE su texto DENTRO de la rejilla —el encabezado en el área
   * `h`, el texto de la pieza al frente en el área `n`— en vez de pintar el
   * encabezado encima. Es lo que distingue a la vitrina: ahí el título grande va
   * al lado de la foto, y dónde va es una decisión de composición.
   */
  textoEnRejilla?: boolean;
  /**
   * La escena coloca el texto de su pieza en el área `n` de la rejilla, en vez
   * de debajo de la foto dentro de su figura.
   *
   * Existe porque el CSS de `retrato` promete "la foto a un lado, el texto al
   * otro" —reserva cinco de doce columnas para `n`— y el componente pintaba el
   * pie DENTRO de la figura: media escena en blanco en escritorio, y ningún test
   * lo veía. Un área declarada que nadie llena es una banda vacía que no se ve
   * venir.
   */
  notaEnRejilla?: boolean;
  /** Admite los cuatro textos de esquina (`EscenaBook.meta`). */
  admiteMeta?: boolean;
  /**
   * Se sigue PINTANDO pero ya no se OFRECE. Los ids viven en Firestore: retirar
   * una escena del catálogo activo no puede dejar sin book a quien ya la usó.
   */
  retirada?: boolean;
  /**
   * Escenas ESTRUCTURALES: no se añaden, no se borran y no se mueven, y sus
   * fotos son obligatorias. Son el arranque y el cierre que comparten todos los
   * books: la apertura, el carrusel de tres cartas y la despedida. Lo que va en
   * medio ya es cosa de cada modelo.
   */
  fija?: "primera" | "segunda" | "ultima";
}

/** Dónde va cada escena fija. Lo usan la normalización y el orden del editor. */
const POSICION_FIJA: Record<NonNullable<EscenaDef["fija"]>, number> = {
  primera: 0,
  segunda: 1,
  ultima: 99,
};

/**
 * Catálogo. El ORDEN es el que ve la modelo al añadir una escena, y también el
 * del book guiado: va de la que abre a la que cierra, pasando por la que más
 * material pide.
 */
export const ESCENAS: EscenaDef[] = [
  {
    tipo: "portada",
    /**
     * LA APERTURA. Cuatro fotos, ni una más ni una menos, y las cuatro
     * OBLIGATORIAS. Ver `ROLES_APERTURA`: la que abre, las dos que suben y la
     * de portada.
     *
     * No es una escena que se compone: es una secuencia CERRADA, igual en todos
     * los books. Por eso las piezas son un mínimo Y un máximo y la escena no se
     * puede quitar ni mover.
     */
    min: 4,
    max: 4,
    // Sin vídeo: la primera se desenfoca hasta cero, dos viajan con parallax y
    // la de portada se desintegra en cientos de piezas. Clips decodificando a
    // la vez en la primera pantalla es el peor sitio posible para gastar.
    maxVideos: 0,
    maxNotas: 0,
    // Solo la de PORTADA lleva texto (su título y su descripción, lo que la
    // modelo quiera). El editor lo pide únicamente en esa ranura; las otras tres
    // son imagen pura. El nombre grande no es texto de la escena: sale del perfil.
    admiteTextoPorPieza: true,
    // La ÚNICA escena a pantalla completa de todo el book. Una apertura puede
    // permitírselo; ocho seguidas es lo que se sintió abrumador.
    medida: "sangre",
    admiteMeta: true,
    fija: "primera",
  },
  {
    tipo: "vitrina",
    /**
     * TRES cartas y tres sitios: una al frente y dos regadas a los lados. El
     * número no es una preferencia, es la coreografía — hay exactamente tres
     * posiciones, y admitir una cuarta obligaría a inventarle un sitio que la
     * composición no tiene.
     */
    min: 3,
    max: 3,
    // Un clip puede estar al frente, pero no media vitrina: las tres cartas se
    // ven a la vez y tres vídeos ahí son tres descargas simultáneas.
    maxVideos: 1,
    maxNotas: 0,
    admiteTextoPorPieza: true,
    medida: "amplia",
    // La descripción de la carta que está al frente va en el área `n` de la
    // rejilla, al lado del escenario — no debajo de cada foto.
    notaEnRejilla: true,
    // SEGUNDA y obligatoria: va siempre justo después de la apertura, con sus
    // tres fotos puestas. Es parte del arranque que comparten todos los books.
    fija: "segunda",
  },
  {
    tipo: "retrato",
    min: 1,
    max: 1,
    maxVideos: 1,
    maxNotas: 0,
    admiteTextoPorPieza: true,
    medida: "contenida",
    notaEnRejilla: true,
  },
  {
    tipo: "diptico",
    min: 2,
    max: 2,
    maxVideos: 1,
    maxNotas: 0,
    admiteTextoPorPieza: true,
    medida: "amplia",
  },
  {
    tipo: "indice",
    min: 3,
    max: 4,
    // Sin vídeo: el revelado del índice es un recorte animado sobre la misma
    // imagen desenfocada, y eso con un vídeo son dos decodificaciones por ficha.
    maxVideos: 0,
    maxNotas: 0,
    admiteTextoPorPieza: true,
    medida: "amplia",
    textoEnRejilla: true,
  },
  {
    tipo: "plena",
    min: 1,
    max: 1,
    maxVideos: 1,
    maxNotas: 0,
    admiteTextoPorPieza: true,
    medida: "amplia",
    admiteMeta: true,
  },
  {
    tipo: "ancla",
    min: 1,
    max: 1,
    maxVideos: 1,
    maxNotas: 3,
    admiteTextoPorPieza: false,
    medida: "contenida",
  },
  {
    tipo: "tira",
    min: 3,
    max: 6,
    maxVideos: 2,
    maxNotas: 0,
    admiteTextoPorPieza: true,
    medida: "amplia",
  },
  // RETIRADA. `indice` cuenta lo mismo —una fila de fotos iguales— pero con
  // metadatos, numeración y revelado. Mantener las dos es ofrecer la versión
  // buena y la sosa una al lado de la otra. No se BORRA: los books que ya la
  // usan tienen que seguir pintándose.
  {
    tipo: "rejilla",
    min: 3,
    max: 4,
    maxVideos: 1,
    maxNotas: 0,
    admiteTextoPorPieza: true,
    medida: "amplia",
    retirada: true,
  },
  {
    tipo: "cierre",
    min: 0,
    max: 1,
    maxVideos: 0,
    // Las dos frases célebres. Son exactamente lo que ya es `NotaBook`
    // (`titulo` = a quién se atribuye, `texto` = la frase): no hace falta un
    // tipo nuevo para lo que ya existe.
    maxNotas: 2,
    admiteTextoPorPieza: false,
    medida: "contenida",
    admiteMeta: true,
    fija: "ultima",
  },
];

export interface EscenaBook {
  /** Estable: sobrevive a reordenar. Lo genera quien crea la escena. */
  id: string;
  tipo: EscenaTipo;
  piezas: PiezaBook[];
  /** Línea grande de la escena. */
  encabezado?: string;
  /** Solo escenas con `maxNotas > 0`: `ancla` (3) y `cierre` (2 frases). */
  notas?: NotaBook[];
  /** Solo escenas con `admiteMeta`. */
  meta?: MetadatosEsquina;
  /** Solo escenas que no van a sangre. Ver `medidaDeEscena`. */
  medida?: MedidaEscena;
  /**
   * Redes que enseña el cierre. Se guardan las PLATAFORMAS, nunca las URLs.
   *
   * Las URLs viven en `profile.socials`, que es donde la modelo ya las mantiene
   * y donde ya hay editor. Una copia aquí es un enlace que se pudre el día que
   * cambie de cuenta: el perfil se arreglaría solo y el book seguiría apuntando
   * a la vieja, porque nadie entra a un book a corregir un enlace.
   *
   * Ausente = se enseñan TODAS las que tenga el perfil. Es la versión guiada:
   * funciona bien sin que la modelo toque nada.
   */
  redes?: SocialPlatform[];
}

const DEF_POR_TIPO = new Map(ESCENAS.map((e) => [e.tipo, e]));

/** Definición de una escena por su tipo. */
export function escenaDef(tipo: EscenaTipo): EscenaDef | undefined {
  return DEF_POR_TIPO.get(tipo);
}

/** ¿Es un tipo de escena conocido? (guardarraíl para datos crudos). */
export function esEscenaTipo(v: unknown): v is EscenaTipo {
  return typeof v === "string" && DEF_POR_TIPO.has(v as EscenaTipo);
}

/**
 * Escenas que la modelo puede AÑADIR. Las estructurales ya están puestas; las
 * retiradas se siguen pintando pero no se ofrecen.
 */
export function escenasElegibles(): EscenaDef[] {
  return ESCENAS.filter((e) => !e.fija && !e.retirada);
}

/**
 * Medida EFECTIVA de una escena: la que eligió la modelo si su tipo lo permite,
 * si no la del catálogo. `sangre` no se negocia — es del tipo.
 */
export function medidaDeEscena(escena: EscenaBook): MedidaEscena {
  const def = escenaDef(escena.tipo);
  if (!def) return "contenida";
  if (def.medida === "sangre") return "sangre";
  return escena.medida && MEDIDAS_ELEGIBLES.includes(escena.medida)
    ? escena.medida
    : def.medida;
}

/** ¿Esta escena tiene las piezas que su composición necesita? */
export function escenaCompleta(escena: EscenaBook): boolean {
  const def = escenaDef(escena.tipo);
  if (!def) return false;
  const n = escena.piezas.length;
  return n >= def.min && n <= def.max;
}

/** Vídeos que ya tiene una escena (para saber si cabe otro). */
export function videosDeEscena(escena: EscenaBook): number {
  return escena.piezas.filter((p) => p.tipo === "video").length;
}

/**
 * Número visible de una ficha del índice ("001"). DERIVADO del sitio que ocupa y
 * no guardado: así reordenar las piezas no deja huecos en la numeración.
 */
export function numeroDeFicha(i: number): string {
  return String(i + 1).padStart(3, "0");
}

// ─────────────────────────────────────────────────────────────────────────────
// Apertura — qué papel juega cada una de sus cuatro fotos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El papel de cada ranura de la apertura. No es decoración: es lo que el editor
 * necesita para poder DECIR cuál es cuál. Cuatro huecos idénticos y "sube tres
 * fotos" no le explica a nadie que la primera va a pantalla completa y la última
 * se desintegra.
 *
 *  · `abre`    — a pantalla completa, con el nombre encima. Se desenfoca hasta
 *                desaparecer en el color de fondo.
 *  · `sube`    — las dos que entran desde abajo en diagonal. Sin texto.
 *  · `portada` — una sola, contenida (NO a pantalla completa), con su título y
 *                su descripción. Aparece y se va desintegrándose.
 */
export type RolPiezaApertura = "abre" | "sube" | "portada";

export const ROLES_APERTURA: RolPiezaApertura[] = [
  "abre",
  "sube",
  "sube",
  "portada",
];

/** Papel de la ranura `i` de la apertura (undefined si se sale). */
export function rolDePiezaApertura(i: number): RolPiezaApertura | undefined {
  return ROLES_APERTURA[i];
}

/** ¿Esta ranura de esta escena es la foto DE PORTADA (la que lleva texto)? */
export function esFotoDePortada(tipo: EscenaTipo, i: number): boolean {
  return tipo === "portada" && rolDePiezaApertura(i) === "portada";
}

// ─────────────────────────────────────────────────────────────────────────────
// Vitrina — el reparto de ranuras
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Qué pieza ocupa cada RANURA de la vitrina: `ranuras[r]` es el índice de la
 * pieza que está en la ranura `r`, y la ranura 0 es el hueco grande.
 *
 * Es un REPARTO y no un reordenar, por dos motivos y ninguno es estético:
 *  1. `escena.piezas` es el dato que guardó la modelo. Si mirar el book lo
 *     reordenara, mirar sería editar.
 *  2. Si el array cambiara de orden, React movería los nodos del DOM — y mover
 *     nodos rompe a la vez el foco del teclado y la identidad que necesita la
 *     animación de traslación: el elemento que se mide ANTES tiene que ser el
 *     MISMO que se anima después.
 * Aquí lo único que cambia es en qué área de la rejilla cae cada figura.
 */
export function ranurasDeVitrina(piezas: number): number[] {
  return Array.from({ length: Math.max(0, piezas) }, (_, i) => i);
}

/**
 * Los tres sitios de la vitrina, en orden de ranura. La ranura 0 es la carta que
 * está AL FRENTE; las otras dos quedan regadas a los lados, cada una con su
 * inclinación y su tamaño (que declara el CSS) para que se lea como un montón
 * desordenado y no como una fila.
 */
export const SITIOS_VITRINA = ["frente", "izq", "der"] as const;
export type SitioVitrina = (typeof SITIOS_VITRINA)[number];

/** En qué sitio cae la ranura `r`. */
export function sitioDeRanura(r: number): SitioVitrina | undefined {
  return SITIOS_VITRINA[r];
}

/**
 * Trae una pieza al hueco grande INTERCAMBIÁNDOLA con la que estaba ahí, no
 * desplazando al resto: las demás miniaturas se quedan donde estaban, que es lo
 * que el ojo espera al tocar una. Un desplazamiento convertiría un toque en la
 * última en una recolocación de toda la columna.
 *
 * Devuelve el MISMO array si no hay nada que hacer, para que React descarte el
 * render y no se dispare una animación de cero píxeles.
 */
export function traerAlFrente(ranuras: number[], pieza: number): number[] {
  const desde = ranuras.indexOf(pieza);
  if (desde <= 0) return ranuras;
  return intercambiar(ranuras, 0, desde);
}

// ─────────────────────────────────────────────────────────────────────────────
// Atmósfera
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fondo. Cada opción arrastra su paleta completa en CSS (fondo, tinta,
 * superficie, línea) — por eso es un eje y no un "color de fondo": elegir solo
 * el fondo es la receta garantizada para un texto ilegible.
 */
export type FondoId = "medianoche" | "hueso" | "arena" | "carbon";

/** Familia tipográfica del display. */
export type LetraId = "narrow" | "serif" | "mono" | "grotesca";

/**
 * Carácter del movimiento. Esto es lo que se pidió como "estilo de scroll", y
 * NO es una librería de smooth-scroll: son tres juegos de parámetros
 * alimentando las mismas timelines.
 */
export type RitmoId = "sereno" | "dinamico" | "brusco";

/** Capa de textura sobre todo el book. */
export type TexturaId = "ninguna" | "grano" | "vineta";

export const FONDOS: FondoId[] = ["medianoche", "hueso", "arena", "carbon"];
export const LETRAS: LetraId[] = ["narrow", "serif", "mono", "grotesca"];
export const RITMOS: RitmoId[] = ["sereno", "dinamico", "brusco"];
export const TEXTURAS: TexturaId[] = ["ninguna", "grano", "vineta"];

export interface Atmosfera {
  fondo: FondoId;
  letra: LetraId;
  ritmo: RitmoId;
  textura: TexturaId;
  /**
   * Color de acento. Ausente = HEREDA el `accent` del perfil, que ya existe y ya
   * tiene selector. Un book que arranca con el color que la modelo ya eligió
   * para su perfil es coherente sin que ella toque nada.
   */
  acento?: string;
}

/** Por defecto: la casa Only G. Quien no toque nada, tiene un book de la marca. */
export const ATMOSFERA_POR_DEFECTO: Atmosfera = {
  fondo: "medianoche",
  letra: "narrow",
  ritmo: "dinamico",
  textura: "grano",
};

export interface AtmosferaPreset extends Atmosfera {
  id: string;
}

/**
 * Atmósferas preconfiguradas. Existen porque cuatro ejes son 144 combinaciones y
 * casi nadie quiere ser director de arte: un clic deja el book bien, y quien
 * quiera afinar tiene los ejes debajo. Presets primero, perillas después.
 */
export const ATMOSFERAS: AtmosferaPreset[] = [
  {
    id: "nocturno",
    fondo: "medianoche",
    letra: "narrow",
    ritmo: "dinamico",
    textura: "grano",
  },
  {
    id: "editorial",
    fondo: "hueso",
    letra: "serif",
    ritmo: "sereno",
    textura: "ninguna",
  },
  {
    id: "brutal",
    fondo: "carbon",
    letra: "mono",
    ritmo: "brusco",
    textura: "ninguna",
  },
  {
    id: "calido",
    fondo: "arena",
    letra: "serif",
    ritmo: "sereno",
    textura: "vineta",
  },
];

/** Color de acento efectivo: el del book si lo eligió, si no el del perfil. */
export function acentoEfectivo(
  atmosfera: Atmosfera,
  accentDelPerfil: string,
): string {
  return atmosfera.acento ?? accentDelPerfil;
}

// ─────────────────────────────────────────────────────────────────────────────
// El book
// ─────────────────────────────────────────────────────────────────────────────

export interface Book {
  escenas: EscenaBook[];
  atmosfera: Atmosfera;
  /**
   * Hasta que no se publica, el book solo lo ve su dueña. Un portafolio a medio
   * montar enseñado al mundo es peor que ningún portafolio.
   */
  publicado: boolean;
}

/**
 * Book VACÍO: portada y cierre, que son la estructura mínima. Es la primitiva —
 * la usan las pruebas y sirve de red para `normalizarBook`. Para crear el book
 * de una modelo se usa `bookGuiado`.
 */
export function bookNuevo(id: (i: number) => string): Book {
  return {
    escenas: ESCENAS_FIJAS.map((tipo, i) => ({ id: id(i), tipo, piezas: [] })),
    atmosfera: { ...ATMOSFERA_POR_DEFECTO },
    publicado: false,
  };
}

/**
 * Las escenas estructurales, EN SU ORDEN. Se deriva del catálogo en vez de
 * escribirse a mano para que marcar una escena como fija baste: si la lista
 * viviera aparte, añadir una cuarta obligaría a acordarse de tocar también la
 * normalización, y ese olvido no da error — solo coloca la escena en otro sitio.
 */
export const ESCENAS_FIJAS: EscenaTipo[] = ESCENAS.filter((e) => e.fija)
  .sort((a, b) => POSICION_FIJA[a.fija!] - POSICION_FIJA[b.fija!])
  .map((e) => e.tipo);

/**
 * La secuencia con la que nace un book. No es una lista de escenas bonitas: es
 * un RITMO —abrir, presentar, respirar, comparar, catalogar, declarar, cerrar—
 * pensado para que llenarla dé un portafolio decente sin saber de composición.
 *
 * Quitar es mucho más fácil que imaginar: un lienzo con dos escenas vacías no
 * guía a nadie, y era exactamente lo que hacía la primera versión.
 */
export const BOOK_ESCENAS_POR_DEFECTO: EscenaTipo[] = [
  "portada",
  "vitrina",
  "retrato",
  "diptico",
  "indice",
  // `plena` y no `ancla`: la semilla tiene que pedir FOTOS, no redacción.
  // `ancla` necesita tres bloques de texto escritos para verse bien, y una
  // modelo que abre el editor por primera vez tiene fotos, no un guion. `ancla`
  // sigue en el menú de añadir para quien sí quiera contar algo.
  "plena",
  "cierre",
];

/**
 * Book guiado: la secuencia de arriba ya montada y vacía. Los ids siguen
 * viniendo de fuera — este módulo no inventa aleatoriedad.
 */
export function bookGuiado(id: (i: number) => string): Book {
  return {
    escenas: BOOK_ESCENAS_POR_DEFECTO.map((tipo, i) => ({
      id: id(i),
      tipo,
      piezas: [],
    })),
    atmosfera: { ...ATMOSFERA_POR_DEFECTO },
    publicado: false,
  };
}

/** Piezas de todo el book (para el tope global y para el resumen). */
export function contarPiezas(book: Book): number {
  return book.escenas.reduce((n, e) => n + e.piezas.length, 0);
}

/** Escenas de contenido: las que la modelo montó, sin portada ni cierre. */
export function escenasDeContenido(book: Book): EscenaBook[] {
  return book.escenas.filter((e) => !escenaDef(e.tipo)?.fija);
}

/** Lo que se pinta en la tarjeta de entrada del perfil. */
export function resumenBook(book: Book): { escenas: number; piezas: number } {
  return {
    escenas: escenasDeContenido(book).length,
    piezas: contarPiezas(book),
  };
}

/** ¿Cabe otra escena? */
export function puedeAnadirEscena(book: Book): boolean {
  return book.escenas.length < BOOK_MAX_ESCENAS;
}

/**
 * Añade una escena SIEMPRE AL FINAL: justo antes del cierre, que es la última y
 * no se mueve. Es la lectura literal de "se posiciona siempre al final" sin
 * romper la invariante estructural del book.
 */
export function anadirEscena(
  book: Book,
  tipo: EscenaTipo,
  id: string,
): Book {
  if (!puedeAnadirEscena(book)) return book;
  const def = escenaDef(tipo);
  if (!def || def.fija || def.retirada) return book;
  const i = book.escenas.findIndex(
    (e) => escenaDef(e.tipo)?.fija === "ultima",
  );
  const escenas = [...book.escenas];
  escenas.splice(i === -1 ? escenas.length : i, 0, { id, tipo, piezas: [] });
  return { ...book, escenas };
}

/** ¿Cabe otra pieza en esta escena? (mira el hueco de la escena Y el del book). */
export function puedeAnadirPieza(
  book: Book,
  escena: EscenaBook,
  tipo: PiezaBook["tipo"] = "foto",
): boolean {
  const def = escenaDef(escena.tipo);
  if (!def) return false;
  if (escena.piezas.length >= def.max) return false;
  if (contarPiezas(book) >= BOOK_MAX_PIEZAS) return false;
  if (tipo === "video" && videosDeEscena(escena) >= def.maxVideos) return false;
  return true;
}

/**
 * ¿Se puede publicar? Hace falta portada con foto y AL MENOS una escena de
 * contenido completa: si no, lo que se publicaría es una portada y un cierre
 * pegados, que no es un portafolio.
 */
export function bookPublicable(book: Book): boolean {
  // TODAS las estructurales completas, no solo empezadas: son el arranque que
  // comparten los books, y a medias la secuencia se rompe —el nombre se
  // dispersa y detrás no sube nada, o el carrusel se queda con un hueco—.
  const fijas = ESCENAS_FIJAS.map((tipo) =>
    book.escenas.find((e) => e.tipo === tipo),
  );
  if (!fijas.every((e) => e && escenaCompleta(e))) return false;
  // Y al menos una escena propia: un book que es solo el arranque no es un
  // portafolio, es una presentación.
  return escenasDeContenido(book).some(escenaCompleta);
}

/** Portada del book (para la tarjeta de entrada). Su póster si es vídeo. */
export function portadaDelBook(book: Book): string | undefined {
  const pieza = book.escenas.find((e) => e.tipo === "portada")?.piezas[0];
  if (!pieza) return undefined;
  return pieza.tipo === "video" ? (pieza.poster ?? pieza.url) : pieza.url;
}

/**
 * Redes efectivas del cierre: las elegidas cruzadas con las que el perfil tiene
 * de verdad. El cruce no es cosmético — si guardó "tiktok" y luego borró esa URL
 * en su perfil, el book pintaría un icono que no lleva a ninguna parte.
 */
export function redesDelCierre(
  escena: EscenaBook,
  socialsDelPerfil: Partial<Record<SocialPlatform, string>>,
): { red: SocialPlatform; url: string }[] {
  const pedidas = escena.redes?.length ? escena.redes : SOCIAL_PLATFORMS;
  return pedidas
    .map((red) => ({ red, url: socialsDelPerfil[red] ?? "" }))
    .filter((r) => r.url !== "");
}

/**
 * INTERCAMBIA dos escenas de contenido. La portada y el cierre no se mueven: son
 * la estructura. Se reutiliza `intercambiar` de la galería —misma operación,
 * mismo motivo— y aquí solo se añade la guarda estructural.
 */
export function moverEscena(book: Book, a: number, b: number): Book {
  const fija = (i: number) => Boolean(escenaDef(book.escenas[i]?.tipo)?.fija);
  if (a < 0 || b < 0 || a >= book.escenas.length || b >= book.escenas.length) {
    return book;
  }
  if (fija(a) || fija(b)) return book;
  const escenas = intercambiar(book.escenas, a, b);
  return escenas === book.escenas ? book : { ...book, escenas };
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalización (lo que llega de Firestore no se fía)
// ─────────────────────────────────────────────────────────────────────────────

function texto(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
}

function unoDe<T extends string>(v: unknown, opciones: T[], porDefecto: T): T {
  return opciones.includes(v as T) ? (v as T) : porDefecto;
}

function normalizarPieza(raw: unknown): PiezaBook | null {
  const o = (raw ?? {}) as Partial<PiezaBook>;
  const url = typeof o.url === "string" ? o.url : "";
  if (!url) return null;
  return {
    url,
    tipo: o.tipo === "video" ? "video" : "foto",
    poster: typeof o.poster === "string" && o.poster ? o.poster : undefined,
    ratio:
      typeof o.ratio === "number" && Number.isFinite(o.ratio) && o.ratio > 0
        ? o.ratio
        : undefined,
    titulo: texto(o.titulo, BOOK_TITULO_MAX),
    nota: texto(o.nota, BOOK_NOTA_MAX),
    etiqueta: texto(o.etiqueta, BOOK_ETIQUETA_MAX),
    foco: unoDe<FocoPieza>(o.foco, ["centro", "arriba", "abajo"], "centro"),
  };
}

function normalizarMeta(raw: unknown): MetadatosEsquina | undefined {
  const o = (raw ?? {}) as Partial<MetadatosEsquina>;
  const out: MetadatosEsquina = {};
  for (const k of META_ESQUINAS) {
    const v = texto(o[k], BOOK_META_MAX);
    if (v) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizarEscena(raw: unknown, i: number): EscenaBook | null {
  const o = (raw ?? {}) as Partial<EscenaBook>;
  if (!esEscenaTipo(o.tipo)) return null;
  const def = escenaDef(o.tipo)!;
  const piezas = (Array.isArray(o.piezas) ? o.piezas : [])
    .map(normalizarPieza)
    .filter((p): p is PiezaBook => p !== null)
    .slice(0, def.max);
  const notas = (Array.isArray(o.notas) ? o.notas : [])
    .slice(0, def.maxNotas)
    .map((n) => {
      const nn = (n ?? {}) as Partial<NotaBook>;
      return {
        titulo: texto(nn.titulo, BOOK_TITULO_MAX),
        texto: texto(nn.texto, BOOK_NOTA_MAX),
      };
    })
    .filter((n) => n.titulo || n.texto);
  const meta = def.admiteMeta ? normalizarMeta(o.meta) : undefined;
  const redes =
    o.tipo === "cierre" && Array.isArray(o.redes)
      ? [
          ...new Set(
            o.redes.filter((r): r is SocialPlatform =>
              SOCIAL_PLATFORMS.includes(r as SocialPlatform),
            ),
          ),
        ]
      : [];
  // La medida solo se guarda si su tipo deja elegirla: en una escena a sangre
  // sería un dato muerto que confundiría al siguiente que lea el documento.
  const medida =
    def.medida !== "sangre" &&
    o.medida &&
    MEDIDAS_ELEGIBLES.includes(o.medida)
      ? o.medida
      : undefined;

  return {
    id: typeof o.id === "string" && o.id ? o.id : `e${i}`,
    tipo: o.tipo,
    piezas,
    encabezado: texto(o.encabezado, BOOK_ENCABEZADO_MAX),
    ...(notas.length ? { notas } : {}),
    ...(meta ? { meta } : {}),
    ...(medida ? { medida } : {}),
    ...(redes.length ? { redes } : {}),
  };
}

/** Atmósfera saneada: cualquier eje desconocido cae a su valor por defecto. */
export function normalizarAtmosfera(raw: unknown): Atmosfera {
  const o = (raw ?? {}) as Partial<Atmosfera>;
  return {
    fondo: unoDe(o.fondo, FONDOS, ATMOSFERA_POR_DEFECTO.fondo),
    letra: unoDe(o.letra, LETRAS, ATMOSFERA_POR_DEFECTO.letra),
    ritmo: unoDe(o.ritmo, RITMOS, ATMOSFERA_POR_DEFECTO.ritmo),
    textura: unoDe(o.textura, TEXTURAS, ATMOSFERA_POR_DEFECTO.textura),
    // Solo hex de 6 dígitos: es lo que entiende el CSS del book y lo que produce
    // el selector de acento del perfil.
    acento:
      typeof o.acento === "string" && /^#[0-9a-fA-F]{6}$/.test(o.acento)
        ? o.acento
        : undefined,
  };
}

/**
 * Book saneado a partir de datos crudos. Garantiza las dos invariantes
 * estructurales —portada la primera, cierre el último— reordenando en vez de
 * rechazar: un documento raro se arregla, no deja a la modelo sin portafolio.
 */
export function normalizarBook(raw: unknown): Book {
  const o = (raw ?? {}) as Partial<Book>;
  const crudas = (Array.isArray(o.escenas) ? o.escenas : [])
    .map(normalizarEscena)
    .filter((e): e is EscenaBook => e !== null);

  // Las estructurales se recuperan por tipo y se recolocan en SU sitio. Si el
  // documento no las trae (o llegan desordenadas), se reponen vacías: un book
  // sin arranque no es un book, y rechazar el documento dejaría a la modelo sin
  // portafolio en vez de con uno reparable.
  const fijas = ESCENAS_FIJAS.map(
    (tipo) =>
      crudas.find((e) => e.tipo === tipo) ?? { id: tipo, tipo, piezas: [] },
  );
  const esFija = new Set<EscenaTipo>(ESCENAS_FIJAS);
  // El recorte va sobre el CONTENIDO, no sobre la lista cruda: las fijas se
  // ponen siempre, así que recortar antes dejaría un book más largo que el tope.
  const contenido = crudas
    .filter((e) => !esFija.has(e.tipo))
    .slice(0, BOOK_MAX_ESCENAS - fijas.length);

  // Todas las fijas menos la última van delante; la última, al final.
  const delante = fijas.slice(0, -1);
  const detras = fijas.slice(-1);

  const book: Book = {
    escenas: [...delante, ...contenido, ...detras],
    atmosfera: normalizarAtmosfera(o.atmosfera),
    publicado: o.publicado === true,
  };

  // Publicado pero ya no publicable (borró las fotos): se despublica solo, en vez
  // de servir un book roto a quien abra el enlace.
  if (book.publicado && !bookPublicable(book)) book.publicado = false;
  return book;
}
