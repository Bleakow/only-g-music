import { createAiClient } from "@only-g/ai-services";
import { auth } from "@/lib/firebase/config";

/**
 * Cliente de IA de Only G: mismo origen (baseUrl vacío) y adjuntando el ID token
 * de la sesión actual, que el servidor verifica antes de llamar al modelo.
 * `getIdToken()` devuelve el token cacheado y lo refresca solo si hace falta.
 * Hoy expone `improveBio` (mejorar biografía); comparte contratos con G Notes.
 */
export const aiClient = createAiClient({
  getToken: async () => (await auth.currentUser?.getIdToken()) ?? null,
});
