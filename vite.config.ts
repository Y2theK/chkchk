// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin, ResolvedConfig } from "vite";

const isVercel = process.env.VERCEL === "1";

/**
 * This app builds two Vite environments (client + ssr). vite-plugin-pwa shares
 * one context between all of its sub-plugins, and its `configResolved` runs
 * once per environment, so the ssr build would overwrite the client config and
 * the service worker would never be generated. Its `closeBundle` hook checks
 * `ctx.viteConfig.build.ssr` to decide whether to emit, so keeping the client
 * config in that context is all that is needed.
 */
function clientEnvironmentOnly(plugins: Plugin[]): Plugin[] {
  return plugins.map((plugin) => ({
    ...plugin,
    configResolved(config: ResolvedConfig) {
      if (config.build.ssr) return;
      const original = plugin.configResolved;
      if (typeof original === "function") {
        original.call(this, config);
      } else if (original) {
        original.handler.call(this, config);
      }
    },
  }));
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      ...(isVercel ? [(await import("nitro/vite")).nitro({ preset: "vercel" })] : []),
      ...clientEnvironmentOnly(
        VitePWA({
          // The SW is registered manually from a client effect (see src/lib/pwa.ts)
          // so that nothing is injected into the SSR HTML by the build.
          injectRegister: null,
          registerType: "autoUpdate",
          // public/manifest.webmanifest is hand-written and linked from __root.tsx.
          manifest: false,
          // A service worker caching HMR assets makes local development miserable.
          devOptions: { enabled: false },
          workbox: {
            // The app is server-rendered, so there is no static index.html to
            // fall back to. Navigations are handled by the runtime rule below.
            navigateFallback: null,
            globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff2}"],
            // public/ holds ~12MB of mp3s. Precaching them on install would make
            // the first visit enormous, so they are cached on demand instead.
            // social.png is only ever fetched by social crawlers, never by the app.
            globIgnores: ["**/*.mp3", "**/social.png"],
            maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
            cleanupOutdatedCaches: true,
            runtimeCaching: [
              {
                // Sound effects and ambient loops: big, immutable, worth keeping.
                urlPattern: /\.(?:mp3|wav|ogg|m4a)$/,
                handler: "CacheFirst",
                options: {
                  cacheName: "checkcheck-audio",
                  expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 90 },
                  cacheableResponse: { statuses: [0, 200] },
                  rangeRequests: true,
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
                handler: "StaleWhileRevalidate",
                options: {
                  cacheName: "checkcheck-fonts",
                  expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                // Try the network so SSR HTML stays fresh; fall back to the last
                // page rendered when offline.
                urlPattern: ({ request }) => request.mode === "navigate",
                handler: "NetworkFirst",
                options: {
                  cacheName: "checkcheck-pages",
                  networkTimeoutSeconds: 3,
                  expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
        }),
      ),
    ],
  },
});
