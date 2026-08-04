import { describe, it, expect } from "vitest";
import {
  ARTES_AUTOSERVICIO,
  ARTES_CON_CONVENIO,
  TALENT_ROLES,
  esArteAutoservicio,
} from "./user";

describe("partición de las artes", () => {
  it("cada arte cae en exactamente un lado", () => {
    // Si mañana se añade un arte a TALENT_ROLES y se olvida clasificarla, este
    // test cae. Importa: sin clasificar no saldría en la ventana de "Perfiles y
    // convenios" ni por autoservicio ni como solicitud — sería invisible.
    expect([...ARTES_AUTOSERVICIO, ...ARTES_CON_CONVENIO].sort()).toEqual(
      [...TALENT_ROLES].sort(),
    );
  });

  it("ninguna arte está en los dos lados", () => {
    const solapadas = ARTES_AUTOSERVICIO.filter((r) =>
      ARTES_CON_CONVENIO.includes(r),
    );
    expect(solapadas).toEqual([]);
  });

  it("beatmaker y modelo NO son autoservicio", () => {
    // beatmaker marca el perfil como socio (exento de membresía): dejarlo a un
    // clic sería regalar perfiles publicados.
    expect(esArteAutoservicio("beatmaker")).toBe(false);
    expect(esArteAutoservicio("modelo")).toBe(false);
  });

  it("las presentacionales sí son autoservicio", () => {
    expect(esArteAutoservicio("artista")).toBe(true);
    expect(esArteAutoservicio("bailarin")).toBe(true);
    expect(esArteAutoservicio("dj")).toBe(true);
    expect(esArteAutoservicio("presentador")).toBe(true);
  });

  it("los roles que no son de talento no son artes autoservicio", () => {
    expect(esArteAutoservicio("admin")).toBe(false);
    expect(esArteAutoservicio("ceo")).toBe(false);
    expect(esArteAutoservicio("productor")).toBe(false);
    expect(esArteAutoservicio("cliente")).toBe(false);
  });
});
