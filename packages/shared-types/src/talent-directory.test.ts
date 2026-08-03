import { describe, it, expect } from "vitest";
import type { Artist } from "./artist";
import {
  disciplinesOf,
  matchesMacro,
  matchesRole,
  matchesQuery,
  normalizeText,
} from "./talent-directory";

// Constructor mínimo: solo los campos que tocan los filtros.
function artist(p: Partial<Artist>): Artist {
  return {
    slug: "x",
    name: "",
    tagline: "",
    genre: "",
    bio: "",
    image: "",
    accent: "#000",
    socials: {},
    topTracks: [],
    ...p,
  };
}

describe("disciplinesOf", () => {
  it("trata la ausencia de disciplinas como cantante (artista)", () => {
    expect(disciplinesOf(artist({}))).toEqual(["artista"]);
    expect(disciplinesOf(artist({ disciplines: [] }))).toEqual(["artista"]);
  });
  it("respeta las disciplinas presentes", () => {
    expect(disciplinesOf(artist({ disciplines: ["dj", "modelo"] }))).toEqual([
      "dj",
      "modelo",
    ]);
  });
});

describe("matchesMacro", () => {
  it("'todos' siempre pasa", () => {
    expect(matchesMacro(artist({ disciplines: ["beatmaker"] }), "todos")).toBe(
      true,
    );
  });
  it("EN ESCENA = performers (cantante, dj, bailarín, presentador, modelo)", () => {
    for (const r of ["artista", "dj", "bailarin", "presentador", "modelo"] as const) {
      expect(matchesMacro(artist({ disciplines: [r] }), "escena")).toBe(true);
    }
    expect(matchesMacro(artist({ disciplines: ["beatmaker"] }), "escena")).toBe(
      false,
    );
  });
  it("PRODUCCIÓN = beatmakers y productores", () => {
    expect(
      matchesMacro(artist({ disciplines: ["beatmaker"] }), "produccion"),
    ).toBe(true);
    expect(
      matchesMacro(artist({ disciplines: ["productor"] }), "produccion"),
    ).toBe(true);
    expect(matchesMacro(artist({ disciplines: ["artista"] }), "produccion")).toBe(
      false,
    );
  });
  it("sin disciplinas cuenta como cantante → EN ESCENA", () => {
    expect(matchesMacro(artist({}), "escena")).toBe(true);
    expect(matchesMacro(artist({}), "produccion")).toBe(false);
  });
  it("un perfil con varias disciplinas cae en ambos macros que le tocan", () => {
    const a = artist({ disciplines: ["artista", "beatmaker"] });
    expect(matchesMacro(a, "escena")).toBe(true);
    expect(matchesMacro(a, "produccion")).toBe(true);
  });
});

describe("matchesRole", () => {
  it("null (sin chip) siempre pasa", () => {
    expect(matchesRole(artist({ disciplines: ["dj"] }), null)).toBe(true);
  });
  it("casa por disciplina exacta", () => {
    const a = artist({ disciplines: ["dj"] });
    expect(matchesRole(a, "dj")).toBe(true);
    expect(matchesRole(a, "artista")).toBe(false);
  });
  it("sin disciplinas casa con 'artista' (cantante por defecto)", () => {
    expect(matchesRole(artist({}), "artista")).toBe(true);
    expect(matchesRole(artist({}), "modelo")).toBe(false);
  });
});

describe("normalizeText", () => {
  it("baja a minúsculas y quita acentos", () => {
    expect(normalizeText("Barranquílla")).toBe("barranquilla");
    expect(normalizeText("BOGOTÁ")).toBe("bogota");
  });
});

describe("matchesQuery", () => {
  const a = artist({
    name: "El MP",
    genre: "Trap",
    city: "Barranquilla",
    tagline: "flow del caribe",
  });

  it("query vacío pasa a todos", () => {
    expect(matchesQuery(a, "")).toBe(true);
    expect(matchesQuery(a, "   ")).toBe(true);
  });
  it("casa por nombre, género, ciudad o tagline", () => {
    expect(matchesQuery(a, "mp")).toBe(true);
    expect(matchesQuery(a, "trap")).toBe(true);
    expect(matchesQuery(a, "barranquilla")).toBe(true);
    expect(matchesQuery(a, "caribe")).toBe(true);
  });
  it("es tolerante a acentos y mayúsculas", () => {
    expect(matchesQuery(a, "BARRANQUÍLLA")).toBe(true);
  });
  it("exige TODOS los términos (AND)", () => {
    expect(matchesQuery(a, "trap caribe")).toBe(true);
    expect(matchesQuery(a, "trap jazz")).toBe(false);
  });
});
