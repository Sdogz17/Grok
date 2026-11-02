import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Second app on the project site: https://sdogz17.github.io/Grok/health/
const root = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root,
  base: "/Grok/health/",
  plugins: [react()],
  cacheDir: fileURLToPath(new URL("../node_modules/.vite-health", import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL("../dist/health", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    fs: { allow: [repo] },
  },
});
