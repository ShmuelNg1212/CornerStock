import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // This package stops a server module from loading in the browser. Tests run in Node.
      "server-only": path.resolve(import.meta.dirname, "scripts/empty.mjs"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["supabase/tests/**/*.test.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
