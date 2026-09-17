import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies API + websockets to the Fastify backend on 8016.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8016", changeOrigin: true },
      "/socket.io": { target: "http://localhost:8016", ws: true, changeOrigin: true },
      "/uploads": { target: "http://localhost:8016", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
