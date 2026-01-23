import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "images/nextmic-logo.svg", "images/nextmic-logo.jpeg"],
      manifest: {
        name: "NextMic - Speaker Business Platform",
        short_name: "NextMic",
        description: "Find speaking opportunities, manage your pipeline, and grow your speaking business",
        theme_color: "#7c3aed",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/images/nextmic-logo.jpeg",
            sizes: "192x192",
            type: "image/jpeg",
            purpose: "any maskable"
          },
          {
            src: "/images/nextmic-logo.jpeg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "any maskable"
          }
        ],
        categories: ["business", "productivity"],
        shortcuts: [
          {
            name: "Dashboard",
            short_name: "Dashboard",
            description: "View your opportunities dashboard",
            url: "/dashboard",
            icons: [{ src: "/images/nextmic-logo.jpeg", sizes: "96x96" }]
          },
          {
            name: "Pipeline",
            short_name: "Pipeline",
            description: "Manage your outreach pipeline",
            url: "/pipeline",
            icons: [{ src: "/images/nextmic-logo.jpeg", sizes: "96x96" }]
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpeg,jpg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
