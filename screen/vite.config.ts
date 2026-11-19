import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Browser: https://sdogz17.github.io/Grok/screen/
// Android: bundled assets at https://appassets.androidplatform.net/assets/
const root = fileURLToPath(new URL(".", import.meta.url));
const repo = fileURLToPath(new URL("..", import.meta.url));
const embedded = process.env.VITE_SURFACE === "android";
const base = process.env.SCREEN_BASE || "/Grok/screen/";

export default defineConfig({
  root,
  base,
  plugins: [react()],
  define: {
    "import.meta.env.VITE_SURFACE": JSON.stringify(process.env.VITE_SURFACE ?? "browser"),
  },
  cacheDir: fileURLToPath(new URL("../node_modules/.vite-screen", import.meta.url)),
  build: {
    outDir: embedded
      ? fileURLToPath(new URL("../android/app/build/generated/web", import.meta.url))
      : fileURLToPath(new URL("../dist/screen", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5175,
    strictPort: true,
    fs: { allow: [repo] },
  },
});
