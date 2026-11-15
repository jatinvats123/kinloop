// Vitest configuration: node environment by default (component tests opt into jsdom
// with a docblock), path alias, and enforced coverage thresholds.
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    env: {
      DATA_BACKEND: "memory",
      SESSION_SECRET: "test-session-secret-0123456789abcdef",
      LINK_SECRET: "test-link-secret-0123456789abcdef",
    },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      include: ["src/domain/**", "src/server/**", "src/components/**"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "src/test/**",
        // Needs a live Firestore; behaviour is covered through the in-memory twin.
        "src/server/repositories/firestore-repository.ts",
      ],
      thresholds: {
        lines: 85,
        "src/domain/**": { lines: 95 },
      },
    },
  },
});
