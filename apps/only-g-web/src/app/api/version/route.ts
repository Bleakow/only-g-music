import { NextResponse } from "next/server";

// Nunca cachear: cada petición debe reflejar el build ACTUALMENTE desplegado,
// para que un cliente con una pestaña vieja detecte que hay una versión nueva.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
