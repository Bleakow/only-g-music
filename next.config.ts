import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fija la raíz del proyecto: hay un package-lock.json suelto en el home del
  // usuario que confundía la inferencia automática de Next.
  outputFileTracingRoot: projectRoot,
  images: {
    // Placeholders (picsum) + fotos reales subidas a Firebase Storage.
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

export default nextConfig;
