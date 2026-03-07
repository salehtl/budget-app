import { useSyncExternalStore, useCallback } from "react";

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

function getPreference(): ThemePreference {
  return (localStorage.getItem("theme") as ThemePreference) ?? "system";
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

function applyTheme(resolved: ResolvedTheme) {
  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function getSnapshot(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): ResolvedTheme {
  return "light";
}

let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notify() {
  for (const l of listeners) l();
}

// Listen for OS theme changes when preference is "system"
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getPreference() === "system") {
      applyTheme(resolveTheme("system"));
      notify();
    }
  });
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const preference = getPreference();

  const setPreference = useCallback((pref: ThemePreference) => {
    if (pref === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", pref);
    }
    applyTheme(resolveTheme(pref));
    notify();
  }, []);

  return { theme, preference, setPreference, isDark: theme === "dark" } as const;
}
