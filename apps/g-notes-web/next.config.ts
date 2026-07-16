import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const appDir = dirname(fileURLToPath(import.meta.url));
// Raíz del monorepo: apps/g-notes-web -> ../../. Fija el tracing root al
// workspace para que Next resuelva bien las dependencias hoisted por pnpm.
const workspaceRoot = join(appDir, "..", "..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: workspaceRoot,
  // Compila desde fuente los packages internos del workspace (TS, sin pre-build).
  transpilePackages: ["@only-g/ai-services"],
};

export default nextConfig;
