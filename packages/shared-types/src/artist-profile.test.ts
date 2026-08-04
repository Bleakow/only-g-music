import { describe, it, expect } from "vitest";
import type { ArtistProfile } from "./artist-profile";
import {
  searchSources,
  needsReindex,
  formatCompact,
  featuredMediaPolicy,
  featuredMediaItems,
  effectiveDisciplines,
  type FeaturedMedia,
} from "./artist-profile";

describe("effectiveDisciplines", () => {
  it("devuelve las disciplinas tal cual cuando las hay", () => {
    expect(effectiveDisciplines(["bailarin"])).toEqual(["bailarin"]);
    expect(effectiveDisciplines(["modelo", "presentador"])).toEqual([
      "modelo",
      "presentador",
    ]);
  });
  it("perfiles anteriores a §05 (sin campo o vacío) son cantantes", () => {
    expect(effectiveDisciplines(undefined)).toEqual(["artista"]);
    expect(effectiveDisciplines([])).toEqual(["artista"]);
  });
});

describe("featuredMediaPolicy", () => {
  it("general: 2 mudos + 1 audio (≤30s), total 3", () => {
    const p = featuredMediaPolicy(["artista"]);
    expect(p).toEqual({
      maxSilent: 2,
      maxAudio: 1,
      audioMaxSeconds: 30,
      maxTotal: 3,
    });
    expect(featuredMediaPolicy(undefined).maxTotal).toBe(3);
  });
  it("bailarines: 5 clips, todos con audio, sin límite de duración", () => {
    const p = featuredMediaPolicy(["bailarin"]);
    expect(p).toEqual({
      maxSilent: 0,
      maxAudio: 5,
      audioMaxSeconds: null,
      maxTotal: 5,
    });
    // Basta con ser bailarín entre varias disciplinas.
    expect(featuredMediaPolicy(["artista", "bailarin"]).maxTotal).toBe(5);
  });
});

describe("featuredMediaItems", () => {
  const single: FeaturedMedia = { url: "a", type: "video" };
  const list: FeaturedMedia[] = [{ url: "b", type: "image" }];
  it("prefiere la lista si tiene elementos", () => {
    expect(featuredMediaItems(list, single)).toBe(list);
  });
  it("cae al item único si no hay lista (compat)", () => {
    expect(featuredMediaItems(undefined, single)).toEqual([single]);
    expect(featuredMediaItems([], single)).toEqual([single]);
  });
  it("vacío si no hay nada", () => {
    expect(featuredMediaItems(undefined, undefined)).toEqual([]);
  });
});

describe("formatCompact", () => {
  it("deja los números pequeños tal cual", () => {
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(7)).toBe("7");
    expect(formatCompact(972)).toBe("972");
  });
  it("compacta miles/millones/billones con 1 decimal (sin .0)", () => {
    expect(formatCompact(1000)).toBe("1K");
    expect(formatCompact(48720)).toBe("48.7K");
    expect(formatCompact(9_400_000)).toBe("9.4M");
    expect(formatCompact(2_100_000_000)).toBe("2.1B");
  });
  it("redondea sin decimal cuando el valor es ≥ 100 de su unidad", () => {
    expect(formatCompact(128_000)).toBe("128K");
  });
  it("negativos o no finitos → 0", () => {
    expect(formatCompact(-5)).toBe("0");
    expect(formatCompact(Number.NaN)).toBe("0");
  });
});

// Perfil mínimo con solo los campos que alimentan el índice de búsqueda.
type Indexable = Parameters<typeof searchSources>[0] &
  Pick<ArtistProfile, "searchIndex">;

function profile(p: Partial<Indexable> = {}): Indexable {
  return {
    photoURL: "https://cdn/x/photo.jpg",
    entryTrackUrl: undefined,
    bio: "Rapea sobre el barrio.",
    genre: "Trap",
    genres: ["Trap", "Drill"],
    tagline: "flow del caribe",
    tracks: [{ title: "Barrio" }, { title: "Nocturno" }],
    ...p,
  };
}

describe("searchSources", () => {
  it("firma foto, audio y un hash del texto", () => {
    const s = searchSources(profile({ entryTrackUrl: "https://cdn/x/intro.mp3" }));
    expect(s.photo).toBe("https://cdn/x/photo.jpg");
    expect(s.audio).toBe("https://cdn/x/intro.mp3");
    expect(typeof s.text).toBe("string");
    expect(s.text!.length).toBeGreaterThan(0);
  });

  it("es determinista: mismas fuentes → misma firma", () => {
    expect(searchSources(profile())).toEqual(searchSources(profile()));
  });

  it("foto vacía → undefined (no cadena vacía)", () => {
    expect(searchSources(profile({ photoURL: "" })).photo).toBeUndefined();
    expect(searchSources(profile({ entryTrackUrl: "" })).audio).toBeUndefined();
  });

  it("cambiar el texto cambia el hash; cambiar la foto no lo toca", () => {
    const base = searchSources(profile());
    expect(searchSources(profile({ bio: "Otra bio" })).text).not.toBe(base.text);
    expect(searchSources(profile({ photoURL: "https://cdn/x/otra.jpg" })).text).toBe(
      base.text,
    );
  });
});

describe("needsReindex", () => {
  it("sin índice previo → true", () => {
    expect(needsReindex(profile())).toBe(true);
  });

  it("firma igual a la guardada → false", () => {
    const p = profile();
    const withIndex = {
      ...p,
      searchIndex: {
        description: "",
        tags: [],
        sources: searchSources(p),
        indexedAt: 0,
        model: "gemini-flash-lite-latest",
      },
    };
    expect(needsReindex(withIndex)).toBe(false);
  });

  it("detecta cambios de foto, audio o texto", () => {
    const p = profile({ entryTrackUrl: "https://cdn/x/intro.mp3" });
    const indexed = {
      ...p,
      searchIndex: {
        description: "",
        tags: [],
        sources: searchSources(p),
        indexedAt: 0,
        model: "m",
      },
    };
    expect(needsReindex({ ...indexed, photoURL: "https://cdn/x/nueva.jpg" })).toBe(
      true,
    );
    expect(
      needsReindex({ ...indexed, entryTrackUrl: "https://cdn/x/otra.mp3" }),
    ).toBe(true);
    expect(needsReindex({ ...indexed, bio: "Bio nueva" })).toBe(true);
  });
});
