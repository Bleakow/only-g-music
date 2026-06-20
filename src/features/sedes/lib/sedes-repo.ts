/**
 * Capa de acceso a datos de sedes. Hoy lee de datos semilla; al migrar a
 * Firestore solo cambia la implementación — la UI no se entera.
 */
import type { Sede, SedeId } from "@/domain/sede";
import { sedes } from "../data/sedes";

export async function getAllSedes(): Promise<Sede[]> {
  return sedes;
}

export async function getSedeById(id: SedeId): Promise<Sede | null> {
  return sedes.find((s) => s.id === id) ?? null;
}
