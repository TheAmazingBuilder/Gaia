"use client";

import * as React from "react";
import { useServerInsertedHTML } from "next/navigation";

/**
 * Minimal theme provider — replaces next-themes 0.4.6.
 *
 * Why: next-themes renders its no-flash `<script>` inside the React
 * component tree. React 19 errors on that when the tree client-renders
 * ("Encountered a script tag while rendering React component"), which
 * showed up as a console error on every load. The fix is the one Next.js
 * documents for this case: inject the blocking script with
 * `useServerInsertedHTML`, so it lands in the streamed HTML *outside* the
 * React tree and is never client-rendered.
 *
 * Behaviour kept from the next-themes setup: storage key "theme", default
 * "dark", system following, theme applied as a class on <html> plus
 * colorScheme. Nothing in the app consumes useTheme today, but the context
 * keeps the same shape so a theme switcher can be added later. Only the
 * "class" attribute is supported (the only one the app uses).
 */

const STORAGE_KEY = "theme";

type Theme = "light" | "dark";

/** Blocking script: runs before first paint, no flash of the wrong theme. */
function themeScript(defaultTheme: string, enableSystem: boolean): string {
  return `(function(){try{var s=localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||${JSON.stringify(defaultTheme)};var t=s==="system"&&${enableSystem ? "true" : "false"}?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):s;document.documentElement.classList.remove("light","dark");document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t;}catch(e){}})();`;
}

function resolveTheme(theme: string): Theme {
  if (theme === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme === "light" ? "light" : "dark";
}

function applyTheme(theme: string, disableTransitionOnChange: boolean): void {
  const resolved = resolveTheme(theme);
  let cleanup: (() => void) | null = null;
  if (disableTransitionOnChange) {
    const style = document.createElement("style");
    style.appendChild(
      document.createTextNode(
        "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}",
      ),
    );
    document.head.appendChild(style);
    cleanup = () => {
      window.getComputedStyle(document.body);
      setTimeout(() => document.head.removeChild(style), 1);
    };
  }
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolved);
  document.documentElement.style.colorScheme = resolved;
  cleanup?.();
}

interface ThemeContextValue {
  theme: string;
  setTheme: (theme: string) => void;
  resolvedTheme: Theme;
  systemTheme: Theme | undefined;
  themes: string[];
}

const ThemeContext = React.createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  resolvedTheme: "dark",
  systemTheme: undefined,
  themes: ["light", "dark", "system"],
});

export function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext);
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  enableSystem = true,
  disableTransitionOnChange = false,
  storageKey = STORAGE_KEY,
  themes = ["light", "dark"],
}: {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  storageKey?: string;
  themes?: string[];
}) {
  const [theme, setThemeState] = React.useState<string>(() => {
    if (typeof window === "undefined") return defaultTheme;
    try {
      return window.localStorage.getItem(storageKey) ?? defaultTheme;
    } catch {
      return defaultTheme;
    }
  });
  const [systemTheme, setSystemTheme] = React.useState<Theme | undefined>(() =>
    typeof window === "undefined"
      ? undefined
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light",
  );

  // Blocking script injected outside the React tree (no React 19 script error).
  useServerInsertedHTML(() => (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: themeScript(defaultTheme, enableSystem),
      }}
    />
  ));

  React.useEffect(() => {
    applyTheme(theme, disableTransitionOnChange);
  }, [theme, disableTransitionOnChange]);

  React.useEffect(() => {
    if (!enableSystem) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) =>
      setSystemTheme(e.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [enableSystem]);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) setThemeState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [storageKey]);

  const setTheme = React.useCallback(
    (next: string) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Private mode etc. — the theme just won't persist.
      }
    },
    [storageKey],
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme: resolveTheme(theme),
      systemTheme: enableSystem ? systemTheme : undefined,
      themes: enableSystem ? [...themes, "system"] : themes,
    }),
    [theme, setTheme, systemTheme, enableSystem, themes],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
