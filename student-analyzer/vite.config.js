import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
  optimizeDeps: {
    // xlsx ships as CommonJS — Vite 6 needs explicit pre-bundling hint
    include: ["xlsx"],
  },
  build: {
    commonjsOptions: {
      include: [/xlsx/, /node_modules/],
    },
  },
});
