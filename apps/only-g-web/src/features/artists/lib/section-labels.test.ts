import { describe, it, expect } from "vitest";
import { PROFILE_SECTIONS } from "@only-g/shared-types/profile-sections";

/**
 * El catálogo de secciones (§05) vive en shared-types y sus NOMBRES en los
 * catálogos de i18n. TypeScript no ata las dos mitades: añadir una sección
 * compila perfectamente sin traducirla, y entonces el gestor del editor pinta la
 * ruta de la clave —`sections.item.book`— en vez del nombre.
 *
 * Ese fallo además se disfraza: la primera sospecha siempre es "falta la clave",
 * cuando muchas veces es el catálogo cacheado del dev server. Mejor que salte
 * aquí, donde no hay caché que valga.
 *
 * Mismo trato que `gallery-css.test.ts` le da a los nombres de las plantillas.
 */
describe("nombres de las secciones del perfil", () => {
  it("cada sección del catálogo tiene nombre en es y en", async () => {
    const es = (await import("../../../../messages/es.json")).default;
    const en = (await import("../../../../messages/en.json")).default;
    const items = {
      es: es.sections.item as Record<string, string>,
      en: en.sections.item as Record<string, string>,
    };

    for (const { id } of PROFILE_SECTIONS) {
      expect(items.es[id], `falta es.sections.item.${id}`).toBeTruthy();
      expect(items.en[id], `falta en.sections.item.${id}`).toBeTruthy();
    }
  });

  it("no sobran nombres de secciones que ya no existen", async () => {
    // Un nombre huérfano es una sección que se retiró a medias: nadie lo ve, y
    // el siguiente que lea el catálogo creerá que esa sección sigue viva.
    const ids = new Set<string>(PROFILE_SECTIONS.map((s) => s.id));
    const es = (await import("../../../../messages/es.json")).default;
    for (const clave of Object.keys(es.sections.item)) {
      expect(ids.has(clave), `sobra es.sections.item.${clave}`).toBe(true);
    }
  });
});
