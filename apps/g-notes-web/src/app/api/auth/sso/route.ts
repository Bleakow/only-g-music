import type { NextRequest } from "next/server";
import { mintCustomToken } from "@/lib/firebase/admin";

// Intercambio de sesión (SSO hand-off desde Only G Music). Recibe el ID token que
// la app hermana adjunta en el fragmento de la URL, lo verifica server-side y
// devuelve un custom token con el que G Notes inicia sesión sin re-login.
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<Response> {
  let idToken: string | undefined;
  try {
    idToken = ((await req.json()) as { idToken?: string }).idToken;
  } catch {
    idToken = undefined;
  }
  if (!idToken) return json({ error: "missing_token" }, 400);

  const customToken = await mintCustomToken(idToken);
  if (!customToken) return json({ error: "invalid_token" }, 401);

  return json({ customToken });
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
