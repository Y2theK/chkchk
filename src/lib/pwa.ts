const SW_URL = "/sw.js";

/**
 * Registers the generated service worker.
 *
 * vite-plugin-pwa is configured with `registerType: "autoUpdate"`, so the
 * worker calls skipWaiting/clientsClaim itself and a new version takes over on
 * the next load. Registration is done here rather than by an injected script
 * tag because the app is server-rendered.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register(SW_URL).catch((error) => {
      console.error("Service worker registration failed", error);
    });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }

  // Check for a new worker whenever the app comes back to the foreground.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    navigator.serviceWorker.getRegistration().then((registration) => {
      registration?.update().catch(() => {
        // ignore update failures (offline, etc.)
      });
    });
  });
}
