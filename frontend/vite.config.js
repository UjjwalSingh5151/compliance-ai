import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Local dev: proxy /api to Express
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  // Production: set VITE_API_URL env var to your Railway backend URL
  // e.g. VITE_API_URL=https://compliance-ai.railway.app
  // AgentChat.jsx uses: fetch(`${import.meta.env.VITE_API_URL || ""}/api/agent`)
});
