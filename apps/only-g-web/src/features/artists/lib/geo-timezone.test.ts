import { describe, it, expect } from "vitest";
import { countryFromClient, TIMEZONE_COVERAGE } from "./geo-timezone";

describe("countryFromClient", () => {
  it("resuelve por zona horaria", () => {
    expect(countryFromClient("America/Bogota")).toBe("CO");
    expect(countryFromClient("Europe/Madrid")).toBe("ES");
    expect(countryFromClient("America/New_York")).toBe("US");
    expect(countryFromClient("Asia/Tokyo")).toBe("JP");
  });

  it("varias zonas de un mismo país dan el mismo código", () => {
    for (const tz of [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Pacific/Honolulu",
    ]) {
      expect(countryFromClient(tz)).toBe("US");
    }
    expect(countryFromClient("Atlantic/Canary")).toBe("ES");
  });

  it("la zona MANDA sobre el locale: dice dónde estás, no qué hablas", () => {
    // Un colombiano viviendo en Madrid cuenta como España.
    expect(countryFromClient("Europe/Madrid", "es-CO")).toBe("ES");
  });

  it("cae al locale solo si la zona es desconocida", () => {
    expect(countryFromClient("Marte/Olympus", "pt-BR")).toBe("BR");
    expect(countryFromClient(undefined, "en-US")).toBe("US");
    expect(countryFromClient("", "es-MX")).toBe("MX");
  });

  it("un locale sin región no aporta país", () => {
    expect(countryFromClient(undefined, "es")).toBeNull();
    expect(countryFromClient("Marte/Olympus", "es")).toBeNull();
  });

  it("descarta regiones que no son ISO-2 (es-419 = Latinoamérica, no un país)", () => {
    expect(countryFromClient(undefined, "es-419")).toBeNull();
  });

  it("sin ninguna señal devuelve null en vez de inventarse un país", () => {
    expect(countryFromClient(null, null)).toBeNull();
    expect(countryFromClient(undefined, undefined)).toBeNull();
  });

  it("acepta guion bajo en el locale (es_CO)", () => {
    expect(countryFromClient(undefined, "es_CO")).toBe("CO");
  });

  it("la tabla cubre un número razonable de zonas", () => {
    expect(TIMEZONE_COVERAGE).toBeGreaterThan(150);
  });
});
