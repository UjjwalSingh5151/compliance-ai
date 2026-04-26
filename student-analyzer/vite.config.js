import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // In dev, proxy /api to the local backend
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
  // In production the frontend is served by Express on the same origin,
  // so /api calls work without any proxy or VITE_API_URL.
});
