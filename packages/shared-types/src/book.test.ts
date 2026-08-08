import { describe, it, expect } from "vitest";
import {
  ATMOSFERAS,
  DESINTEGRADOS,
  ATMOSFERA_POR_DEFECTO,
  BOOK_ESCENAS_POR_DEFECTO,
  BOOK_MAX_ESCENAS,
  BOOK_MAX_PIEZAS,
  BOOK_META_MAX,
  BOOK_NOTA_MAX,
  BOOK_TITULO_MAX,
  ESCENAS,
  ESCENAS_FIJAS,
  FONDOS,
  LETRAS,
  MEDIDAS,
  MEDIDAS_ELEGIBLES,
  META_ESQUINAS,
  ROLES_APERTURA,
  SITIOS_VITRINA,
  RITMOS,
  TEXTURAS,
  anadirEscena,
  bookGuiado,
  bookNuevo,
  bookPublicable,
  contarPiezas,
  escenaCompleta,
  cuentasValidas,
  piezasQueFaltan,
  escenaDef,
  escenasDeContenido,
  escenasElegibles,
  esEscenaTipo,
  esFotoDePortada,
  medidaDeEscena,
  rolDePiezaApertura,
  sitioDeRanura,
  moverEscena,
  normalizarAtmosfera,
  normalizarBook,
  numeroDeFicha,
  portadaDelBook,
  puedeAnadirEscena,
  puedeAnadirPieza,
  ranurasDeVitrina,
  redesDelCierre,
  resumenBook,
  traerAlFrente,
  type Book,
  type EscenaBook,
} from "./book";
import { areaDeRanura } from "./gallery-layout";

const foto = (url = "f.jpg") => ({ url, tipo: "foto" as const });
const video = (url = "v.mp4") => ({ url, tipo: "video" as const });

/**
 * Book de pruebas: las estructurales vacías con las escenas pedidas en medio.
 * Se apoya en `ESCENAS_FIJAS` y no en índices para que añadir una cuarta escena
 * fija no obligue a renumerar medio archivo de pruebas.
 */
function book(...contenido: EscenaBook[]): Book {
  const b = bookNuevo((i) => `f${i}`);
  return {
    ...b,
    escenas: [...b.escenas.slice(0, -1), ...contenido, b.escenas.at(-1)!],
  };
}

/** La escena de ese tipo, para no depender de en qué posición cayó. */
const escenaDe = (b: Book, tipo: EscenaBook["tipo"]) =>
  b.escenas.find((e) => e.tipo === tipo)!;

/** Deja TODAS las estructurales completas: es el arranque obligatorio. */
function conArranque(...contenido: EscenaBook[]): Book {
  const b = book(...contenido);
  for (const tipo of ESCENAS_FIJAS) {
    const e = escenaDe(b, tipo);
    e.piezas = Array.from({ length: escenaDef(tipo)!.min }, (_, i) =>
      foto(`${tipo}${i}.jpg`),
    );
  }
  return b;
}

describe("catálogo de escenas", () => {
  it("no hay tipos repetidos", () => {
    const tipos = ESCENAS.map((e) => e.tipo);
    expect(new Set(tipos).size).toBe(tipos.length);
  });

  it("min nunca pasa a max, y los vídeos caben en las ranuras", () => {
    for (const e of ESCENAS) {
      expect(e.min).toBeLessThanOrEqual(e.max);
      expect(e.maxVideos).toBeLessThanOrEqual(e.max);
    }
  });

  it("toda escena de contenido pide al menos una pieza", () => {
    // Una escena que se pinta sin piezas es un hueco en blanco a media pantalla.
    for (const e of ESCENAS.filter((x) => !x.fija)) {
      expect(e.min).toBeGreaterThanOrEqual(1);
    }
  });

  it("hay exactamente una escena primera y una última, y son portada y cierre", () => {
    expect(ESCENAS.filter((e) => e.fija === "primera").map((e) => e.tipo)).toEqual(
      ["portada"],
    );
    expect(ESCENAS.filter((e) => e.fija === "ultima").map((e) => e.tipo)).toEqual([
      "cierre",
    ]);
  });

  it("ni las estructurales ni las retiradas se ofrecen para añadir", () => {
    expect(escenasElegibles().some((e) => e.fija)).toBe(false);
    expect(escenasElegibles().some((e) => e.retirada)).toBe(false);
    const fuera = ESCENAS.filter((e) => e.fija || e.retirada).length;
    expect(escenasElegibles().length).toBe(ESCENAS.length - fuera);
  });

  it("una escena RETIRADA se sigue pudiendo pintar", () => {
    // Retirar no es borrar: los ids viven en Firestore y un book que ya usa
    // `rejilla` tiene que seguir viéndose, y su dueña poder quitarla.
    expect(escenaDef("rejilla")).toBeDefined();
    expect(escenaDef("rejilla")!.retirada).toBe(true);
  });

  it("toda escena declara su medida, y `sangre` está bajo control", () => {
    // Es el motivo por el que existe todo el sistema de respiración: el book se
    // sintió abrumador porque tres escenas ocupaban la pantalla entera.
    //
    // La regla NO es "solo la portada" ni "solo las estructurales" — las dos se
    // probaron y las dos se quedaron cortas. `sangre` significa "sin margen de
    // página", y eso es un pantallazo SOLO si además ocupa toda la pantalla de
    // alto. El metraje y el retrato van pegados a un borde con el texto al otro
    // lado y el alto capado; la apertura es la única a pantalla completa.
    //
    // Lo que de verdad hay que garantizar —que ninguna de ellas se coma la
    // pantalla— es una cuenta de CSS, y ahí está su prueba: ver
    // `book-css.test.ts`, "toda escena a sangre que no sea la apertura capa su
    // alto". Aquí solo se fija la LISTA, para que ampliarla sea una decisión y
    // no un descuido.
    for (const e of ESCENAS) expect(MEDIDAS).toContain(e.medida);
    expect(ESCENAS.filter((e) => e.medida === "sangre").map((e) => e.tipo)).toEqual([
      "portada",
      "metraje",
      "retrato",
    ]);
  });

  it("todo preset declara los CINCO ejes", () => {
    // Un preset al que le falte un eje deja ese eje como estaba al pulsarlo: la
    // modelo elige "Editorial" y se queda con el desintegrado de antes, sin que
    // nada lo explique. Es el fallo típico al añadir un eje nuevo.
    for (const p of ATMOSFERAS) {
      expect(FONDOS, p.id).toContain(p.fondo);
      expect(LETRAS, p.id).toContain(p.letra);
      expect(RITMOS, p.id).toContain(p.ritmo);
      expect(TEXTURAS, p.id).toContain(p.textura);
      expect(DESINTEGRADOS, p.id).toContain(p.desintegrado);
    }
  });

  it("un book guardado ANTES de que existiera el desintegrado sigue abriendo", () => {
    // El eje se añadió con books ya en Firestore. Sin caída al de casa, esos
    // documentos abrirían con la portada sin desintegrar y sin un solo error.
    const viejo = normalizarAtmosfera({
      fondo: "hueso",
      letra: "serif",
      ritmo: "sereno",
      textura: "ninguna",
    });
    expect(viejo.desintegrado).toBe(ATMOSFERA_POR_DEFECTO.desintegrado);
    // Y un id RETIRADO cae igual, en vez de dejar la portada muda. `remolino`
    // existió y se quitó: quien lo tuviera elegido abre con el de casa, que es
    // preferible a una portada que no se desintegra y nadie sabe por qué.
    expect(DESINTEGRADOS).not.toContain("remolino");
    expect(
      normalizarAtmosfera({ desintegrado: "remolino" }).desintegrado,
    ).toBe(ATMOSFERA_POR_DEFECTO.desintegrado);
  });

  it("`sangre` no es elegible por la modelo", () => {
    expect(MEDIDAS_ELEGIBLES).not.toContain("sangre");
  });

  it("las cuentas declaradas caben en el rango de la escena y van en orden", () => {
    // `cuentas` no sustituye a `min`/`max`, los AFINA: el editor sigue pintando
    // `max` huecos y sigue impidiendo pasar de ahí. Una cuenta fuera del rango
    // sería una escena imposible de completar y el botón de publicar apagado
    // para siempre, sin nada que explique por qué.
    for (const e of ESCENAS) {
      if (!e.cuentas) continue;
      expect(e.cuentas.length, `"${e.tipo}" declara cuentas vacías`).toBeGreaterThan(0);
      expect(Math.min(...e.cuentas)).toBe(e.min);
      expect(Math.max(...e.cuentas)).toBe(e.max);
      expect([...e.cuentas].sort((a, b) => a - b)).toEqual(e.cuentas);
    }
  });

  it("el pliego son DOS O CUATRO fotos, nunca tres", () => {
    const def = escenaDef("pliego")!;
    expect(cuentasValidas(def)).toEqual([2, 4]);
    const con = (n: number): EscenaBook => ({
      id: "p",
      tipo: "pliego",
      piezas: Array.from({ length: n }, (_, i) => foto(`p${i}.jpg`)),
    });
    expect(escenaCompleta(con(2))).toBe(true);
    expect(escenaCompleta(con(3))).toBe(false);
    expect(escenaCompleta(con(4))).toBe(true);
  });

  it("piezasQueFaltan apunta a la siguiente cuenta válida, no al mínimo", () => {
    // La trampa: con tres fotos el pliego YA pasó del mínimo, así que restar
    // `min` da cero y el editor no avisaría de nada — pero con tres no se
    // publica. Es exactamente el hueco que esta función existe para tapar.
    const con = (n: number): EscenaBook => ({
      id: "p",
      tipo: "pliego",
      piezas: Array.from({ length: n }, (_, i) => foto(`p${i}.jpg`)),
    });
    expect(piezasQueFaltan(con(0))).toBe(2);
    expect(piezasQueFaltan(con(1))).toBe(1);
    expect(piezasQueFaltan(con(2))).toBe(0);
    expect(piezasQueFaltan(con(3))).toBe(1);
    expect(piezasQueFaltan(con(4))).toBe(0);
  });

  it("el sitio para escenas PROPIAS no encoge al crecer las estructurales", () => {
    // `normalizarBook` recorta el contenido a `BOOK_MAX_ESCENAS - fijas`. Si el
    // tope no acompaña al añadir una estructural, a quien tuviera el book lleno
    // se le caen escenas propias AL LEERLO — sin avisar, sin haberlas borrado y
    // sin que ningún test lo note. De ahí que la cuenta se compruebe aquí.
    expect(BOOK_MAX_ESCENAS - ESCENAS_FIJAS.length).toBeGreaterThanOrEqual(9);
  });

  it("el arranque obligatorio es apertura, vitrina, metraje y pliego", () => {
    // El orden ES la secuencia que pidió el usuario. Se deriva del catálogo, así
    // que esta prueba comprueba que `fija` y `POSICION_FIJA` siguen contando lo
    // mismo que el brief — un `fija` mal puesto no da error, solo mueve la
    // escena de sitio.
    expect(ESCENAS_FIJAS).toEqual([
      "portada",
      "vitrina",
      "metraje",
      "pliego",
      "cierre",
    ]);
  });

  it("un book lleno de la escena más pequeña no revienta el tope de piezas", () => {
    // Si esto falla, el tope por escena y el global se contradicen y la modelo
    // se queda bloqueada sin entender por qué.
    const minima = Math.min(...escenasElegibles().map((e) => e.min));
    expect(minima * (BOOK_MAX_ESCENAS - 2)).toBeLessThanOrEqual(BOOK_MAX_PIEZAS);
  });

  it("esEscenaTipo acepta el catálogo y rechaza el resto", () => {
    expect(esEscenaTipo("tira")).toBe(true);
    expect(esEscenaTipo("carrusel")).toBe(false);
    expect(esEscenaTipo(undefined)).toBe(false);
  });
});

describe("escenaCompleta", () => {
  it("exige estar dentro del rango de su composición", () => {
    const def = escenaDef("rejilla")!;
    const conNFotos = (n: number): EscenaBook => ({
      id: "x",
      tipo: "rejilla",
      piezas: Array.from({ length: n }, (_, i) => foto(`${i}.jpg`)),
    });
    expect(escenaCompleta(conNFotos(def.min - 1))).toBe(false);
    expect(escenaCompleta(conNFotos(def.min))).toBe(true);
    expect(escenaCompleta(conNFotos(def.max))).toBe(true);
    expect(escenaCompleta(conNFotos(def.max + 1))).toBe(false);
  });

  it("un tipo inventado nunca está completo", () => {
    expect(
      escenaCompleta({ id: "x", tipo: "noexiste" as never, piezas: [] }),
    ).toBe(false);
  });
});

describe("cupos", () => {
  it("no admite más piezas de las que tiene la composición", () => {
    const b = book({ id: "d", tipo: "diptico", piezas: [foto("1"), foto("2")] });
    expect(puedeAnadirPieza(b, escenaDe(b, "diptico"))).toBe(false);
  });

  it("respeta el tope de vídeos aunque queden ranuras libres", () => {
    const e: EscenaBook = { id: "t", tipo: "tira", piezas: [video(), video()] };
    const b = book(e);
    expect(escenaDef("tira")!.maxVideos).toBe(2);
    expect(puedeAnadirPieza(b, e, "video")).toBe(false);
    expect(puedeAnadirPieza(b, e, "foto")).toBe(true); // quedan ranuras
  });

  it("el tope global del book manda sobre el de la escena", () => {
    const llena: EscenaBook = {
      id: "t",
      tipo: "tira",
      piezas: Array.from({ length: 3 }, (_, i) => foto(`${i}`)),
    };
    const b = book(
      ...Array.from({ length: 10 }, (_, i) => ({ ...llena, id: `t${i}` })),
    );
    expect(contarPiezas(b)).toBeGreaterThanOrEqual(BOOK_MAX_PIEZAS);
    expect(puedeAnadirPieza(b, escenaDe(b, "tira"))).toBe(false);
  });

  it("puedeAnadirEscena se cierra al llegar al tope", () => {
    const b = bookNuevo((i) => `f${i}`);
    expect(puedeAnadirEscena(b)).toBe(true);
    const lleno: Book = {
      ...b,
      escenas: Array.from({ length: BOOK_MAX_ESCENAS }, (_, i) => ({
        id: `e${i}`,
        tipo: "plena" as const,
        piezas: [],
      })),
    };
    expect(puedeAnadirEscena(lleno)).toBe(false);
  });
});

describe("bookPublicable", () => {
  const diptico = (): EscenaBook => ({
    id: "d",
    tipo: "diptico",
    piezas: [foto("1"), foto("2")],
  });

  it("un book recién creado no se publica", () => {
    expect(bookPublicable(bookNuevo((i) => `f${i}`))).toBe(false);
  });

  it.each(ESCENAS_FIJAS.filter((t) => escenaDef(t)!.min > 0))(
    "la estructural %s a medias bloquea la publicación",
    (tipo) => {
      // El arranque lo comparten todos los books y a medias se rompe: el nombre
      // se dispersa y detrás no sube nada, o el carrusel se queda con un hueco.
      const b = conArranque(diptico());
      escenaDe(b, tipo).piezas.pop();
      expect(escenaCompleta(escenaDe(b, tipo))).toBe(false);
      expect(bookPublicable(b)).toBe(false);
    },
  );

  it("el arranque completo SOLO no basta: falta contenido propio", () => {
    // Un book que es solo el arranque no es un portafolio, es una presentación.
    expect(bookPublicable(conArranque())).toBe(false);
  });

  it("una escena de contenido INCOMPLETA tampoco", () => {
    const b = conArranque({ id: "d", tipo: "diptico", piezas: [foto()] });
    expect(bookPublicable(b)).toBe(false);
  });

  it("arranque completo + una escena completa sí", () => {
    expect(bookPublicable(conArranque(diptico()))).toBe(true);
  });
});

describe("la apertura es una secuencia cerrada", () => {
  const def = escenaDef("portada")!;

  it("pide exactamente las fotos que tienen papel asignado", () => {
    // Si alguien sube el máximo sin dar papel a la ranura nueva, el editor la
    // pintaría como un hueco mudo y la coreografía no la tocaría.
    expect(def.min).toBe(ROLES_APERTURA.length);
    expect(def.max).toBe(ROLES_APERTURA.length);
  });

  it("los papeles son: la que abre, dos que suben y la de portada", () => {
    expect(ROLES_APERTURA).toEqual(["abre", "sube", "sube", "portada"]);
    expect(rolDePiezaApertura(0)).toBe("abre");
    expect(rolDePiezaApertura(3)).toBe("portada");
    expect(rolDePiezaApertura(9)).toBeUndefined();
  });

  it("solo la foto DE PORTADA lleva texto", () => {
    expect(esFotoDePortada("portada", 3)).toBe(true);
    for (const i of [0, 1, 2]) {
      expect(esFotoDePortada("portada", i), `la ranura ${i} no escribe`).toBe(
        false,
      );
    }
    // El papel es cosa de la apertura: en otra escena no significa nada.
    expect(esFotoDePortada("diptico", 3)).toBe(false);
  });

  it("no admite vídeo", () => {
    // Una se desenfoca hasta cero, dos viajan con parallax y la última se parte
    // en cientos de teselas: clips decodificando ahí es el peor gasto posible.
    expect(def.maxVideos).toBe(0);
    expect(def.maxNotas).toBe(0);
  });

  it("es la primera y no se puede quitar ni mover", () => {
    expect(def.fija).toBe("primera");
    expect(escenasElegibles().some((e) => e.tipo === "portada")).toBe(false);
  });

  it("es la única escena a sangre", () => {
    expect(def.medida).toBe("sangre");
  });
});

describe("moverEscena", () => {
  const b = book(
    { id: "a", tipo: "plena", piezas: [] },
    { id: "b", tipo: "retrato", piezas: [] },
  );
  // Las de contenido van justo detrás de las estructurales de cabecera.
  const iA = b.escenas.findIndex((e) => e.id === "a");
  const iB = iA + 1;

  it("intercambia dos escenas de contenido", () => {
    const r = moverEscena(b, iA, iB);
    expect(r.escenas[iA].id).toBe("b");
    expect(r.escenas[iB].id).toBe("a");
  });

  it("no muta el original", () => {
    moverEscena(b, iA, iB);
    expect(b.escenas[iA].id).toBe("a");
    expect(b.escenas[iB].id).toBe("b");
  });

  it("NINGUNA estructural se mueve", () => {
    // Ni entre ellas ni arrastrada por una de contenido: son el arranque.
    for (let i = 0; i < b.escenas.length; i++) {
      if (!escenaDef(b.escenas[i].tipo)?.fija) continue;
      expect(moverEscena(b, i, iA), `la fija ${i} se movió`).toBe(b);
      expect(moverEscena(b, iA, i), `algo empujó a la fija ${i}`).toBe(b);
    }
  });

  it("índices fuera de rango: devuelve lo mismo", () => {
    expect(moverEscena(b, iA, 99)).toBe(b);
    expect(moverEscena(b, -1, iA)).toBe(b);
  });
});

describe("resumen y portada", () => {
  it("el resumen no cuenta portada ni cierre como escenas", () => {
    const b = book({ id: "d", tipo: "diptico", piezas: [foto("1"), foto("2")] });
    b.escenas[0].piezas = [foto("portada.jpg")];
    expect(resumenBook(b)).toEqual({ escenas: 1, piezas: 3 });
    expect(escenasDeContenido(b).map((e) => e.id)).toEqual(["d"]);
  });

  it("si la portada es un vídeo, la miniatura es su póster", () => {
    const b = bookNuevo((i) => `f${i}`);
    b.escenas[0].piezas = [{ ...video(), poster: "frame.jpg" }];
    expect(portadaDelBook(b)).toBe("frame.jpg");
  });

  it("vídeo sin póster cae a la propia url antes que a nada", () => {
    const b = bookNuevo((i) => `f${i}`);
    b.escenas[0].piezas = [video("clip.mp4")];
    expect(portadaDelBook(b)).toBe("clip.mp4");
  });

  it("sin portada, no hay miniatura", () => {
    expect(portadaDelBook(bookNuevo((i) => `f${i}`))).toBeUndefined();
  });
});

describe("atmósfera", () => {
  it("los presets usan solo valores del catálogo", () => {
    for (const a of ATMOSFERAS) {
      expect(FONDOS).toContain(a.fondo);
      expect(LETRAS).toContain(a.letra);
      expect(RITMOS).toContain(a.ritmo);
      expect(TEXTURAS).toContain(a.textura);
    }
    const ids = ATMOSFERAS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("un eje desconocido cae a su valor por defecto", () => {
    expect(normalizarAtmosfera({ fondo: "neon", letra: "comic" })).toEqual({
      ...ATMOSFERA_POR_DEFECTO,
      acento: undefined,
    });
  });


});

describe("normalizarBook", () => {
  it("de la nada sale un book con estructura", () => {
    const b = normalizarBook(undefined);
    expect(b.escenas.map((e) => e.tipo)).toEqual(ESCENAS_FIJAS);
    expect(b.publicado).toBe(false);
    expect(b.atmosfera).toEqual({
      ...ATMOSFERA_POR_DEFECTO,
      acento: undefined,
    });
  });

  it("la portada acaba primera y el cierre último, vengan como vengan", () => {
    const b = normalizarBook({
      escenas: [
        { id: "c", tipo: "cierre", piezas: [] },
        { id: "x", tipo: "plena", piezas: [{ url: "a.jpg" }] },
        { id: "p", tipo: "portada", piezas: [{ url: "b.jpg" }] },
      ],
    });
    expect(b.escenas.map((e) => e.tipo)).toEqual([
      ...ESCENAS_FIJAS.slice(0, -1),
      "plena",
      ...ESCENAS_FIJAS.slice(-1),
    ]);
  });

  it("descarta escenas y piezas basura sin tirar el resto", () => {
    const b = normalizarBook({
      escenas: [
        { id: "z", tipo: "collage", piezas: [{ url: "a.jpg" }] },
        { id: "x", tipo: "plena", piezas: [{ url: "" }, null, { url: "ok.jpg" }] },
      ],
    });
    expect(b.escenas.map((e) => e.tipo)).toEqual([
      ...ESCENAS_FIJAS.slice(0, -1),
      "plena",
      ...ESCENAS_FIJAS.slice(-1),
    ]);
    expect(escenaDe(b, "plena").piezas).toHaveLength(1);
    expect(escenaDe(b, "plena").piezas[0].url).toBe("ok.jpg");
  });

  it("recorta las piezas que no caben en la composición", () => {
    const b = normalizarBook({
      escenas: [
        {
          id: "d",
          tipo: "diptico",
          piezas: Array.from({ length: 5 }, (_, i) => ({ url: `${i}.jpg` })),
        },
      ],
    });
    expect(escenaDe(b, "diptico").piezas).toHaveLength(escenaDef("diptico")!.max);
  });

  it("recorta los textos largos en vez de rechazarlos", () => {
    const b = normalizarBook({
      escenas: [
        {
          id: "x",
          tipo: "plena",
          piezas: [{ url: "a.jpg", titulo: "t".repeat(500), nota: "n".repeat(999) }],
        },
      ],
    });
    const pz = escenaDe(b, "plena").piezas[0];
    expect(pz.titulo).toHaveLength(BOOK_TITULO_MAX);
    expect(pz.nota).toHaveLength(BOOK_NOTA_MAX);
  });

  it("las notas sueltas solo sobreviven donde la escena las admite", () => {
    const notas = [{ titulo: "2024", texto: "Campaña" }];
    const conAncla = normalizarBook({
      escenas: [{ id: "a", tipo: "ancla", piezas: [{ url: "a.jpg" }], notas }],
    });
    expect(escenaDe(conAncla, "ancla").notas).toHaveLength(1);

    const conPlena = normalizarBook({
      escenas: [{ id: "x", tipo: "plena", piezas: [{ url: "a.jpg" }], notas }],
    });
    expect(escenaDe(conPlena, "plena").notas).toBeUndefined();
  });

  it("un book publicado que se quedó sin contenido se despublica solo", () => {
    const b = normalizarBook({
      publicado: true,
      escenas: [{ id: "p", tipo: "portada", piezas: [{ url: "a.jpg" }] }],
    });
    expect(bookPublicable(b)).toBe(false);
    expect(b.publicado).toBe(false);
  });

  it("un book publicado y completo se queda publicado", () => {
    const b = normalizarBook({
      publicado: true,
      // TODAS las estructurales completas (apertura de cuatro, vitrina de tres)
      // más una escena propia: es el mínimo para que un book sea publicable.
      escenas: [
        ...ESCENAS_FIJAS.map((tipo) => ({
          id: tipo,
          tipo,
          piezas: Array.from({ length: escenaDef(tipo)!.min }, (_, i) => ({
            url: `${tipo}${i}.jpg`,
          })),
        })),
        { id: "d", tipo: "diptico", piezas: [{ url: "1.jpg" }, { url: "2.jpg" }] },
      ],
    });
    expect(b.publicado).toBe(true);
  });

  it("no admite más escenas que el tope", () => {
    const b = normalizarBook({
      escenas: Array.from({ length: 40 }, (_, i) => ({
        id: `e${i}`,
        tipo: "plena",
        piezas: [{ url: `${i}.jpg` }],
      })),
    });
    expect(b.escenas.length).toBeLessThanOrEqual(BOOK_MAX_ESCENAS);
  });

  it("los metadatos de esquina solo sobreviven donde la escena los admite", () => {
    const meta = { arribaInicio: "AÑO · 2025", abajoFin: "BOGOTÁ" };
    const conPortada = normalizarBook({
      escenas: [{ id: "p", tipo: "portada", piezas: [{ url: "a.jpg" }], meta }],
    });
    expect(escenaDe(conPortada, "portada").meta).toEqual(meta);

    // `diptico` no declara `admiteMeta`: guardarlos ahí sería un dato muerto.
    const conDiptico = normalizarBook({
      escenas: [
        { id: "d", tipo: "diptico", piezas: [{ url: "1" }, { url: "2" }], meta },
      ],
    });
    expect(escenaDe(conDiptico, "diptico").meta).toBeUndefined();
  });

  it("recorta los textos de esquina largos", () => {
    const b = normalizarBook({
      escenas: [
        { id: "p", tipo: "portada", piezas: [], meta: { arribaFin: "x".repeat(99) } },
      ],
    });
    expect(escenaDe(b, "portada").meta!.arribaFin).toHaveLength(BOOK_META_MAX);
  });

  it("la medida elegida solo se guarda si el tipo la admite", () => {
    // La portada es a sangre por definición: dejarla con una medida guardada
    // confundiría al siguiente que lea el documento.
    const b = normalizarBook({
      escenas: [
        { id: "p", tipo: "portada", piezas: [], medida: "contenida" },
        { id: "d", tipo: "diptico", piezas: [{ url: "1" }, { url: "2" }], medida: "contenida" },
        { id: "x", tipo: "plena", piezas: [{ url: "3" }], medida: "sangre" },
      ],
    });
    expect(escenaDe(b, "portada").medida).toBeUndefined(); // no elegible
    expect(escenaDe(b, "diptico").medida).toBe("contenida"); // válida
    expect(escenaDe(b, "plena").medida).toBeUndefined(); // "sangre" no lo es
  });

  it("las redes solo se guardan en el cierre y sin repetir", () => {
    const b = normalizarBook({
      escenas: [
        { id: "x", tipo: "plena", piezas: [{ url: "a" }], redes: ["instagram"] },
        { id: "c", tipo: "cierre", piezas: [], redes: ["instagram", "instagram", "nomeinvento"] },
      ],
    });
    expect(escenaDe(b, "plena").redes).toBeUndefined(); // plena no lleva redes
    expect(escenaDe(b, "cierre").redes).toEqual(["instagram"]);
  });
});

describe("medidaDeEscena", () => {
  it("la portada es a sangre y no hay forma de negociarlo", () => {
    expect(
      medidaDeEscena({ id: "p", tipo: "portada", piezas: [], medida: "contenida" }),
    ).toBe("sangre");
  });

  it("la elección de la modelo manda sobre la del catálogo", () => {
    const d = escenaDef("diptico")!;
    expect(medidaDeEscena({ id: "d", tipo: "diptico", piezas: [] })).toBe(d.medida);
    expect(
      medidaDeEscena({ id: "d", tipo: "diptico", piezas: [], medida: "contenida" }),
    ).toBe("contenida");
  });

  it("un tipo desconocido no revienta", () => {
    expect(medidaDeEscena({ id: "x", tipo: "loquesea" as never, piezas: [] })).toBe(
      "contenida",
    );
  });
});

describe("book guiado", () => {
  it("nace con una secuencia montada, no con un lienzo en blanco", () => {
    // Es la petición literal: que el editor GUÍE. Dos escenas vacías no guían.
    const b = bookGuiado((i) => `e${i}`);
    expect(b.escenas.map((e) => e.tipo)).toEqual(BOOK_ESCENAS_POR_DEFECTO);
    expect(b.escenas.length).toBeGreaterThan(2);
  });

  it("la secuencia abre con portada, cierra con cierre y cabe en el tope", () => {
    expect(BOOK_ESCENAS_POR_DEFECTO[0]).toBe("portada");
    expect(BOOK_ESCENAS_POR_DEFECTO.at(-1)).toBe("cierre");
    expect(BOOK_ESCENAS_POR_DEFECTO.length).toBeLessThanOrEqual(BOOK_MAX_ESCENAS);
  });

  it("no propone ninguna escena retirada", () => {
    for (const tipo of BOOK_ESCENAS_POR_DEFECTO) {
      expect(escenaDef(tipo)?.retirada).toBeFalsy();
    }
  });

  it("nace sin ids repetidos", () => {
    const ids = bookGuiado((i) => `e${i}`).escenas.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("anadirEscena", () => {
  const b = bookGuiado((i) => `e${i}`);

  it("coloca la nueva SIEMPRE al final, justo antes del cierre", () => {
    const r = anadirEscena(b, "tira", "nueva");
    expect(r.escenas.at(-1)!.tipo).toBe("cierre");
    expect(r.escenas.at(-2)!.id).toBe("nueva");
  });

  it("no deja añadir estructurales ni retiradas", () => {
    expect(anadirEscena(b, "portada", "x")).toBe(b);
    expect(anadirEscena(b, "cierre", "x")).toBe(b);
    expect(anadirEscena(b, "rejilla", "x")).toBe(b);
  });

  it("respeta el tope de escenas", () => {
    const lleno: Book = {
      ...b,
      escenas: Array.from({ length: BOOK_MAX_ESCENAS }, (_, i) => ({
        id: `x${i}`,
        tipo: "plena" as const,
        piezas: [],
      })),
    };
    expect(anadirEscena(lleno, "tira", "x")).toBe(lleno);
  });
});

describe("vitrina — el reparto de ranuras", () => {
  it("hay un sitio por ranura, ni más ni menos", () => {
    // Tres cartas y tres sitios. Si el catálogo admitiera una cuarta foto,
    // `sitioDeRanura` devolvería undefined y esa carta se quedaría sin sitio —
    // apilada en el centro encima de la del frente.
    const def = escenaDef("vitrina")!;
    expect(def.min).toBe(SITIOS_VITRINA.length);
    expect(def.max).toBe(SITIOS_VITRINA.length);
    expect(sitioDeRanura(0)).toBe("frente");
    expect(sitioDeRanura(def.max - 1)).toBeDefined();
    expect(sitioDeRanura(def.max)).toBeUndefined();
  });

  it("arranca con cada pieza en su ranura", () => {
    expect(ranurasDeVitrina(4)).toEqual([0, 1, 2, 3]);
  });

  it("traer al frente INTERCAMBIA, no desplaza", () => {
    // Si esto fuera un desplazamiento, tocar la última reordenaría la columna
    // entera y el ojo perdería de vista dónde estaba cada foto.
    expect(traerAlFrente([0, 1, 2, 3], 2)).toEqual([2, 1, 0, 3]);
  });

  it("la que ya está delante no provoca cambio de estado", () => {
    const r = [2, 1, 0];
    // Misma referencia: React descarta el render y no se anima nada de cero px.
    expect(traerAlFrente(r, 2)).toBe(r);
  });

  it("una pieza que no está en el reparto se ignora", () => {
    const r = [0, 1, 2];
    expect(traerAlFrente(r, 9)).toBe(r);
  });

  it("dos toques dejan el reparto donde estaba", () => {
    const r = ranurasDeVitrina(3);
    expect(traerAlFrente(traerAlFrente(r, 2), 0)).toEqual(r);
  });

  it("toda escena cabe en las áreas que la rejilla sabe nombrar", () => {
    // `areaDeRanura` solo llega hasta `f`: una escena con más ranuras que áreas
    // colocaría piezas en `gridArea: ""`, o sea en pistas implícitas.
    // El cierre se salta la comprobación porque no tiene piezas: es un telón con
    // el nombre encima, y `max - 1` ahí es una ranura que no existe.
    for (const def of ESCENAS) {
      if (def.max === 0) continue;
      expect(areaDeRanura(def.max - 1), `${def.tipo} se sale de las áreas`).not.toBe(
        "",
      );
    }
  });
});

describe("numeroDeFicha", () => {
  it("numera desde 001 y con tres dígitos", () => {
    expect(numeroDeFicha(0)).toBe("001");
    expect(numeroDeFicha(11)).toBe("012");
  });
});

describe("redesDelCierre", () => {
  const cierre: EscenaBook = { id: "c", tipo: "cierre", piezas: [] };

  it("sin elección, enseña TODAS las que el perfil tenga", () => {
    const r = redesDelCierre(cierre, { instagram: "i", tiktok: "t" });
    expect(r.map((x) => x.red).sort()).toEqual(["instagram", "tiktok"]);
  });

  it("descarta las elegidas que el perfil ya no tiene", () => {
    // El cruce no es cosmético: sin él se pintaría un icono que no lleva a
    // ninguna parte el día que borre esa URL de su perfil.
    const r = redesDelCierre(
      { ...cierre, redes: ["instagram", "tiktok"] },
      { instagram: "i" },
    );
    expect(r).toEqual([{ red: "instagram", url: "i" }]);
  });

  it("un perfil sin redes no pinta nada", () => {
    expect(redesDelCierre(cierre, {})).toEqual([]);
  });
});

describe("META_ESQUINAS", () => {
  it("son cuatro, sin repetir, y en orden de lectura", () => {
    expect(META_ESQUINAS).toHaveLength(4);
    expect(new Set(META_ESQUINAS).size).toBe(4);
    expect(META_ESQUINAS[0]).toBe("arribaInicio");
    expect(META_ESQUINAS.at(-1)).toBe("abajoFin");
  });
});
