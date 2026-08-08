import { describe, it, expect } from "vitest";
import {
  fasePolvo,
  frenteDePolvo,
  turnoDeGrano,
  vueloDeGrano,
} from "./desintegrar";

/**
 * EL RELOJ DEL DESINTEGRADO. El sitio de cada grano sobre el eje del viento se
 * desordena para que el frente no sea una línea recta, y ese desorden tiene que
 * caber ENTERO dentro del recorrido. Si un turno se sale, ese grano se queda
 * flotando en una foto que ya está entera —o no llega a salir nunca— y no hay
 * error que lo delate: el efecto simplemente se ve mal.
 */
describe("el turno de cada grano cabe dentro del recorrido", () => {
  /** Sitios y azares extremos y de en medio: el turno sale de cruzar los dos. */
  const rejilla = Array.from({ length: 21 }, (_, i) => i / 20);

  it("ningún turno se sale de 0..1", () => {
    for (const sitio of rejilla) {
      for (const azar of rejilla) {
        const turno = turnoDeGrano(sitio, azar);
        expect(turno).toBeGreaterThanOrEqual(0);
        expect(turno).toBeLessThanOrEqual(1);
      }
    }
  });

  it("al empezar no hay NI UN grano en el aire", () => {
    // `vuelo <= 0` es "todavía en casa", y en casa el grano ES su píxel de la
    // foto. Un grano ya despegado con la foto entera es una mota que sobra.
    const frente = frenteDePolvo(0);
    for (const sitio of rejilla) {
      for (const azar of rejilla) {
        expect(
          vueloDeGrano(frente, turnoDeGrano(sitio, azar)),
          `grano suelto al empezar (sitio ${sitio}, azar ${azar})`,
        ).toBeLessThanOrEqual(0);
      }
    }
  });

  it("al terminar tampoco queda NI UNO", () => {
    // `vuelo >= 1` es "ya no se ve". Uno solo por debajo se quedaría flotando
    // encima del fondo de la atmósfera durante el resto de la secuencia.
    const frente = frenteDePolvo(1);
    for (const sitio of rejilla) {
      for (const azar of rejilla) {
        expect(
          vueloDeGrano(frente, turnoDeGrano(sitio, azar)),
          `grano rezagado al terminar (sitio ${sitio}, azar ${azar})`,
        ).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("el sitio SIGUE mandando: el barrido conserva su dirección", () => {
    // El desorden rompe la línea recta del frente, no la dirección. Si llegara a
    // taparla, el desintegrado dejaría de barrer y pasaría a ser un ruido que
    // aparece y desaparece por todas partes a la vez.
    for (const azar of rejilla) {
      expect(turnoDeGrano(0, azar)).toBeLessThan(turnoDeGrano(1, azar));
    }
    // Y el peor caso: el sitio más adelantado con el azar más lento todavía tiene
    // que ir por delante del sitio más atrasado con el azar más rápido... o no,
    // y ese solape ES el desorden. Lo que no puede es invertirse del todo.
    expect(turnoDeGrano(1, 0)).toBeGreaterThan(turnoDeGrano(0, 0));
  });
});

/**
 * `fasePolvo` es la FORMA del desintegrado: cuánto polvo hay en cada punto del
 * tramo. El resto del módulo pinta píxeles y necesita un navegador; esto es
 * aritmética pura, y es justo donde está la decisión de diseño.
 *
 * Que sea UNA función y la mueva UNA sola tween no es estilo. Con dos tweens
 * —una de armado y otra de deshecho— cada una se aparca en su valor de inicio o
 * de fin cuando el scroll está fuera de su tramo, y la de deshacer estaría
 * escribiendo "foto entera" durante todo el armado: la foto aparece de golpe
 * antes de tiempo, y solo a veces. Teniendo la forma aquí, se puede comprobar.
 */
describe("fasePolvo — la foto se arma, se queda quieta y se deshace", () => {
  it("empieza en polvo y termina en polvo", () => {
    expect(fasePolvo(0)).toBe(1);
    expect(fasePolvo(1)).toBe(1);
  });

  it("nunca se sale de 0..1", () => {
    // Sin el tope, un `scrub` que se pasa del final (rebote del navegador)
    // pediría "más que todo el polvo" y el degradado del frente se rompería.
    for (const t of [-0.5, -0.01, 0, 0.5, 1, 1.01, 2]) {
      const v = fasePolvo(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("HAY un tramo en el que la foto está entera y quieta", () => {
    // Es el único tramo del recorrido que no se puede recortar: sin ese
    // silencio, la foto de portada deja de ser una foto que se mira y pasa a ser
    // un efecto que se ve pasar.
    const quietos = muestras().filter(([, v]) => v === 0);
    expect(quietos.length, "la foto nunca llega a estar entera").toBeGreaterThan(8);
    const ts = quietos.map(([t]) => t);
    // Y es UN tramo seguido, no dos ratos sueltos.
    const hueco = ts.some((t, i) => i > 0 && t - ts[i - 1] > 0.011);
    expect(hueco, "el tramo quieto está partido en dos").toBe(false);
  });

  it("se arma sin volver atrás y se deshace sin volver atrás", () => {
    const m = muestras();
    const quietos = m.filter(([, v]) => v === 0).map(([t]) => t);
    const inicioQuieto = quietos[0];
    const finQuieto = quietos[quietos.length - 1];

    for (const [t, v] of m) {
      if (t >= inicioQuieto) break;
      const siguiente = fasePolvo(t + 0.01);
      expect(siguiente, `armando, retrocede en t=${t}`).toBeLessThanOrEqual(v);
    }
    for (const [t, v] of m) {
      if (t <= finQuieto) continue;
      const anterior = fasePolvo(t - 0.01);
      expect(v, `deshaciendo, retrocede en t=${t}`).toBeGreaterThanOrEqual(anterior);
    }
  });
});

/** El tramo muestreado de centésima en centésima. */
function muestras(): [number, number][] {
  return Array.from({ length: 101 }, (_, i) => {
    const t = i / 100;
    return [t, fasePolvo(t)] as [number, number];
  });
}
