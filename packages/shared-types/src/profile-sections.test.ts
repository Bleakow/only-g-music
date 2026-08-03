import { describe, it, expect } from "vitest";
import {
  PROFILE_SECTIONS,
  groupSections,
  isSectionOn,
  isUnlocked,
  sectionDef,
  visibleSections,
} from "./profile-sections";

describe("catálogo", () => {
  it("no tiene ids repetidos", () => {
    const ids = PROFILE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda sección no-base declara al menos una etiqueta que la desbloquea", () => {
    for (const s of PROFILE_SECTIONS) {
      if (s.unlockedBy.length === 0) continue;
      expect(s.unlockedBy.length).toBeGreaterThan(0);
    }
  });
});

describe("groupSections", () => {
  it("el caso del mockup: Cantante + Modelo", () => {
    const { base, unlocked, locked } = groupSections(["artista", "modelo"]);

    // Base siempre disponible, sin importar la etiqueta.
    expect(base.map((s) => s.id)).toContain("sobreMi");
    expect(base.map((s) => s.id)).toContain("galeria");
    expect(base.map((s) => s.id)).toContain("redes");
    expect(base.map((s) => s.id)).toContain("metricas");

    // Cantante trae reproductor/canciones/géneros; Modelo, portafolio/ficha/premios.
    const u = unlocked.map((s) => s.id);
    expect(u).toEqual(
      expect.arrayContaining([
        "reproductor",
        "canciones",
        "generosMusicales",
        "portafolio",
        "fichaTecnica",
        "reconocimientos",
      ]),
    );

    // Y quedan bloqueadas las de las etiquetas que no tiene.
    const l = locked.map((x) => x.def.id);
    expect(l).toEqual(
      expect.arrayContaining([
        "tiendaBeats",
        "generosBaile",
        "reelPresentaciones",
      ]),
    );
  });

  it("cada bloqueada dice QUÉ etiqueta le falta", () => {
    const { locked } = groupSections(["artista"]);
    const tienda = locked.find((x) => x.def.id === "tiendaBeats");
    expect(tienda?.requires).toBe("beatmaker");
    const baile = locked.find((x) => x.def.id === "generosBaile");
    expect(baile?.requires).toBe("bailarin");
  });

  it("sin etiquetas: solo base, todo lo demás bloqueado", () => {
    const { base, unlocked, locked } = groupSections([]);
    expect(unlocked).toHaveLength(0);
    expect(base.length).toBeGreaterThan(0);
    expect(locked.length).toBeGreaterThan(0);
  });

  it("las tres listas suman el catálogo entero, sin solaparse", () => {
    const { base, unlocked, locked } = groupSections(["modelo", "bailarin"]);
    expect(base.length + unlocked.length + locked.length).toBe(
      PROFILE_SECTIONS.length,
    );
  });
});

describe("isUnlocked", () => {
  it("basta con UNA de las etiquetas que la desbloquean", () => {
    const generos = sectionDef("generosMusicales")!;
    expect(isUnlocked(generos, ["dj"])).toBe(true);
    expect(isUnlocked(generos, ["artista"])).toBe(true);
    expect(isUnlocked(generos, ["modelo"])).toBe(false);
  });

  it("las base están desbloqueadas incluso sin etiquetas", () => {
    expect(isUnlocked(sectionDef("sobreMi")!, undefined)).toBe(true);
    expect(isUnlocked(sectionDef("sobreMi")!, [])).toBe(true);
  });
});

describe("isSectionOn", () => {
  it("sin preferencia usa el valor por defecto de la sección", () => {
    expect(isSectionOn("reproductor", undefined, ["artista"])).toBe(true);
    // Reconocimientos nace apagada: una sección vacía de premios afea el perfil.
    expect(isSectionOn("reconocimientos", undefined, ["modelo"])).toBe(false);
  });

  it("la preferencia del artista manda sobre el defecto", () => {
    expect(isSectionOn("reproductor", { reproductor: false }, ["artista"])).toBe(
      false,
    );
    expect(
      isSectionOn("reconocimientos", { reconocimientos: true }, ["modelo"]),
    ).toBe(true);
  });

  it("una sección BLOQUEADA no se pinta ni aunque la preferencia diga que sí", () => {
    // Defensa real: si el artista se quita la etiqueta Beatmaker, su tienda deja
    // de verse aunque el `prefs` guardado siga en true.
    expect(isSectionOn("tiendaBeats", { tiendaBeats: true }, ["modelo"])).toBe(
      false,
    );
  });

  it("un id desconocido no revienta ni se pinta", () => {
    // @ts-expect-error probamos a propósito un id fuera del catálogo
    expect(isSectionOn("noExiste", {}, ["artista"])).toBe(false);
  });
});

describe("visibleSections", () => {
  it("sin orden guardado, usa el del catálogo", () => {
    const v = visibleSections(["artista"], undefined, undefined);
    expect(v[0]).toBe("mediaDestacada");
    expect(v).toContain("reproductor");
    expect(v).not.toContain("fichaTecnica"); // no es modelo
  });

  it("respeta el orden guardado por el artista", () => {
    const v = visibleSections(
      ["artista"],
      undefined,
      ["sobreMi", "reproductor", "galeria"],
    );
    expect(v.slice(0, 3)).toEqual(["sobreMi", "reproductor", "galeria"]);
  });

  it("una sección nueva del catálogo aparece al final sin romper el orden", () => {
    const v = visibleSections(["modelo"], undefined, ["sobreMi", "galeria"]);
    expect(v.slice(0, 2)).toEqual(["sobreMi", "galeria"]);
    expect(v).toContain("fichaTecnica"); // no estaba en el orden, va al final
  });

  it("el orden guardado no resucita secciones apagadas ni bloqueadas", () => {
    const v = visibleSections(
      ["artista"],
      { canciones: false },
      ["canciones", "tiendaBeats", "sobreMi"],
    );
    expect(v).not.toContain("canciones"); // apagada por el artista
    expect(v).not.toContain("tiendaBeats"); // sin etiqueta beatmaker
    expect(v).toContain("sobreMi");
  });
});
