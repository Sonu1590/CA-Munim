import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import istanbul from "vite-plugin-istanbul";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Only instruments source when COVERAGE=true (set by npm run
    // test:e2e:coverage) — never in normal dev/build, so day-to-day work
    // isn't slowed down or shipped with instrumentation.
    process.env.COVERAGE === "true" &&
      istanbul({
        include: "src/*",
        exclude: ["node_modules", "src/test/**", "src/components/ui/**"],
        extension: [".ts", ".tsx"],
        requireEnv: false,
      }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "CA Munim",
        short_name: "CA Munim",
        description: "Your digital practice manager",
        start_url: "/",
        display: "standalone",
        background_color: "#f5ead8",
        theme_color: "#c67139",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell only — never precache/serve Supabase API responses, so
        // clients always see live, RLS-scoped data rather than a stale cache.
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        // Default is 2 MiB; the main bundle is already ~2.1 MB and grows
        // over time, which made `vite build` fail outright (workbox
        // treats an oversized precache asset as a hard error, not a
        // warning). Raised with headroom rather than tuned to the exact
        // current size, so normal bundle growth doesn't re-break the
        // build. Rollup's own "chunks larger than 500 kB" warning at
        // build time is the real signal to eventually code-split
        // (dynamic import / manualChunks) — orthogonal to this fix and
        // not something to do blind under a broken-build deadline.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
