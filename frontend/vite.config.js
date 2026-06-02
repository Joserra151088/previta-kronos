// vite.config.js
// ──────────────────────────────────────────────────────────────────────────────
// Configuración de Vite para el frontend React.
// Define el servidor de desarrollo y el proxy hacia el backend Express
// para evitar errores de CORS durante el desarrollo.
// ──────────────────────────────────────────────────────────────────────────────

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',           // Expone en la red local
    port: 3000,
    hmr: { clientPort: 3000 }, // Evita errores de WebSocket en red
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
