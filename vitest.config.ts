import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["screen/src/**/*.test.ts"],
  },
});
