import { DEFAULT_MODEL } from "@only-g/ai-services";

// Modelo de IA elegido por el usuario (global, persistido). Lo escribe el
// selector del cuaderno; lo leen el autocompletado (ghost) y el panel contextual
// al construir cada petición.

const KEY = "g-notes:model";
let current = DEFAULT_MODEL;

export function getModel(): string {
  return current;
}

export function setModel(id: string): void {
  current = id || DEFAULT_MODEL;
  try {
    localStorage.setItem(KEY, current);
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Carga el modelo guardado (llamar una vez al montar en cliente). */
export function loadModel(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) current = saved;
  } catch {
    /* almacenamiento no disponible */
  }
  return current;
}
