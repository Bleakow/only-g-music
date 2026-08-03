/**
 * Cliente de la BÚSQUEDA IA del directorio (§03). Llama al endpoint server-side
 * (que lee las fichas privadas y cruza con Gemini) y devuelve los slugs de los
 * perfiles que encajan. Sin auth: la búsqueda es pública. Best-effort: ante
 * cualquier fallo devuelve vacío para que la UI caiga a su filtro de texto.
 */
export interface ArtistSearchResult {
  slugs: string[];
  source: "ai" | "stub";
}

export async function searchArtistsAI(
  query: string,
  signal?: AbortSignal,
): Promise<ArtistSearchResult> {
  const q = query.trim();
  if (q.length < 2) return { slugs: [], source: "stub" };
  try {
    const res = await fetch("/api/ai/artistas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: q }),
      signal,
    });
    if (!res.ok) return { slugs: [], source: "stub" };
    return (await res.json()) as ArtistSearchResult;
  } catch {
    return { slugs: [], source: "stub" };
  }
}
