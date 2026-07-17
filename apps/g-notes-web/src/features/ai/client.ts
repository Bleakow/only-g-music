import { createAiClient } from "@only-g/ai-services";
import { auth } from "@/lib/firebase/config";

/**
 * Cliente de IA de G Notes: mismo origen (baseUrl vacío) y adjuntando el ID token
 * de la sesión actual, que el servidor verifica antes de llamar al modelo.
 * `getIdToken()` devuelve el token cacheado y lo refresca solo si hace falta.
 * Único cliente para toda la app (ghost-text y panel contextual).
 */
export const aiClient = createAiClient({
  getToken: async () => (await auth.currentUser?.getIdToken()) ?? null,
});
