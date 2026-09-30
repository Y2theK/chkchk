import { toast } from "sonner";

const SW_URL = "/sw.js";

let updatePromptShown = false;

/**
 * True if the page was already controlled by a worker when it loaded. The very
 * first registration also fires `controllerchange` (the new worker claims open
 * clients), so without this the user would get an update prompt on every cold
 * start.
 */
let hadControllerAtLoad = false;

/**
 * Registers the generated service worker.
 *
 * vite-plugin-pwa is configured with `registerType: "autoUpdate"`, so the
 * worker calls skipWaiting/clientsClaim itself and a new version takes over as
 * soon as it installs. That does not reload the page: the document keeps
 * running the old bundle while the new worker serves the new assets, so the
 * user is left on a stale shell until they navigate. `onControllerChange`
 * surfaces that as an explicit "Reload" prompt.
 *
 * Registration is done here rather than by an injected script tag because the
 * app is server-rendered.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  hadControllerAtLoad = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadControllerAtLoad) return;
    if (updatePromptShown) return;
    updatePromptShown = true;
    toast("New version available", {
      description: "Reload to get the latest changes.",
      duration: Infinity,
      action: {
        label: "Reload",
        onClick: () => {
          window.location.reload();
        },
      },
    });
  });

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
