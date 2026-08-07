import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { areaDeRanura } from "@only-g/shared-types/gallery-layout";
import {
  ESCENAS,
  FONDOS,
  LETRAS,
  MEDIDAS,
  TEXTURAS,
  escenasElegibles,
  type EscenaTipo,
} from "@only-g/shared-types/book";

/**
 * El book vive PARTIDO, igual que la galería: `book.ts` dice qué escenas existen
 * y cuántas piezas lleva cada una; `book.css` dice cómo se colocan.
 *
 * El precio es que TypeScript no ve esa mitad, y la mitad que no ve falla
 * CALLANDO. Si un `grid-template-areas` no es rectangular, o si un área no forma
 * un rectángulo, el navegador tira la declaración ENTERA y las piezas se colocan
 * solas en pistas implícitas: se ve torcido, no roto. Y si un fondo se olvida de
 * declarar `--bk-ink`, hereda la tinta del anterior — que es como acabar con
 * texto casi blanco sobre papel hueso.
 *
 * Esta prueba lee el CSS de verdad y comprueba lo que el compilador no puede.
 * Es la hermana de `gallery-css.test.ts`.
 */

const CSS = readFileSync(
  fileURLToPath(new URL("../book.css", import.meta.url)),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

interface Regla {
  selector: string;
  cuerpo: string;
}

/**
 * Todas las reglas del archivo, entrando dentro de los `@container`/`@media`.
 * Un regex plano no vale: el `{` de una at-rule emparejaría con el `}` de la
 * primera regla de dentro y el resto del archivo quedaría sin mirar — o sea, una
 * prueba que pasa por no leer nada.
 */
function reglas(css: string): Regla[] {
  const out: Regla[] = [];
  let i = 0;
  let inicio = 0;
  while (i < css.length) {
    if (css[i] === "{") {
      const selector = css.slice(inicio, i).trim();
      let profundidad = 1;
      let j = i + 1;
      while (j < css.length && profundidad > 0) {
        if (css[j] === "{") profundidad++;
        else if (css[j] === "}") profundidad--;
        j++;
      }
      const cuerpo = css.slice(i + 1, j - 1);
      if (selector.startsWith("@")) out.push(...reglas(cuerpo));
      else out.push({ selector, cuerpo });
      i = j;
      inicio = j;
    } else if (css[i] === "}") {
      i++;
      inicio = i;
    } else {
      i++;
    }
  }
  return out;
}

const REGLAS = reglas(CSS);

/** Filas de tokens de un `grid-template-areas`, o null si la regla no lo declara. */
function areas(cuerpo: string): string[][] | null {
  const m = /grid-template-areas:\s*([^;]+);/.exec(cuerpo);
  if (!m) return null;
  const filas = [...m[1].matchAll(/"([^"]*)"/g)].map((f) =>
    f[1].trim().split(/\s+/).filter(Boolean),
  );
  return filas.length ? filas : null;
}

describe("book.css — el catálogo de escenas está cubierto", () => {
  it("toda escena del dominio tiene su bloque en el CSS", () => {
    // Una escena sin CSS se pinta con los defaults de `.og-book-grid`: una
    // columna sosa, sin el menor parecido con lo que promete su nombre.
    for (const { tipo } of ESCENAS) {
      expect(
        CSS.includes(`[data-escena="${tipo}"]`),
        `falta .og-book-grid[data-escena="${tipo}"] en book.css`,
      ).toBe(true);
    }
  });

  it("la apertura tiene su recorrido y un escenario de UNA pantalla exacta", () => {
    // Esta prueba fija el arreglo de un bug reportado: en escritorio la primera
    // foto ocupaba MÁS que la pantalla y seguía ahí al bajar. La causa era una
    // sola caja con `min-height: 100svh` y alturas en porcentaje encadenadas —
    // un porcentaje contra un padre de altura indefinida no resuelve, así que
    // mandaba el contenido— y ningún recorrido durante el cual la foto pudiera
    // irse. La forma correcta son dos piezas: un track que da el scroll y un
    // escenario pegajoso cuyo alto es un valor ABSOLUTO.
    const track = REGLAS.find((r) => r.selector.trim() === ".og-book-apertura");
    const escenario = REGLAS.find(
      (r) => r.selector.trim() === ".og-book-ap-escenario",
    );
    expect(track, "falta el recorrido .og-book-apertura").toBeDefined();
    expect(escenario, "falta el escenario .og-book-ap-escenario").toBeDefined();

    // El track mide varias pantallas: es el scroll que consume la secuencia.
    expect(track!.cuerpo).toMatch(/height:\s*\d+svh/);
    // Y el escenario, una y solo una. Nada de porcentajes aquí.
    expect(escenario!.cuerpo).toMatch(/position:\s*sticky/);
    expect(escenario!.cuerpo).toMatch(/height:\s*100svh/);
    expect(
      /height:\s*100%/.test(escenario!.cuerpo),
      "el escenario vuelve a depender de un porcentaje",
    ).toBe(false);
  });

  it("no hay bloques de escenas que ya no existan en el dominio", () => {
    const conocidas = new Set<string>(ESCENAS.map((e) => e.tipo));
    for (const m of CSS.matchAll(/\[data-escena="([^"]+)"\]/g)) {
      expect(conocidas.has(m[1]), `sobra el bloque data-escena="${m[1]}"`).toBe(
        true,
      );
    }
  });
});

describe("book.css — las rejillas son válidas", () => {
  const conAreas = REGLAS.map((r) => ({ ...r, filas: areas(r.cuerpo) })).filter(
    (r): r is Regla & { filas: string[][] } => r.filas !== null,
  );

  it("hay rejillas que comprobar (si esto falla, el parser no está leyendo)", () => {
    expect(conAreas.length).toBeGreaterThan(5);
  });

  it.each(conAreas.map((r) => [r.selector, r.filas] as const))(
    "%s declara una rejilla rectangular con áreas rectangulares",
    (selector, filas) => {
      // 1. Todas las filas, el mismo número de columnas. Si no, el navegador
      //    descarta la declaración entera sin decir nada.
      const cols = filas[0].length;
      for (const fila of filas) {
        expect(fila.length, `${selector}: filas de distinto ancho`).toBe(cols);
      }

      // 2. Cada área nombrada tiene que formar un RECTÁNGULO macizo. Una "L" o
      //    dos trozos sueltos con el mismo nombre son igual de inválidos.
      const celdas = new Map<string, { r: number; c: number }[]>();
      filas.forEach((fila, r) =>
        fila.forEach((nombre, c) => {
          if (nombre === ".") return;
          const lista = celdas.get(nombre) ?? [];
          lista.push({ r, c });
          celdas.set(nombre, lista);
        }),
      );

      for (const [nombre, lista] of celdas) {
        const r0 = Math.min(...lista.map((p) => p.r));
        const r1 = Math.max(...lista.map((p) => p.r));
        const c0 = Math.min(...lista.map((p) => p.c));
        const c1 = Math.max(...lista.map((p) => p.c));
        expect(
          lista.length,
          `${selector}: el área "${nombre}" no es un rectángulo macizo`,
        ).toBe((r1 - r0 + 1) * (c1 - c0 + 1));
      }
    },
  );

  it("solo se usan nombres de área conocidos: piezas a…f, texto n, encabezado h", () => {
    const validos = new Set([
      ...Array.from({ length: 6 }, (_, i) => areaDeRanura(i)),
      "n",
      "h",
      ".",
    ]);
    for (const { selector, filas } of conAreas) {
      for (const nombre of filas.flat()) {
        expect(validos.has(nombre), `${selector}: área desconocida "${nombre}"`).toBe(
          true,
        );
      }
    }
  });
});

describe("book.css — las ranuras cuadran con el dominio", () => {
  /** Bloques de una escena concreta, con sus áreas declaradas. */
  function filasDe(tipo: EscenaTipo): { selector: string; filas: string[][] }[] {
    return REGLAS.filter((r) => r.selector.includes(`[data-escena="${tipo}"]`))
      .map((r) => ({ selector: r.selector, filas: areas(r.cuerpo) }))
      .filter((r): r is { selector: string; filas: string[][] } => r.filas !== null);
  }

  it.each(ESCENAS.map((e) => [e.tipo, e.max] as const))(
    "%s no coloca piezas fuera de sus %i ranuras",
    (tipo, max) => {
      // Un área `d` en una escena de dos piezas es una ranura que nunca se
      // llenará: hueco permanente en la composición.
      const permitidas = new Set(
        Array.from({ length: max }, (_, i) => areaDeRanura(i)),
      );
      for (const { selector, filas } of filasDe(tipo)) {
        for (const nombre of filas.flat()) {
          if (nombre === "n" || nombre === "h" || nombre === ".") continue;
          expect(
            permitidas.has(nombre),
            `${selector}: usa el área "${nombre}" pero la escena admite ${max} pieza(s)`,
          ).toBe(true);
        }
      }
    },
  );

  it("cada medida tiene su bloque de anchos en el CSS", () => {
    // El sistema de respiración entero cuelga de estos tres bloques. Si falta
    // uno, esa escena se pinta al 100% del ancho sin margen — que es justo el
    // estado que se sintió abrumador y por el que existe todo esto.
    for (const m of MEDIDAS) {
      expect(
        CSS.includes(`[data-medida="${m}"]`),
        `falta el bloque [data-medida="${m}"]`,
      ).toBe(true);
    }
  });

  it("las escenas que componen su texto dentro reservan el área h", () => {
    // Sin `h` declarada, el título cae en una pista implícita: se ve torcido, no
    // roto — el peor de los dos.
    for (const { tipo, textoEnRejilla } of ESCENAS) {
      if (!textoEnRejilla) continue;
      const declara = filasDe(tipo).some((r) => r.filas.flat().includes("h"));
      expect(
        declara,
        `"${tipo}" pinta el encabezado dentro pero no declara el área h`,
      ).toBe(true);
    }
  });

  it("las escenas que ponen el texto de su pieza en la rejilla reservan `n`", () => {
    for (const { tipo, notaEnRejilla } of ESCENAS) {
      if (!notaEnRejilla) continue;
      const declara = filasDe(tipo).some((r) => r.filas.flat().includes("n"));
      expect(declara, `"${tipo}" promete texto en la rejilla pero no declara n`).toBe(
        true,
      );
    }
  });

  it("NINGUNA rejilla reserva un área `n` que nadie va a llenar", () => {
    // La comprobación al revés, y es la que de verdad importa: `retrato`
    // reservaba cinco de sus doce columnas para el texto y el componente lo
    // pintaba dentro de la figura. Media escena en blanco en escritorio, sin un
    // solo error y sin un solo test rojo. Un área declarada que nadie llena no
    // se ve venir hasta que se abre el book.
    for (const def of ESCENAS) {
      const reserva = filasDe(def.tipo).some((r) => r.filas.flat().includes("n"));
      if (!reserva) continue;
      expect(
        def.maxNotas > 0 || def.notaEnRejilla === true,
        `"${def.tipo}" reserva el área n pero no declara quién la llena`,
      ).toBe(true);
    }
  });

  it("las escenas que admiten texto suelto reservan su área", () => {
    // `ancla` es la única con `maxNotas > 0`: si su rejilla no declara `n`, los
    // bloques de texto caen en una pista implícita, fuera de la composición.
    for (const { tipo, maxNotas } of ESCENAS) {
      if (maxNotas === 0) continue;
      const declara = filasDe(tipo).some((r) => r.filas.flat().includes("n"));
      expect(declara, `la escena "${tipo}" admite notas pero no declara el área n`).toBe(
        true,
      );
    }
  });
});

describe("book.css — las miniaturas animadas del selector", () => {
  /** Reglas de animación de miniatura que apuntan a una escena concreta. */
  function animacionesDe(tipo: EscenaTipo): Regla[] {
    return REGLAS.filter(
      (r) =>
        r.selector.includes("[data-anim]") &&
        r.selector.includes(`[data-escena="${tipo}"]`) &&
        /animation(-name)?\s*:/.test(r.cuerpo),
    );
  }

  it.each(escenasElegibles().map((e) => [e.tipo] as const))(
    'la escena ofrecible "%s" tiene animación en su miniatura',
    (tipo) => {
      // Es la petición literal del usuario: que la modelo vea qué está
      // colocando. Una escena que se puede añadir pero cuya miniatura no se
      // mueve es indistinguible de la de al lado — que era justo el problema.
      expect(animacionesDe(tipo).length, `"${tipo}" no anima su miniatura`).toBeGreaterThan(
        0,
      );
    },
  );

  it("toda animación referenciada existe como @keyframes", () => {
    // Un `animation-name` sin sus fotogramas no da error: simplemente no anima.
    // Es exactamente el fallo callado contra el que se escribió este archivo.
    const declarados = new Set(
      [...CSS.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]),
    );
    const usados = new Set<string>();
    for (const { cuerpo } of REGLAS) {
      const porNombre = /animation-name:\s*([\w-]+)/.exec(cuerpo);
      if (porNombre) usados.add(porNombre[1]);
      // Forma corta: `animation: nombre 3s infinite …`
      const corta = /animation:\s*([\w-]+)\s/.exec(cuerpo);
      if (corta && !["none", "inherit", "initial"].includes(corta[1])) {
        usados.add(corta[1]);
      }
    }
    expect(usados.size).toBeGreaterThan(5); // guarda anti-parser-mudo
    for (const nombre of usados) {
      expect(declarados.has(nombre), `falta @keyframes ${nombre}`).toBe(true);
    }
  });
});

describe("book.css — la atmósfera", () => {
  /** Los tokens que hacen legible el book. Ninguno es opcional. */
  const TOKENS = ["--bk-bg", "--bk-ink", "--bk-ink-soft", "--bk-surf", "--bk-line"];

  it.each(FONDOS.map((f) => [f] as const))(
    'el fondo "%s" declara la paleta COMPLETA',
    (fondo) => {
      // Es el guardarraíl de toda la personalización: si un fondo se olvidara de
      // `--bk-ink`, heredaría la tinta del fondo anterior y podría quedar texto
      // casi blanco sobre papel claro. La legibilidad no puede depender de qué
      // fondo elija la modelo.
      const bloque = REGLAS.find((r) =>
        r.selector.includes(`[data-fondo="${fondo}"]`),
      );
      // "medianoche" es el valor por defecto: sus tokens viven en `.og-book-root`.
      const cuerpo =
        bloque?.cuerpo ??
        REGLAS.find((r) => r.selector.trim() === ".og-book-root")!.cuerpo;
      for (const token of TOKENS) {
        expect(cuerpo.includes(token), `${fondo}: falta ${token}`).toBe(true);
      }
    },
  );

  it("cada tipografía del catálogo define su familia display", () => {
    for (const letra of LETRAS) {
      const tiene =
        CSS.includes(`[data-letra="${letra}"]`) &&
        new RegExp(`\\[data-letra="${letra}"\\][^{]*\\{[^}]*--bk-display`).test(CSS);
      // "narrow" es la de por defecto y la declara `.og-book-root`.
      if (letra === "narrow") {
        expect(CSS.includes("--bk-display: var(--font-narrow)")).toBe(true);
        continue;
      }
      expect(tiene, `la letra "${letra}" no define --bk-display`).toBe(true);
    }
  });

  it("cada textura del catálogo tiene su regla", () => {
    for (const textura of TEXTURAS) {
      expect(
        CSS.includes(`[data-textura="${textura}"]`),
        `falta la regla de la textura "${textura}"`,
      ).toBe(true);
    }
  });

  it("la atmósfera NO se declara en :root — no puede teñir el resto de la web", () => {
    // Todo cuelga de `.og-book-root`. Un `:root { --bk-… }` se filtraría al
    // perfil, al header y a todo lo que el visitante vea después del book.
    for (const { selector, cuerpo } of REGLAS) {
      if (!cuerpo.includes("--bk-")) continue;
      expect(
        selector.includes(".og-book"),
        `los tokens del book se declaran fuera del book: "${selector}"`,
      ).toBe(true);
    }
  });
});
