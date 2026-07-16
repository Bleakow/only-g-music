import { ImageResponse } from "next/og";

/**
 * Imagen OG dinámica por perfil de artista (lo que se ve al compartir el enlace
 * en WhatsApp/redes). Lee el perfil PÚBLICO vía la REST API de Firestore (sin
 * SDK: la lectura de artistProfiles es pública por reglas). Si no hay perfil real
 * (slug semilla / sin datos), cae a la tarjeta de marca. Tipografía/colores con
 * el acento del artista para que cada tarjeta sea suya.
 */
export const alt = "Perfil de artista — Only G Music";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;

  let name = "Only G Music";
  let genre = "";
  let accent = "#8b5cf6";
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artistProfiles/${slug}`,
      { next: { revalidate: 300 } },
    );
    if (res.ok) {
      const fields = (await res.json())?.fields ?? {};
      name = fields.artisticName?.stringValue || name;
      genre = fields.genre?.stringValue || "";
      accent = fields.accent?.stringValue || accent;
    }
  } catch {
    /* sin red o sin perfil: se queda la tarjeta de marca */
  }

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        width: "100%",
        height: "100%",
        padding: "72px",
        backgroundImage: "linear-gradient(135deg, #0b0b0f 0%, #16101f 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "128px",
          height: "10px",
          borderRadius: "9999px",
          backgroundColor: accent,
          marginBottom: "28px",
        }}
      />
      {genre ? (
        <div
          style={{
            display: "flex",
            color: accent,
            fontSize: "32px",
            letterSpacing: "6px",
          }}
        >
          {genre.toUpperCase()}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          color: "#ffffff",
          fontSize: "96px",
          fontWeight: 800,
          lineHeight: 1.05,
        }}
      >
        {name}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: "24px",
          color: "rgba(255,255,255,0.65)",
          fontSize: "30px",
          letterSpacing: "4px",
        }}
      >
        ONLY G MUSIC
      </div>
    </div>,
    { ...size },
  );
}
