import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const appDir = dirname(fileURLToPath(import.meta.url));
// Raíz del monorepo: apps/only-g-web -> ../../. Fija el tracing root al
// workspace para que Next resuelva bien las dependencias hoisted por pnpm.
const workspaceRoot = join(appDir, "..", "..");

// next-intl: enlaza la config de petición (catálogos por locale).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// ID único por build (cambia en cada deploy). Se inyecta como env pública para
// que CLIENTE y SERVIDOR compartan el mismo valor: el cliente compara el suyo
// (horneado en su bundle) con el que devuelve `/api/version` (el desplegado) y,
// si difieren, avisa de que hay una versión nueva. Respeta un id externo si el
// CI lo provee (p. ej. el SHA de git).
const BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ?? Date.now().toString(36);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: workspaceRoot,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // Compila desde fuente los packages internos del workspace (TS, sin pre-build).
  transpilePackages: ["@only-g/shared-types", "@only-g/ui"],
  images: {
    // Placeholders (picsum) + fotos reales subidas a Firebase Storage.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
