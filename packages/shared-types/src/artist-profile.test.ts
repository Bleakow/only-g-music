import { describe, it, expect } from "vitest";
import type { ArtistProfile } from "./artist-profile";
import {
  searchSources,
  needsReindex,
  formatCompact,
  featuredMediaPolicy,
  featuredMediaItems,
  effectiveDisciplines,
  esPerfilMock,
  esReel,
  esVideoVertical,
  perfilVisible,
  presentacionDestacada,
  type FeaturedMedia,
} from "./artist-profile";

/** Vigencia viva / caducada respecto a `AHORA`, para los casos de premium. */
const AHORA = 1_700_000_000_000;
const vigente = { activo: true, since: 0, expiresAt: AHORA + 86_400_000 };
const caducado = { activo: true, since: 0, expiresAt: AHORA - 86_400_000 };

describe("esPerfilMock", () => {
  it("sin uid es un perfil de relleno; con uid, de alguien", () => {
    expect(esPerfilMock({ uid: "" })).toBe(true);
    expect(esPerfilMock({ uid: "abc123" })).toBe(false);
  });
});

describe("perfilVisible", () => {
  it("premium vigente basta; caducado no", () => {
    expect(perfilVisible({ premium: vigente, socio: false }, AHORA)).toBe(true);
    expect(perfilVisible({ premium: caducado, socio: false }, AHORA)).toBe(
      false,
    );
  });
  it("el socio se ve sin pagar membresía", () => {
    expect(perfilVisible({ premium: null, socio: true }, AHORA)).toBe(true);
  });
  it("el interruptor del admin muestra un mock sin premium ni convenio", () => {
    expect(
      perfilVisible({ premium: null, socio: false, visibleAdmin: true }, AHORA),
    ).toBe(true);
  });
  it("apagado explícito no resucita: sin las otras vías, no se ve", () => {
    expect(
      perfilVisible({ premium: null, socio: false, visibleAdmin: false }, AHORA),
    ).toBe(false);
  });
  it("sin ninguna de las tres vías, oculto", () => {
    expect(perfilVisible({ premium: null, socio: false }, AHORA)).toBe(false);
  });
});

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
  it("modelos: 4 reels, todos con audio, sin límite de duración", () => {
    expect(featuredMediaPolicy(["modelo"])).toEqual({
      maxSilent: 0,
      maxAudio: 4,
      audioMaxSeconds: null,
      maxTotal: 4,
    });
  });
  it("bailarina Y modelo: manda bailarín (la lista más amplia)", () => {
    // El orden de los `if` es la regla: se comprueba bailarín primero, así que
    // quien es las dos cosas conserva sus 5 clips en vez de bajar a 2.
    expect(featuredMediaPolicy(["modelo", "bailarin"]).maxTotal).toBe(5);
  });
});

describe("presentacionDestacada (la decide el material, no el rol)", () => {
  const vert = (n: number): FeaturedMedia => ({
    url: `v${n}`,
    type: "video",
    ratio: 9 / 16,
  });
  const horiz: FeaturedMedia = { url: "h", type: "video", ratio: 16 / 9 };
  const foto: FeaturedMedia = { url: "f", type: "image" };

  it("todo vertical → cuadrícula de reels", () => {
    expect(presentacionDestacada([vert(1), vert(2)])).toBe("reels");
  });
  it("basta UN horizontal para volver al reproductor ancho", () => {
    expect(presentacionDestacada([vert(1), horiz])).toBe("player");
  });
  it("una foto entre medias también manda al reproductor", () => {
    expect(presentacionDestacada([vert(1), foto])).toBe("player");
  });
  it("sin nada, reproductor (cae a la foto de portada)", () => {
    expect(presentacionDestacada([])).toBe("player");
  });
  it("material ANTIGUO sin proporción se lee como horizontal (sin regresión)", () => {
    expect(presentacionDestacada([{ url: "x", type: "video" }])).toBe("player");
  });
  it("un cuadrado NO es un reel: cabe de sobra en el marco ancho", () => {
    expect(presentacionDestacada([{ url: "s", type: "video", ratio: 1 }])).toBe(
      "player",
    );
  });
});

describe("esVideoVertical", () => {
  it("solo videos, solo con proporción válida y por debajo del umbral", () => {
    expect(esVideoVertical({ url: "a", type: "video", ratio: 0.5625 })).toBe(true);
    expect(esVideoVertical({ url: "a", type: "video", ratio: 1.77 })).toBe(false);
    expect(esVideoVertical({ url: "a", type: "video", ratio: 0 })).toBe(false);
    expect(esVideoVertical({ url: "a", type: "image", ratio: 0.5 })).toBe(false);
  });
});

describe("esReel", () => {
  it("solo las modelos llaman reel a su media destacada", () => {
    expect(esReel(["modelo"])).toBe(true);
    expect(esReel(["artista", "modelo"])).toBe(true);
    expect(esReel(["artista"])).toBe(false);
    expect(esReel(undefined)).toBe(false);
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
