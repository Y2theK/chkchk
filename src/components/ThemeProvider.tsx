import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

/** `null` means "follow the operating system". */
export type ThemePreference = Theme | "system";

export const THEME_STORAGE_KEY = "ccc-theme";

/**
 * Runs in <head> before the first paint so the correct theme class is on <html>
 * before React hydrates. Without this the app flashes light before going dark.
 */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var s=localStorage.getItem(k);var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var d=document.documentElement;d.classList.toggle("dark",t==="dark");d.style.colorScheme=t;var c=t==="dark"?"#0b1120":"#f7fbff";var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++){m[i].setAttribute("content",c);}}catch(e){}})();`;

const systemTheme = (): Theme =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const THEME_COLOR: Record<Theme, string> = { dark: "#0b1120", light: "#f7fbff" };

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
    el.setAttribute("content", THEME_COLOR[theme]);
  });
}

function readPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : "system";
  } catch {
    return "system";
  }
}

function storePreference(pref: ThemePreference) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

type ThemeContextValue = {
  /** The theme actually in effect. */
  theme: Theme;
  /** What the user picked, including "follow the system". */
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Starts at the light defaults so the server and the client's first render
  // produce identical markup; the real preference is applied in the effect.
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = readPreference();
    const resolved = stored === "system" ? systemTheme() : stored;
    setPreferenceState(stored);
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  // Keep following the OS for as long as the preference is "system".
  useEffect(() => {
    if (preference !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemTheme();
      setTheme(next);
      applyTheme(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    const resolved = next === "system" ? systemTheme() : next;
    setPreferenceState(next);
    setTheme(resolved);
    storePreference(next);
    applyTheme(resolved);
  }, []);

  const value = useMemo(
    () => ({ theme, preference, setPreference }),
    [theme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider");
  return ctx;
}
