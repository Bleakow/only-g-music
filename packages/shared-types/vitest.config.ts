import { defineConfig } from "vitest/config";

// Tests de LÓGICA PURA: sin DOM ni red. Entorno `node`, solo los `*.test.ts`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
