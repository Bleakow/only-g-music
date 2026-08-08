import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import type { Atmosfera } from "@only-g/shared-types/book";
import type { DesintegradoId } from "@only-g/shared-types/book";
import {
  armandoEn,
  construirPolvo,
  fasePolvo,
  urlYaCargada,
} from "./desintegrar";
import { paramsDeRitmo, type ParamsRitmo } from "./ritmo";

/**
 * COREOGRAFÍA DEL BOOK (§10).
 *
 * Se carga con `import()` desde `BookView`, así que GSAP y sus plugins solo los
 * paga quien abre un book — no el perfil, no la vitrina, no la home.
 *
 * Tres reglas que no se negocian:
 *
 * 1. TODO dentro de un `gsap.context()` con `revert()` al desmontar. React monta
 *    dos veces en desarrollo (StrictMode) y sin revert un `gsap.from` deja los
 *    elementos con el estado inicial pegado — o sea, invisibles. Ya pasó antes.
 *
 * 2. `gsap.matchMedia()` con TRES ramas, no un interruptor. La de móvil no es
 *    la de escritorio recortada: la tira pasa a carrusel nativo (anclar scroll
 *    horizontal en un móvil es una pelea perdida) y la foto anclada pega arriba.
 *    Y la rama `reduce` cuenta LA MISMA historia solo con opacidad: quien pide
 *    menos movimiento no se queda sin book, se queda sin mareo.
 *
 * 3. Nada de esto puede ser necesario para entender el book. La línea base
 *    estática ya funciona sola; esto es lo que se le pone encima.
 *
 * El RITMO que eligió la modelo entra aquí como números. No es una librería de
 * scroll suave: son los mismos recorridos contados de otra manera.
 */

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Los números del ritmo viven en `./ritmo`, sin GSAP y sin DOM: la vitrina
 * también necesita saber cuánto dura y con qué curva se mueve algo, y no puede
 * pagar ScrollTrigger y SplitText para leer dos números.
 */
type Params = ParamsRitmo;

/** `scrub` para timelines que SIEMPRE van atadas al scroll (pin, revelados). */
const arrastre = (p: Params) => (p.scrub === false ? true : p.scrub);

const q = <T extends Element>(raiz: Element, sel: string) =>
  Array.from(raiz.querySelectorAll<T>(sel));

// ─────────────────────────────────────────────────────────────────────────────
// Escenas — escritorio y móvil (la coreografía completa)
// ─────────────────────────────────────────────────────────────────────────────

/** Registra trabajo de limpieza que `gsap.context` no sabe deshacer solo. */
type AlLimpiar = (fn: () => void) => void;

/**
 * LA APERTURA. Una sola timeline atada al recorrido de la escena, con tres
 * cosas pasando a la vez:
 *   · el nombre SE DISPERSA hacia arriba, letra a letra desde el centro,
 *   · la primera foto se DESENFOCA hasta desaparecer en el color de fondo,
 *   · las otras dos SUBEN desde abajo en diagonal, con un recorrido leve por
 *     dentro de sí mismas, y se colocan.
 *
 * El anclado NO lo hace GSAP: lo hace un `position: sticky` en el CSS. Así la
 * apertura ya se sostiene sin JavaScript —la foto se ve, el nombre se lee, las
 * otras dos están colocadas— y esto solo añade el viaje. Un `pin` de
 * ScrollTrigger habría metido un `.pin-spacer` en la primera pantalla del book,
 * que es el peor sitio para que algo se descoloque un fotograma.
 */
function apertura(
  escena: HTMLElement,
  p: Params,
  movil: boolean,
  alLimpiar: AlLimpiar,
  desintegrado: DesintegradoId,
) {
  const track = escena.querySelector<HTMLElement>(".og-book-apertura");
  if (!track) return;

  const nombre = escena.querySelector<HTMLElement>(".og-book-ap-nombre");
  const titulo = escena.querySelector<HTMLElement>(".og-book-titulo-portada");
  const pista = escena.querySelector<HTMLElement>(".og-book-pista");
  const principal = escena.querySelector<HTMLElement>(
    ".og-book-ap-principal .og-book-pieza > *",
  );
  const diagonales = q<HTMLElement>(escena, ".og-book-ap-diagonal");

  // Estado inicial de las dos que suben. Va AQUÍ y no en el CSS a propósito: si
  // arrancaran escondidas por hoja de estilos y este módulo no llegara nunca a
  // cargarse, la apertura se quedaría con dos fotos invisibles para siempre.
  //
  // `autoAlpha` y no `opacity`: estas dos fotos son BOTONES (se abren a pantalla
  // completa) y una opacidad de cero sigue recibiendo clics. `autoAlpha` apaga
  // también la visibilidad al llegar a cero, así que una foto que ya no está
  // tampoco se puede tocar — ni con el dedo ni con el tabulador.
  gsap.set(diagonales, { yPercent: 175, autoAlpha: 0 });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      scrub: arrastre(p),
    },
  });

  /**
   * Duración FIJA de 1: todo se coloca en 0..1 como si fuera el porcentaje del
   * recorrido. No es cosmético — las teselas del desintegrado se construyen
   * después (hay que esperar a que cargue la foto para saber su url real), y con
   * `scrub` GSAP reparte el scroll sobre la duración TOTAL de la timeline. Sin
   * este relleno, añadir tweens más tarde recalcularía el total y todo lo ya
   * colocado se desplazaría a mitad de scroll.
   */
  tl.to({}, { duration: 1 }, 0);

  // 1. El nombre se dispersa. Por CARACTERES y desde el centro: es lo que hace
  //    que se lea como "se dispersa" y no como "se va hacia arriba en bloque".
  if (titulo) {
    const split = new SplitText(titulo, { type: "chars" });
    tl.to(
      split.chars,
      {
        yPercent: -180,
        opacity: 0,
        ease: "none",
        duration: 0.16,
        stagger: { from: "center", amount: 0.05 },
      },
      0,
    );
    // `gsap.context` deshace los tweens, pero NO el DOM que SplitText partió:
    // hay que revertirlo a mano o el nombre se queda troceado en fragmentos.
    alLimpiar(() => split.revert());
  } else if (nombre) {
    tl.to(
      nombre.children,
      { yPercent: -180, opacity: 0, ease: "none", duration: 0.16 },
      0,
    );
  }

  if (pista) tl.to(pista, { opacity: 0, ease: "none", duration: 0.1 }, 0);

  /**
   * 1b. LOS TEXTOS DE LAS ESQUINAS se van cada uno POR SU ESQUINA, abriéndose
   * hacia fuera. Es a propósito distinto del nombre: ese se dispersa hacia
   * arriba, y si las esquinas hicieran lo mismo la pantalla entera se iría en
   * bloque en vez de leerse como dos cosas. Aquí el marco se abre y la foto
   * queda sola, que es justo lo que va a pasar a continuación.
   */
  const esquinas = q<HTMLElement>(escena, ".og-book-meta > *");
  esquinas.forEach((el, i) => {
    const haciaFin = i % 2 === 1; // 0,2 = lado de inicio · 1,3 = lado de fin
    const haciaAbajo = i > 1;
    tl.to(
      el,
      {
        x: haciaFin ? 120 : -120,
        y: haciaAbajo ? 60 : -60,
        opacity: 0,
        ease: "none",
        duration: 0.15,
      },
      0.02,
    );
  });

  // 2. La foto que abre se desenfoca hasta dejar ver el fondo de la atmósfera.
  //    La escala acompaña: un desenfoque sin movimiento se lee como un fallo de
  //    carga, no como una transición.
  if (principal) {
    tl.to(
      principal,
      {
        filter: "blur(42px)",
        scale: 1.14,
        opacity: 0,
        ease: "none",
        duration: 0.28,
      },
      0.06,
    );
  }

  // 3. Las dos suben, se colocan… y se van cuando llega la de portada.
  if (diagonales.length) {
    tl.to(
      diagonales,
      {
        yPercent: 0,
        autoAlpha: 1,
        ease: "none",
        duration: 0.26,
        stagger: 0.05,
      },
      0.14,
    );

    // 4. El recorrido leve POR DENTRO de cada foto. La escala la pone la propia
    //    tween y no el CSS: en reposo la imagen encaja exacta, y solo se amplía
    //    mientras hay viaje — si no, habría bordes vacíos al desplazarla.
    diagonales.forEach((d, i) => {
      const img = d.querySelector<HTMLElement>(".og-book-pieza > *");
      if (!img) return;
      tl.fromTo(
        img,
        { yPercent: -6, scale: 1.16 },
        { yPercent: 6, scale: 1.16, ease: "none", duration: 0.42 },
        0.14 + i * 0.04,
      );
    });

    // Salen hacia los lados para dejar el centro libre: la de portada va
    // centrada, y con las dos diagonales todavía puestas competirían por el ojo.
    diagonales.forEach((d, i) => {
      tl.to(
        d,
        {
          xPercent: i === 0 ? -60 : 60,
          autoAlpha: 0,
          ease: "none",
          duration: 0.12,
        },
        0.46,
      );
    });
  }

  // 5. LA FOTO DE PORTADA: se arma desintegrándose y se deshace igual.
  //    Es asíncrono porque hay que esperar a que la foto cargue para saber qué
  //    url está usando de verdad. Por eso la timeline tiene duración fija: lo
  //    que se añade aquí llega tarde y no puede recolocar lo de arriba.
  montarPortada(escena, tl, alLimpiar, desintegrado);

  // En móvil la diagonal es más estrecha y el viaje, más corto: recorrer 175%
  // en una pantalla alta se siente lento aunque dure lo mismo.
  if (movil) tl.timeScale(1);
}

/**
 * La cuarta capa de la apertura. Se separa de `apertura` porque es lo único
 * asíncrono de toda la coreografía y mezclarlo dentro convertiría una función
 * lineal en una madeja de condicionales.
 */
function montarPortada(
  escena: HTMLElement,
  tl: gsap.core.Timeline,
  alLimpiar: AlLimpiar,
  desintegrado: DesintegradoId,
) {
  const marco = escena.querySelector<HTMLElement>(".og-book-ap-portada-marco");
  const capa = escena.querySelector<HTMLElement>(".og-book-desint");
  const plena = escena.querySelector<HTMLElement>(".og-book-ap-portada-plena");
  const texto = escena.querySelector<HTMLElement>(".og-book-ap-portada-texto");
  const img = plena?.querySelector("img");
  if (!marco || !capa || !plena || !img) return;

  // El texto entra con la foto y se va antes que ella: leerlo mientras la foto
  // ya se deshace es pedirle al ojo dos cosas a la vez.
  if (texto) {
    tl.fromTo(
      texto,
      { y: 26, opacity: 0 },
      { y: 0, opacity: 1, ease: "none", duration: 0.09 },
      0.58,
    );
    tl.to(texto, { y: -20, opacity: 0, ease: "none", duration: 0.06 }, 0.76);
  }

  let cancelado = false;
  let polvo: { destruir(): void } | null = null;
  alLimpiar(() => {
    cancelado = true;
    polvo?.destruir();
  });

  void urlYaCargada(img)
    .then((url) =>
      url ? construirPolvo(marco, capa, img, url, desintegrado) : null,
    )
    .then((p) => {
      if (cancelado || !p) return;
      polvo = p;

      // La foto del DOM se apaga en cuanto el lienzo existe: mientras el motor
      // no ha llegado —o si el lienzo falla y devuelve `null`— es lo unico que
      // se ve, y es una foto perfecta. El desintegrado es un adorno; la foto no.
      gsap.set(plena, { opacity: 0 });

      /**
       * UNA SOLA TWEEN para todo el tramo, y la forma —se arma, se queda, se
       * deshace— la pone `fasePolvo`.
       *
       * Con dos tweens (una de armado y otra de deshecho) esto se rompe de una
       * manera que solo aparece a veces: con `scrub`, una tween fuera de su
       * tramo NO se queda quieta, se aparca en su valor de inicio o de fin. La
       * de deshacer estaría escribiendo "foto entera" durante todo el armado, y
       * gana la que se renderiza después. Resultado: la foto aparece de golpe
       * antes de tiempo. Con una sola tween solo hay un dueño del estado.
       */
      const estado = { t: 0 };
      tl.fromTo(
        estado,
        { t: 0 },
        {
          t: 1,
          ease: "none",
          duration: 0.54,
          // La CANTIDAD de polvo y CON QUÉ VUELO se pinta son dos preguntas
          // distintas: a mitad de recorrido hay el mismo polvo yendo que
          // viniendo, y sin embargo la foto se posa de una manera y se la lleva
          // el viento de otra.
          onUpdate: () =>
            p.pintar(fasePolvo(estado.t), armandoEn(estado.t)),
        },
        0.46,
      );
    });
}

/** A sangre: se abre como un telón y la imagen respira por dentro. */
function plena(escena: HTMLElement, p: Params) {
  const figura = escena.querySelector<HTMLElement>(".og-book-figura");
  const media = escena.querySelector<HTMLElement>(".og-book-pieza > *");
  if (figura) {
    gsap.fromTo(
      figura,
      { clipPath: "inset(14% 8% round 1rem)" },
      {
        clipPath: "inset(0% 0% round 0rem)",
        ease: "none",
        scrollTrigger: {
          trigger: escena,
          start: "top 85%",
          end: "top 25%",
          scrub: arrastre(p),
        },
      },
    );
  }
  if (media) {
    // El parallax va DENTRO del marco: la imagen se mueve, el hueco no. Moverlo
    // todo abriría huecos entre escenas.
    gsap.fromTo(
      media,
      { yPercent: -6 },
      {
        yPercent: 6,
        ease: "none",
        scrollTrigger: {
          trigger: escena,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      },
    );
  }
}

/** Díptico: una sube, la otra baja. Es lo que lo convierte en díptico. */
function diptico(escena: HTMLElement, p: Params) {
  const figuras = q<HTMLElement>(escena, ".og-book-figura");
  figuras.forEach((fig, i) => {
    gsap.fromTo(
      fig,
      { y: i % 2 === 0 ? p.recorrido * 0.5 : -p.recorrido * 0.5 },
      {
        y: i % 2 === 0 ? -p.recorrido * 0.5 : p.recorrido * 0.5,
        ease: "none",
        scrollTrigger: {
          trigger: escena,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      },
    );
  });
}

/**
 * METRAJE: el clip entra DESDE EL BORDE al que está pegado —se descubre de
 * izquierda a derecha, como si asomara por fuera de la pantalla— y su
 * descripción SE ENCIENDE PALABRA A PALABRA mientras se baja.
 *
 * El texto se revela con `scrub` y no con una entrada de golpe porque es la
 * petición literal ("se va revelando progresivamente al llegar al vídeo") y
 * porque es lo que hace que se LEA: el ojo sigue a la palabra que se enciende en
 * vez de encontrarse un párrafo entero de una vez y saltárselo.
 *
 * Las palabras van de casi apagadas a encendidas, nunca de invisibles: un texto
 * que aparece de la nada obliga a releer desde el principio, y un párrafo con
 * huecos no se puede seleccionar ni buscar. Lo que cambia es el foco, no si el
 * texto existe.
 */
function metraje(escena: HTMLElement, p: Params, alLimpiar: AlLimpiar) {
  const figura = escena.querySelector<HTMLElement>(".og-book-figura");
  if (figura) {
    // Las dos formas con los CUATRO valores: `inset(0 100% 0 0)` e `inset(0)`
    // tienen distinto número de componentes y hay motores que se niegan a
    // interpolar entre ellas. Es la misma cautela que ya lleva el índice.
    gsap.fromTo(
      figura,
      { clipPath: "inset(0% 100% 0% 0%)" },
      {
        clipPath: "inset(0% 0% 0% 0%)",
        ease: "none",
        scrollTrigger: {
          trigger: escena,
          start: "top 92%",
          end: "top 38%",
          scrub: arrastre(p),
        },
      },
    );
  }

  const nota = escena.querySelector<HTMLElement>(".og-book-pie-nota");
  if (!nota) return;

  const split = new SplitText(nota, { type: "words" });
  // `gsap.context` deshace los tweens pero NO el DOM que SplitText partió: sin
  // esto el párrafo se queda troceado en `<div>`s al desmontar.
  alLimpiar(() => split.revert());

  gsap.fromTo(
    split.words,
    { opacity: 0.16 },
    {
      opacity: 1,
      ease: "none",
      duration: 0.6,
      // El relevo corto respecto a la duración deja varias palabras encendidas a
      // la vez: es una luz que recorre el párrafo, no un teletipo.
      stagger: { each: 0.05, from: "start" },
      scrollTrigger: {
        trigger: escena,
        start: "top 74%",
        end: "bottom 80%",
        scrub: true,
      },
    },
  );
}

/**
 * PLIEGO: dos o cuatro fotos que entran y salen. Nada más — es el respiro entre
 * el arranque y lo que monte cada modelo.
 *
 * UNA SOLA TIMELINE por foto, y no dos tweens sueltos. Con `scrub`, un tween
 * fuera de su tramo no se queda quieto: se aparca en su valor de inicio o de
 * fin. Así que un tween de salida creado después del de entrada estaría
 * escribiendo `opacity: 1` durante toda la entrada y pisándola — el de después
 * manda. Dentro de una timeline solo hay un dueño de la propiedad y el problema
 * no existe.
 */
function pliego(escena: HTMLElement, p: Params) {
  const figuras = q<HTMLElement>(escena, ".og-book-figura");
  figuras.forEach((fig) => {
    gsap
      .timeline({
        scrollTrigger: {
          // El disparador es LA FOTO, no la escena: en el cuadro de 2×2 la fila
          // de abajo entra media pantalla después que la de arriba, y atarlas a
          // la escena las haría moverse a la vez desde sitios distintos.
          trigger: fig,
          start: "top bottom",
          end: "bottom top",
          scrub: arrastre(p),
        },
      })
      .fromTo(
        fig,
        { yPercent: 12, scale: 0.94, opacity: 0 },
        {
          yPercent: 0,
          scale: 1,
          opacity: 1,
          ease: "none",
          duration: 0.3,
        },
        0,
      )
      .to(
        fig,
        {
          yPercent: -12,
          scale: 0.94,
          opacity: 0,
          ease: "none",
          duration: 0.28,
        },
        0.72,
      );
  });
}

/** Foto anclada: el `sticky` lo hace el CSS; aquí solo desfilan los textos. */
function ancla(escena: HTMLElement, p: Params) {
  const notas = q<HTMLElement>(escena, ".og-book-notas > *");
  if (!notas.length) return;
  notas.forEach((nota) => {
    gsap.from(nota, {
      y: p.recorrido * 0.4,
      opacity: 0,
      duration: p.duracion,
      ease: p.ease,
      scrollTrigger: { trigger: nota, start: "top 85%" },
    });
  });
}

/** Rejilla: entran una detrás de otra, del desenfoque a la nitidez. */
function rejilla(escena: HTMLElement, p: Params) {
  const figuras = q<HTMLElement>(escena, ".og-book-figura");
  if (!figuras.length) return;
  gsap.from(figuras, {
    y: p.recorrido * 0.6,
    opacity: 0,
    filter: "blur(12px)",
    duration: p.duracion,
    ease: p.ease,
    stagger: 0.12,
    scrollTrigger: { trigger: escena, start: "top 88%" },
  });
}

/** Retrato: la foto se descubre de abajo arriba y la nota la sigue. */
function retrato(escena: HTMLElement, p: Params) {
  const figura = escena.querySelector<HTMLElement>(".og-book-figura");
  if (figura) {
    gsap.from(figura, {
      clipPath: "inset(100% 0% 0% 0%)",
      duration: p.duracion * 1.2,
      ease: p.ease,
      scrollTrigger: { trigger: escena, start: "top 82%" },
    });
  }
  const pie = escena.querySelector<HTMLElement>("figcaption");
  if (pie) {
    gsap.from(pie, {
      y: 24,
      opacity: 0,
      duration: p.duracion,
      ease: p.ease,
      scrollTrigger: { trigger: escena, start: "top 70%" },
    });
  }
}

/**
 * SERIE. Ya no ancla el scroll: se reportó como "en escritorio es muy torpe", y
 * lo era. Anclar la página para mover una fila de lado le quita al visitante el
 * control de su propio scroll, y encima obliga a adivinar cuánto queda — no hay
 * barra, no hay gesto, solo una fila que se desplaza sola mientras bajas.
 *
 * Ahora la fila se AGARRA con el ratón (`useArrastreLateral`) y se desliza con el
 * dedo en el móvil, que es el mismo gesto en los dos sitios. Aquí solo queda la
 * entrada, que es lo que GSAP hace bien: las fotos llegan una detrás de otra
 * desde el lado por el que se va a seguir tirando.
 */
function tira(escena: HTMLElement, p: Params) {
  const figuras = q<HTMLElement>(escena, ".og-book-figura");
  if (!figuras.length) return;
  gsap.from(figuras, {
    xPercent: 26,
    opacity: 0,
    duration: p.duracion,
    ease: p.ease,
    stagger: 0.09,
    scrollTrigger: { trigger: escena, start: "top 84%" },
  });
}

/**
 * Índice: las fichas entran una detrás de otra. NO se toca el revelado del
 * hover —ese es CSS puro a propósito: un hover que depende de un módulo cargado
 * por red se siente roto justo en los primeros segundos, que es cuando alguien
 * pasa el ratón por encima.
 */
function indice(escena: HTMLElement, p: Params) {
  const figuras = q<HTMLElement>(escena, ".og-book-figura");
  if (!figuras.length) return;
  gsap.from(figuras, {
    y: p.recorrido * 0.5,
    opacity: 0,
    duration: p.duracion,
    ease: p.ease,
    stagger: 0.1,
    scrollTrigger: { trigger: escena, start: "top 85%" },
  });
}

/**
 * Vitrina: solo la ENTRADA por scroll. El cambio de carta lo gobierna el CSS
 * —responde a un toque, no al scroll— y es a propósito: así es reversible y no
 * se queda a medias si este módulo no llega.
 *
 * OJO con las CARTAS: su `transform` es el sitio que ocupan, y lo pone el CSS.
 * Animarlo aquí se lo arrebataría a la transición, y la vitrina dejaría de poder
 * cambiar de carta. Por eso solo entran el escenario entero y los textos.
 */
/**
 * De dónde entra cada carta y cuándo. Por ÍNDICE EN EL DOM y no por el sitio
 * que ocupa: el sitio es estado de React y cambia con cada toque, el índice no
 * cambia nunca. Dos por la izquierda y una por la derecha, como pide el brief.
 *
 * `en` es el retardo dentro de la entrada. La del frente sale la ÚLTIMA y viaja
 * lo más lejos: primero se llenan los lados y luego aterriza la protagonista,
 * que es donde queda mirando el ojo.
 */
const ENTRADA_VITRINA = {
  ancho: [
    { x: "-78vw", y: 40, rot: -12, en: 0.2 }, // 0 · frente — cruza la escena
    { x: "-62vw", y: 58, rot: -19, en: 0 }, // 1 · izquierda
    { x: "70vw", y: 52, rot: 16, en: 0.08 }, // 2 · derecha, ella sola
  ],
  /**
   * En estrecho ARRANCAN MÁS CERCA, y no por prudencia. La carta del frente mide
   * media pantalla de ancho: saliendo desde -78vw se pasaba casi todo el vuelo
   * fuera del móvil y lo poco que se veía era el final. Se reportó tal cual —
   * "las fotos están muy lejos y el efecto es muy rápido". Desde -52vw ya asoma
   * por el borde al empezar, así que el recorrido se ve ENTERO.
   *
   * Las de los lados llevan más número por una razón que engaña: su padre está
   * al 56% y 60%, y el navegador escala también la traslación del hijo. 58vw
   * ahí dentro son 32vw en pantalla.
   */
  estrecho: [
    { x: "-52vw", y: 32, rot: -10, en: 0.22 },
    { x: "-58vw", y: 46, rot: -16, en: 0 },
    { x: "62vw", y: 40, rot: 14, en: 0.1 },
  ],
};

/**
 * Vitrina: la ENTRADA de las cartas y la de sus textos. El cambio de carta lo
 * gobierna el CSS —responde a un toque, no al scroll— y es a propósito: así es
 * reversible y no se queda a medias si este módulo no llega.
 *
 * LA ENTRADA ARRANCA EN CUANTO LA ESCENA ASOMA (`top bottom`), que es
 * exactamente el instante en que la foto de portada termina de desintegrarse
 * arriba. Antes empezaba en `top 80%` y entre una cosa y otra quedaba una
 * pantalla entera de nada — el recorrido muerto que se reportó. Ahora ese hueco
 * ES la entrada: las tres cartas lo cruzan volando.
 *
 * Y VAN EN CURVA, no en línea recta. El truco es darle a cada eje su propia
 * curva de tiempo: la carta avanza de lado antes de terminar de subir, así que
 * el camino se comba. Con un solo tween para los dos ejes, GSAP interpola en
 * línea recta y lo que se ve es una foto deslizándose, no volando.
 *
 * OJO con las CARTAS: su `transform` es el sitio que ocupan y lo pone el CSS.
 * Animarlo aquí se lo arrebataría a la transición y la vitrina dejaría de poder
 * cambiar de carta. Por eso todo esto va sobre la capa INTERIOR.
 */
function vitrina(escena: HTMLElement, p: Params, movil: boolean) {
  // El disparador es el ESCENARIO, no la escena. La escena incluye el título y
  // la cita, y su alto cambia muchísimo entre móvil (todo apilado) y escritorio
  // (texto al lado): anclando a la escena, las cartas aterrizaban centradas en
  // escritorio y por debajo del borde inferior en móvil. El escenario mide lo
  // mismo en proporción en los dos sitios, así que el encuadre sale igual.
  const pista =
    escena.querySelector<HTMLElement>(".og-book-vit-escenario") ?? escena;

  const textos = q<HTMLElement>(
    escena,
    ".og-book-vit-titulo, .og-book-vit-cita",
  );
  if (textos.length) {
    gsap.from(textos, {
      y: p.recorrido * 0.35,
      opacity: 0,
      duration: p.duracion,
      ease: p.ease,
      stagger: 0.08,
      // Justo antes de que aterricen las cartas: el título llega cuando ya hay
      // algo que titular. Sin `scrub` a propósito — un texto que va y viene con
      // el scroll se lee dos veces y no se termina de leer ninguna.
      scrollTrigger: { trigger: pista, start: "top 78%" },
    });
  }

  const cuerpos = q<HTMLElement>(escena, ".og-book-vit-cuerpo");
  if (!cuerpos.length) return;

  const entrada = gsap.timeline({
    scrollTrigger: {
      trigger: pista,
      // En cuanto el escenario asoma por abajo. Es el relevo con el desintegrado
      // de la apertura, que termina exactamente ahí.
      start: "top bottom",
      // Y aterrizan con el escenario ya encuadrado. Si acabaran más tarde, el
      // final del vuelo pillaría la vitrina a medio salir por arriba.
      //
      // En estrecho el recorrido es MÁS LARGO (el escenario sube hasta el 32% de
      // la pantalla en vez de quedarse en el 58%). Es lo que arregla el "efecto
      // muy rápido": el vuelo dura lo que dura el scroll que lo arrastra, así
      // que la única forma de darle tiempo es darle recorrido. Y el scroll que
      // cuesta se paga de sobra con las pantallas que se le quitaron arriba a la
      // apertura.
      end: movil ? "center 32%" : "center 58%",
      scrub: arrastre(p),
    },
  });

  const desde = movil ? ENTRADA_VITRINA.estrecho : ENTRADA_VITRINA.ancho;

  cuerpos.forEach((cuerpo, i) => {
    const d = desde[i % desde.length];
    // El desplazamiento va en `vw` y no en porcentaje de la carta: las cartas de
    // los lados llegan al 56% de tamaño y su padre escala también la traslación,
    // así que un porcentaje de sí mismas dejaba a dos de las tres empezando
    // dentro de la pantalla — "aparecen de los laterales" y no aparecían de
    // ninguna parte, se materializaban sobre el título.
    entrada.fromTo(
      cuerpo,
      { x: d.x },
      {
        x: 0,
        // En estrecho, una curva menos frontal. `power2.out` se come la mitad
        // del recorrido en el primer 25% del vuelo, y en una pantalla pequeña
        // eso es justo el tramo que pasa fuera: se veía llegar, no volar.
        ease: movil ? "power1.out" : "power2.out",
        duration: 0.8,
      },
      d.en,
    );
    entrada.fromTo(
      cuerpo,
      { yPercent: d.y },
      { yPercent: 0, ease: "power2.in", duration: 0.8 },
      d.en,
    );
    entrada.fromTo(
      cuerpo,
      { rotation: d.rot, scale: 0.68, opacity: 0 },
      {
        rotation: 0,
        scale: 1,
        opacity: 1,
        ease: "power1.out",
        duration: 0.62,
      },
      d.en,
    );
  });
}

/** Cierre: aparece sin ceremonia. Es una despedida, no otro número. */
function cierre(escena: HTMLElement, p: Params) {
  const sobre = escena.querySelector<HTMLElement>(".og-book-sobre");
  if (!sobre) return;
  gsap.from(sobre, {
    y: p.recorrido * 0.4,
    opacity: 0,
    duration: p.duracion,
    ease: p.ease,
    scrollTrigger: { trigger: escena, start: "top 80%" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Montaje
// ─────────────────────────────────────────────────────────────────────────────

type Coreografia = (
  escena: HTMLElement,
  p: Params,
  movil: boolean,
  alLimpiar: AlLimpiar,
  desintegrado: DesintegradoId,
) => void;

const POR_TIPO: Record<string, Coreografia> = {
  portada: apertura,
  plena: (e, p) => plena(e, p),
  diptico: (e, p) => diptico(e, p),
  ancla: (e, p) => ancla(e, p),
  rejilla: (e, p) => rejilla(e, p),
  indice: (e, p) => indice(e, p),
  // La tira ya no es un caso aparte: su recorrido lo lleva el dedo o el ratón,
  // y aquí solo entra como cualquier otra escena.
  tira: (e, p) => tira(e, p),
  vitrina: (e, p, movil) => vitrina(e, p, movil),
  metraje: (e, p, _movil, alLimpiar) => metraje(e, p, alLimpiar),
  pliego: (e, p) => pliego(e, p),
  retrato: (e, p) => retrato(e, p),
  cierre: (e, p) => cierre(e, p),
};

/**
 * Monta la coreografía sobre un book ya renderizado. Devuelve la función de
 * limpieza — llamarla es OBLIGATORIO al desmontar.
 */
export function montarCoreografia(
  raiz: HTMLElement,
  atmosfera: Atmosfera,
): () => void {
  const p = paramsDeRitmo(atmosfera.ritmo);
  const pendientes: (() => void)[] = [];
  const alLimpiar: AlLimpiar = (fn) => pendientes.push(fn);

  /**
   * Las piezas del book llegan tarde (lazy load) y cada una que aterriza cambia
   * el alto de la página. Sin recalcular, los disparadores de las escenas de
   * abajo apuntan a donde el contenido ESTABA. En captura porque el `load` de
   * una `<img>` no burbujea, y agrupado porque en una rejilla llegan cuatro
   * seguidas y no hacen falta cuatro recálculos.
   */
  let agrupado: number | undefined;
  const alCargarMedia = () => {
    window.clearTimeout(agrupado);
    agrupado = window.setTimeout(() => ScrollTrigger.refresh(), 140);
  };
  raiz.addEventListener("load", alCargarMedia, true);
  raiz.addEventListener("loadeddata", alCargarMedia, true);

  const ctx = gsap.context(() => {
    const mm = gsap.matchMedia();

    mm.add(
      {
        ancho: "(min-width: 768px)",
        estrecho: "(max-width: 767px)",
        reduce: "(prefers-reduced-motion: reduce)",
      },
      (contexto) => {
        const { ancho, reduce } = contexto.conditions as {
          ancho: boolean;
          estrecho: boolean;
          reduce: boolean;
        };

        const escenas = q<HTMLElement>(raiz, ".og-book-escena");

        // MENOS MOVIMIENTO. No es apagar la coreografía: es contarla con lo
        // único que no marea. Se recorre el book entero y no falta nada.
        if (reduce) {
          escenas.forEach((escena) => {
            gsap.from(escena, {
              opacity: 0,
              duration: 0.4,
              ease: "none",
              scrollTrigger: { trigger: escena, start: "top 90%" },
            });
          });
          return;
        }

        escenas.forEach((escena) => {
          const tipo = escena.dataset.tipo ?? "";
          POR_TIPO[tipo]?.(escena, p, !ancho, alLimpiar, atmosfera.desintegrado);
        });
      },
    );

    return () => mm.revert();
  }, raiz);

  return () => {
    window.clearTimeout(agrupado);
    raiz.removeEventListener("load", alCargarMedia, true);
    raiz.removeEventListener("loadeddata", alCargarMedia, true);
    // Primero lo que GSAP no sabe deshacer (el DOM partido por SplitText) y
    // luego el contexto: al revés, el revert del contexto trabajaría sobre unos
    // nodos que están a punto de desaparecer.
    pendientes.forEach((fn) => fn());
    ctx.revert();
  };
}
