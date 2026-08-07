/**
 * Nombre artístico de un perfil, para los METADATOS del servidor.
 *
 * Va por la REST API pública de Firestore y no por el SDK ni por firebase-admin:
 * `generateMetadata` corre en el servidor, donde el SDK cliente no pinta nada, y
 * levantar el Admin SDK para leer un campo público de un documento público es
 * pagar una conexión por un título. Con `revalidate` de por medio, además, la
 * mayoría de las peticiones ni salen.
 *
 * Nunca lanza: sin red, sin perfil o con el proyecto mal configurado devuelve
 * cadena vacía y quien llama cae a su título de marca. Un `<title>` no es motivo
 * para tirar una página.
 */
export async function getArtisticName(slug: string): Promise<string> {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artistProfiles/${slug}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return "";
    const fields = (await res.json())?.fields ?? {};
    return (fields.artisticName?.stringValue as string) ?? "";
  } catch {
    return "";
  }
}
