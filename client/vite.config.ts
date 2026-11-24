import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // pdfjs-dist 4.x uses top-level await, so target modern browsers.
  build: { target: "esnext" },
  optimizeDeps: { esbuildOptions: { target: "esnext" } },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
});
