import { defineConfig } from "vitest/config";

// `resolve.tsconfigPaths` resuelve el alias `@/*` del tsconfig de forma nativa
// (Vite 7+); los paquetes `@only-g/*` se resuelven solos por los symlinks de
// pnpm. Entorno `node` (lógica pura, sin DOM).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
