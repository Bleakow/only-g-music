import type { Sede } from "@only-g/shared-types/sede";

/**
 * Sedes de Only G — DATOS PLACEHOLDER (direcciones/QR pendientes del cliente).
 * Reemplazar por los datos reales (idealmente moviéndolos a Firestore para que
 * el admin los edite). El acceso de la UI debería pasar por `sedes-repo`.
 */
export const sedes: Sede[] = [
  {
    id: "barranquilla",
    nombre: "Barranquilla",
    ciudad: "Barranquilla, Atlántico",
    direccion: "(Dirección pendiente)",
    horario: "Lun–Sáb · 10:00–20:00",
    slots: ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"],
    productores: [],
  },
  {
    id: "bogota",
    nombre: "Bogotá",
    ciudad: "Bogotá, Cundinamarca",
    direccion: "(Dirección pendiente)",
    horario: "Lun–Sáb · 10:00–20:00",
    slots: ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"],
    productores: [],
  },
];
