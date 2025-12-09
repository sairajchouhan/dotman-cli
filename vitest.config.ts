import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    pool: "forks",
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
});
