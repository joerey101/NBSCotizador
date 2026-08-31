import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA + offline cache → se descarga una vez con WiFi en la oficina
// y funciona sin conexión en el local.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      workbox: {
        // Cachear todo el build (JS, CSS, HTML, datos)
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
        // Límite generoso porque el bundle con catálogo es grande
        maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,
        // Estrategia: servir desde caché primero, actualizar en background
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "nbs-runtime",
              expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: "NBS Bazar",
        short_name: "NBS Bazar",
        description: "Catálogo y Cotizador NBS Bazar Profesional",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        orientation: "portrait",
        start_url: "./",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  build: {
    target: "es2020",
    chunkSizeWarningLimit: 60000,
  },
});
