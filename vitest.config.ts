import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // The real package throws outside a React Server Component; the portal's server modules are unit-tested in plain Node.
      "server-only": path.resolve(__dirname, "lib/portal/__stubs__/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    // The local test database (PGlite) serves one connection at a time and several suites also start PHP against it, so run files one by one.
    fileParallelism: false,
    include: ["lib/**/*.test.ts", "app/**/*.test.ts", "features/**/*.test.ts"],
  },
});
