import { createAiClient, type AiClient } from "@only-g/ai-services";
import { auth } from "@/lib/firebase/config";
import { reportQuota } from "./quota";

/**
 * Cliente de IA de G Notes: mismo origen (baseUrl vacío) y adjuntando el ID token
 * de la sesión actual, que el servidor verifica antes de llamar al modelo.
 * `getIdToken()` devuelve el token cacheado y lo refresca solo si hace falta.
 * Único cliente para toda la app (ghost-text y panel contextual).
 */
const raw = createAiClient({
  getToken: async () => (await auth.currentUser?.getIdToken()) ?? null,
});

/**
 * Envoltura que reporta el CUPO freemium (`remaining`/`limited`) de cada
 * respuesta a un store observable — un único punto, así ni el ghost ni el panel
 * saben del cupo: solo llaman a la IA y el editor pinta el estado.
 */
export const aiClient: AiClient = {
  async complete(req, signal) {
    const res = await raw.complete(req, signal);
    reportQuota(res);
    return res;
  },
  async creative(req, signal) {
    const res = await raw.creative(req, signal);
    reportQuota(res);
    return res;
  },
  improveBio: raw.improveBio,
};
