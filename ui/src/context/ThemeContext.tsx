import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  APP_DARK_THEME_COLOR,
  APP_LIGHT_THEME_COLOR,
  APP_THEME_STORAGE_KEY,
} from "../lib/app-branding";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = APP_THEME_STORAGE_KEY;
const DARK_THEME_COLOR = APP_DARK_THEME_COLOR;
const LIGHT_THEME_COLOR = APP_LIGHT_THEME_COLOR;
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveThemeFromDocument(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function readStoredThemePreference(): ThemePreference | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : null;
  } catch {
    return null;
  }
}

function resolveSystemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolvePreference(preference: ThemePreference): Theme {
  return preference === "system" ? resolveSystemTheme() : preference;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const isDark = theme === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta instanceof HTMLMetaElement) {
    themeColorMeta.setAttribute("content", isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const storedPreference = readStoredThemePreference();
  const [preference, setPreference] = useState<ThemePreference>(() => storedPreference ?? "light");
  const [theme, setThemeState] = useState<Theme>(() => resolveThemeFromDocument());
  // Track whether the user has explicitly chosen a theme. If false, use the
  // light-first document default without persisting a preference.
  const [hasExplicitChoice, setHasExplicitChoice] = useState<boolean>(() => storedPreference !== null);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setHasExplicitChoice(true);
    setPreference(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setHasExplicitChoice(true);
    setPreference(theme === "dark" ? "light" : "dark");
  }, [theme]);

  useEffect(() => {
    const applyPreference = () => setThemeState(resolvePreference(preference));
    applyPreference();
    if (preference !== "system" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener?.("change", applyPreference);
    return () => media.removeEventListener?.("change", applyPreference);
  }, [preference]);

  useEffect(() => {
    applyTheme(theme);
    if (!hasExplicitChoice) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
      window.dispatchEvent(new CustomEvent("summon:theme-preference-change", { detail: preference }));
    } catch {
      // Ignore local storage write failures in restricted environments.
    }
  }, [theme, preference, hasExplicitChoice]);

  const value = useMemo(
    () => ({
      theme,
      preference,
      setTheme,
      toggleTheme,
    }),
    [theme, preference, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
