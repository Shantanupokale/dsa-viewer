import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    silent: false, // keep benchmark numbers (NFR1) visible in output
  },
});
