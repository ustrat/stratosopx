import { defineConfig } from "vitest/config";

// Unit tests for pure Worker logic; they run in Node, not the Workers runtime.
export default defineConfig({
  test: { include: ["test/**/*.test.ts"], environment: "node" },
});
