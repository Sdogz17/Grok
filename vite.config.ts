import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Project site: https://sdogz17.github.io/Grok/
export default defineConfig({
  base: "/Grok/",
  plugins: [react()],
});
