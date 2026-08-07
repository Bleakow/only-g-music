import { describe, it, expect } from "vitest";
import {
  ATMOSFERAS,
  ATMOSFERA_POR_DEFECTO,
  BOOK_ESCENAS_POR_DEFECTO,
  BOOK_MAX_ESCENAS,
  BOOK_MAX_PIEZAS,
  BOOK_META_MAX,
  BOOK_NOTA_MAX,
  BOOK_TITULO_MAX,
  ESCENAS,
  FONDOS,
  LETRAS,
  MEDIDAS,
  MEDIDAS_ELEGIBLES,
  META_ESQUINAS,
  RITMOS,
  TEXTURAS,
  acentoEfectivo,
  anadirEscena,
  bookGuiado,
  bookNuevo,
  bookPublicable,
  contarPiezas,
  escenaCompleta,
  escenaDef,
  escenasDeContenido,
  escenasElegibles,
  esEscenaTipo,
  medidaDeEscena,
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

/** Book de pruebas: portada + las escenas que se pidan + cierre. */
function book(...contenido: EscenaBook[]): Book {
  const b = bookNuevo("p", "c");
  return { ...b, escenas: [b.escenas[0], ...contenido, b.escenas[1]] };
}

const foto = (url = "f.jpg") => ({ url, tipo: "foto" as const });
const video = (url = "v.mp4") => ({ url, tipo: "video" as const });

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

  it("toda escena declara su medida, y SOLO la portada va a sangre", () => {
    // Es el motivo por el que existe todo el sistema de respiración: el book se
    // sintió abrumador porque tres escenas ocupaban la pantalla entera. Si
    // mañana alguien pone otra a sangre, que lo diga esta prueba y no el usuario.
    for (const e of ESCENAS) expect(MEDIDAS).toContain(e.medida);
    expect(ESCENAS.filter((e) => e.medida === "sangre").map((e) => e.tipo)).toEqual(
      ["portada"],
    );
  });

  it("`sangre` no es elegible por la modelo", () => {
    expect(MEDIDAS_ELEGIBLES).not.toContain("sangre");
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
    expect(puedeAnadirPieza(b, b.escenas[1])).toBe(false);
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
    expect(puedeAnadirPieza(b, b.escenas[1])).toBe(false);
  });

  it("puedeAnadirEscena se cierra al llegar al tope", () => {
    const b = bookNuevo("p", "c");
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
  /** Las TRES fotos de la apertura: la que abre y las dos que suben. */
  const apertura = () => [foto("ap1.jpg"), foto("ap2.jpg"), foto("ap3.jpg")];

  it("un book recién creado no se publica", () => {
    expect(bookPublicable(bookNuevo("p", "c"))).toBe(false);
  });

  it("una apertura A MEDIAS no habilita la publicación", () => {
    // Con una o dos de sus tres fotos, la secuencia se rompe: el nombre se
    // dispersa y detrás no sube nada. Peor que no tener book.
    const b = book({ id: "d", tipo: "diptico", piezas: [foto("1"), foto("2")] });
    b.escenas[0].piezas = [foto("ap1.jpg"), foto("ap2.jpg")];
    expect(escenaCompleta(b.escenas[0])).toBe(false);
    expect(bookPublicable(b)).toBe(false);
  });

  it("apertura completa sola tampoco: sería una apertura y un cierre", () => {
    const b = bookNuevo("p", "c");
    b.escenas[0].piezas = apertura();
    expect(bookPublicable(b)).toBe(false);
  });

  it("una escena de contenido INCOMPLETA no habilita la publicación", () => {
    const b = book({ id: "d", tipo: "diptico", piezas: [foto()] }); // pide 2
    b.escenas[0].piezas = apertura();
    expect(bookPublicable(b)).toBe(false);
  });

  it("apertura completa + una escena completa sí", () => {
    const b = book({ id: "d", tipo: "diptico", piezas: [foto("1"), foto("2")] });
    b.escenas[0].piezas = apertura();
    expect(bookPublicable(b)).toBe(true);
  });
});

describe("la apertura es una secuencia cerrada", () => {
  const def = escenaDef("portada")!;

  it("pide exactamente tres fotos, ni una más ni una menos", () => {
    // Las tres son obligatorias: la que abre y las dos que suben en diagonal.
    expect(def.min).toBe(3);
    expect(def.max).toBe(3);
  });

  it("no admite vídeo ni texto por pieza", () => {
    // La primera se desenfoca hasta cero y las otras dos viajan con parallax:
    // tres clips decodificando en la primera pantalla es el peor gasto posible.
    expect(def.maxVideos).toBe(0);
    expect(def.admiteTextoPorPieza).toBe(false);
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

  it("intercambia dos escenas de contenido", () => {
    expect(moverEscena(b, 1, 2).escenas.map((e) => e.id)).toEqual([
      "p",
      "b",
      "a",
      "c",
    ]);
  });

  it("no muta el original", () => {
    moverEscena(b, 1, 2);
    expect(b.escenas.map((e) => e.id)).toEqual(["p", "a", "b", "c"]);
  });

  it("la portada y el cierre no se mueven", () => {
    expect(moverEscena(b, 0, 1)).toBe(b);
    expect(moverEscena(b, 2, 3)).toBe(b);
  });

  it("índices fuera de rango: devuelve lo mismo", () => {
    expect(moverEscena(b, 1, 9)).toBe(b);
    expect(moverEscena(b, -1, 1)).toBe(b);
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
    const b = bookNuevo("p", "c");
    b.escenas[0].piezas = [{ ...video(), poster: "frame.jpg" }];
    expect(portadaDelBook(b)).toBe("frame.jpg");
  });

  it("vídeo sin póster cae a la propia url antes que a nada", () => {
    const b = bookNuevo("p", "c");
    b.escenas[0].piezas = [video("clip.mp4")];
    expect(portadaDelBook(b)).toBe("clip.mp4");
  });

  it("sin portada, no hay miniatura", () => {
    expect(portadaDelBook(bookNuevo("p", "c"))).toBeUndefined();
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

  it("solo acepta acentos en hex de 6 dígitos", () => {
    expect(normalizarAtmosfera({ acento: "#a87bff" }).acento).toBe("#a87bff");
    expect(normalizarAtmosfera({ acento: "rojo" }).acento).toBeUndefined();
    expect(normalizarAtmosfera({ acento: "#fff" }).acento).toBeUndefined();
  });

  it("sin acento propio, hereda el del perfil", () => {
    expect(acentoEfectivo(ATMOSFERA_POR_DEFECTO, "#8b5cf6")).toBe("#8b5cf6");
    expect(
      acentoEfectivo({ ...ATMOSFERA_POR_DEFECTO, acento: "#ff0000" }, "#8b5cf6"),
    ).toBe("#ff0000");
  });
});

describe("normalizarBook", () => {
  it("de la nada sale un book con estructura", () => {
    const b = normalizarBook(undefined);
    expect(b.escenas.map((e) => e.tipo)).toEqual(["portada", "cierre"]);
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
    expect(b.escenas.map((e) => e.tipo)).toEqual(["portada", "plena", "cierre"]);
  });

  it("descarta escenas y piezas basura sin tirar el resto", () => {
    const b = normalizarBook({
      escenas: [
        { id: "z", tipo: "collage", piezas: [{ url: "a.jpg" }] },
        { id: "x", tipo: "plena", piezas: [{ url: "" }, null, { url: "ok.jpg" }] },
      ],
    });
    expect(b.escenas.map((e) => e.tipo)).toEqual(["portada", "plena", "cierre"]);
    expect(b.escenas[1].piezas).toHaveLength(1);
    expect(b.escenas[1].piezas[0].url).toBe("ok.jpg");
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
    expect(b.escenas[1].piezas).toHaveLength(escenaDef("diptico")!.max);
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
    expect(b.escenas[1].piezas[0].titulo).toHaveLength(BOOK_TITULO_MAX);
    expect(b.escenas[1].piezas[0].nota).toHaveLength(BOOK_NOTA_MAX);
  });

  it("las notas sueltas solo sobreviven donde la escena las admite", () => {
    const notas = [{ titulo: "2024", texto: "Campaña" }];
    const conAncla = normalizarBook({
      escenas: [{ id: "a", tipo: "ancla", piezas: [{ url: "a.jpg" }], notas }],
    });
    expect(conAncla.escenas[1].notas).toHaveLength(1);

    const conPlena = normalizarBook({
      escenas: [{ id: "x", tipo: "plena", piezas: [{ url: "a.jpg" }], notas }],
    });
    expect(conPlena.escenas[1].notas).toBeUndefined();
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
      escenas: [
        // La apertura son TRES fotos: la que abre y las dos que suben.
        {
          id: "p",
          tipo: "portada",
          piezas: [{ url: "a.jpg" }, { url: "b.jpg" }, { url: "c.jpg" }],
        },
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
    expect(conPortada.escenas[0].meta).toEqual(meta);

    // `diptico` no declara `admiteMeta`: guardarlos ahí sería un dato muerto.
    const conDiptico = normalizarBook({
      escenas: [
        { id: "d", tipo: "diptico", piezas: [{ url: "1" }, { url: "2" }], meta },
      ],
    });
    expect(conDiptico.escenas[1].meta).toBeUndefined();
  });

  it("recorta los textos de esquina largos", () => {
    const b = normalizarBook({
      escenas: [
        { id: "p", tipo: "portada", piezas: [], meta: { arribaFin: "x".repeat(99) } },
      ],
    });
    expect(b.escenas[0].meta!.arribaFin).toHaveLength(BOOK_META_MAX);
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
    expect(b.escenas[0].medida).toBeUndefined(); // portada: no elegible
    expect(b.escenas[1].medida).toBe("contenida"); // válida
    expect(b.escenas[2].medida).toBeUndefined(); // "sangre" no es elegible
  });

  it("las redes solo se guardan en el cierre y sin repetir", () => {
    const b = normalizarBook({
      escenas: [
        { id: "x", tipo: "plena", piezas: [{ url: "a" }], redes: ["instagram"] },
        { id: "c", tipo: "cierre", piezas: [], redes: ["instagram", "instagram", "nomeinvento"] },
      ],
    });
    expect(b.escenas[1].redes).toBeUndefined(); // plena no lleva redes
    expect(b.escenas[2].redes).toEqual(["instagram"]);
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

  it("la vitrina cabe en las áreas que la rejilla sabe nombrar", () => {
    // `areaDeRanura` solo llega hasta `f`: una escena con más ranuras que áreas
    // colocaría piezas en `gridArea: ""`, o sea en pistas implícitas.
    for (const def of ESCENAS) {
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
