import { describe, it, expect } from "vitest";
import {
  CUPOS_MINIMOS,
  cuposLibres,
  filtrarColectivos,
  inicialesColectivo,
  matchesTexto,
  membresiaEstado,
  miembrosDestacados,
  puedeAgregarMiembro,
  puedeGestionar,
  totalMembresia,
  totalMiembros,
  type Colectivo,
} from "./colectivo";

/** Precios de prueba, inyectados (en producción los pone el CEO). */
const PRECIOS = { precioColectivo: 120000, precioCupoColectivo: 25000 };

const base = (over: Partial<Colectivo> = {}): Colectivo => ({
  slug: "og-records",
  nombre: "Only G Records",
  tipo: "sello",
  disciplina: "musica",
  ownerUid: "u1",
  accent: "#8b5cf6",
  miembros: [],
  ...over,
});

describe("inicialesColectivo", () => {
  it("toma la inicial de las dos primeras palabras", () => {
    // "Only G Records" → "OG", que es justo la marca (y lo que pinta el mockup).
    expect(inicialesColectivo("Only G Records")).toBe("OG");
    expect(inicialesColectivo("Urban Crew")).toBe("UC");
    expect(inicialesColectivo("Flow Academy")).toBe("FA");
  });

  it("con una sola palabra usa sus dos primeras letras", () => {
    expect(inicialesColectivo("Nova")).toBe("NO");
  });

  it("ignora palabras sin letras ni números", () => {
    expect(inicialesColectivo("— Caribe 2.0")).toBe("C2");
  });

  it("no revienta con nombre vacío", () => {
    expect(inicialesColectivo("   ")).toBe("?");
  });
});

describe("totalMiembros", () => {
  it("prefiere el contador guardado", () => {
    expect(
      totalMiembros({ miembros: [{ slug: "a" }], stats: { miembros: 42 } }),
    ).toBe(42);
  });

  it("si no hay contador, cuenta la lista", () => {
    expect(totalMiembros({ miembros: [{ slug: "a" }, { slug: "b" }] })).toBe(2);
  });

  it("sin nada, cero", () => {
    expect(totalMiembros({ miembros: [] })).toBe(0);
  });
});

describe("miembrosDestacados", () => {
  it("usa los marcados como destacados", () => {
    const r = miembrosDestacados({
      miembros: [
        { slug: "a" },
        { slug: "b", destacado: true },
        { slug: "c", destacado: true },
      ],
    });
    expect(r.map((m) => m.slug)).toEqual(["b", "c"]);
  });

  it("si nadie está marcado, cae a los primeros (mejor caras que un hueco)", () => {
    const r = miembrosDestacados(
      { miembros: [{ slug: "a" }, { slug: "b" }, { slug: "c" }] },
      2,
    );
    expect(r.map((m) => m.slug)).toEqual(["a", "b"]);
  });

  it("respeta el límite", () => {
    const miembros = Array.from({ length: 10 }, (_, i) => ({
      slug: `m${i}`,
      destacado: true,
    }));
    expect(miembrosDestacados({ miembros }, 4)).toHaveLength(4);
  });
});

describe("puedeGestionar", () => {
  it("el dueño puede", () => {
    expect(puedeGestionar({ ownerUid: "u1" }, "u1")).toBe(true);
  });

  it("un co-admin puede", () => {
    expect(puedeGestionar({ ownerUid: "u1", adminUids: ["u2"] }, "u2")).toBe(
      true,
    );
  });

  it("un extraño no puede, y sin sesión tampoco", () => {
    expect(puedeGestionar({ ownerUid: "u1" }, "u9")).toBe(false);
    expect(puedeGestionar({ ownerUid: "u1" }, null)).toBe(false);
    expect(puedeGestionar({ ownerUid: "u1" }, undefined)).toBe(false);
  });
});

describe("matchesTexto", () => {
  const c = {
    nombre: "Caribe 2.0",
    ciudad: "Barranquilla",
    descripcion: "Movimiento de champeta urbana",
  };

  it("busca sin acentos y sin distinguir mayúsculas", () => {
    expect(matchesTexto(c, "CARIBE")).toBe(true);
    expect(matchesTexto({ ...c, nombre: "Nómada" }, "nomada")).toBe(true);
  });

  it("busca también en ciudad y descripción", () => {
    expect(matchesTexto(c, "barranquilla")).toBe(true);
    expect(matchesTexto(c, "champeta")).toBe(true);
  });

  it("exige TODAS las palabras, en cualquier orden", () => {
    expect(matchesTexto(c, "caribe champeta")).toBe(true);
    expect(matchesTexto(c, "caribe salsa")).toBe(false);
  });

  it("texto vacío no filtra", () => {
    expect(matchesTexto(c, "")).toBe(true);
    expect(matchesTexto(c, "   ")).toBe(true);
  });
});

describe("totalMembresia", () => {
  it("suma la cuota del colectivo más los cupos", () => {
    // 120.000 + 10 × 25.000 = 370.000
    expect(totalMembresia(10, PRECIOS)).toBe(370000);
  });

  it("nunca cobra menos de los cupos mínimos", () => {
    expect(totalMembresia(0, PRECIOS)).toBe(
      PRECIOS.precioColectivo + CUPOS_MINIMOS * PRECIOS.precioCupoColectivo,
    );
    expect(totalMembresia(-5, PRECIOS)).toBe(totalMembresia(CUPOS_MINIMOS, PRECIOS));
  });

  it("acota por arriba y redondea a entero", () => {
    expect(totalMembresia(9999, PRECIOS)).toBe(
      PRECIOS.precioColectivo + 100 * PRECIOS.precioCupoColectivo,
    );
    expect(totalMembresia(5.9, PRECIOS)).toBe(totalMembresia(5, PRECIOS));
  });

  it("usa los precios que le pasan, no constantes horneadas", () => {
    // Si el CEO baja los precios desde su panel, el total baja sin desplegar.
    expect(totalMembresia(2, { precioColectivo: 0, precioCupoColectivo: 0 })).toBe(0);
  });
});

describe("membresiaEstado / cupos", () => {
  const ahora = 1_700_000_000_000;

  it("sin membresía es 'ninguna'", () => {
    expect(membresiaEstado(undefined, ahora)).toBe("ninguna");
    expect(membresiaEstado(null, ahora)).toBe("ninguna");
  });

  it("distingue activa de vencida", () => {
    expect(membresiaEstado({ cupos: 5, expiresAt: ahora + 1000 }, ahora)).toBe(
      "activa",
    );
    expect(membresiaEstado({ cupos: 5, expiresAt: ahora - 1000 }, ahora)).toBe(
      "vencida",
    );
  });

  it("con membresía activa caben miembros hasta agotar cupos", () => {
    const c = {
      miembros: [{ slug: "a" }, { slug: "b" }],
      membresia: { cupos: 3, expiresAt: ahora + 1000 },
    };
    expect(puedeAgregarMiembro(c, ahora)).toBe(true);
    expect(cuposLibres(c, ahora)).toBe(1);
  });

  it("con los cupos agotados no caben más", () => {
    const c = {
      miembros: [{ slug: "a" }, { slug: "b" }],
      membresia: { cupos: 2, expiresAt: ahora + 1000 },
    };
    expect(puedeAgregarMiembro(c, ahora)).toBe(false);
    expect(cuposLibres(c, ahora)).toBe(0);
  });

  it("sin membresía activa el colectivo NO crece (pero sigue existiendo)", () => {
    const c = {
      miembros: [{ slug: "a" }],
      membresia: { cupos: 10, expiresAt: ahora - 1 },
    };
    expect(puedeAgregarMiembro(c, ahora)).toBe(false);
    expect(cuposLibres(c, ahora)).toBe(0);
  });
});

describe("filtrarColectivos", () => {
  const lista: Colectivo[] = [
    base({ slug: "b", nombre: "Beta", tipo: "movimiento" }),
    base({ slug: "a", nombre: "Alfa", tipo: "sello" }),
    base({
      slug: "c",
      nombre: "Cetro",
      tipo: "academia",
      disciplina: "baile",
    }),
  ];

  it("sin filtros los devuelve todos, ordenados por nombre", () => {
    expect(filtrarColectivos(lista).map((c) => c.nombre)).toEqual([
      "Alfa",
      "Beta",
      "Cetro",
    ]);
  });

  it("filtra por tipo", () => {
    expect(
      filtrarColectivos(lista, { tipo: "sello" }).map((c) => c.slug),
    ).toEqual(["a"]);
  });

  it("filtra por disciplina", () => {
    expect(
      filtrarColectivos(lista, { disciplina: "baile" }).map((c) => c.slug),
    ).toEqual(["c"]);
  });

  it("combina tipo y disciplina", () => {
    expect(
      filtrarColectivos(lista, { tipo: "sello", disciplina: "baile" }),
    ).toHaveLength(0);
  });

  it("la curaduría (orden) manda sobre el alfabético", () => {
    const conOrden = [
      base({ slug: "a", nombre: "Alfa" }),
      base({ slug: "z", nombre: "Zeta", orden: 1 }),
    ];
    expect(filtrarColectivos(conOrden).map((c) => c.slug)).toEqual(["z", "a"]);
  });

  it("es estable: dos llamadas dan el mismo orden", () => {
    const uno = filtrarColectivos(lista).map((c) => c.slug);
    const dos = filtrarColectivos(lista).map((c) => c.slug);
    expect(uno).toEqual(dos);
  });
});
