/**
 * Tiny theme manager. Three modes: light / dark / system. The user's choice
 * lives in localStorage; system mode follows `prefers-color-scheme`.
 *
 * We avoid `next-themes` because the app is small and `next-themes` brings
 * its own provider boundary that complicates server components.
 */

export type ThemeMode = "light" | "dark" | "system";

const KEY = "igpt:theme";

export function getTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  return (window.localStorage.getItem(KEY) as ThemeMode) || "system";
}

export function setTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, mode);
  applyTheme(mode);
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(mode);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

/** Inline boot script — embed via `<script dangerouslySetInnerHTML>` in
 *  `<head>` so the theme is applied BEFORE first paint and we don't flash. */
export const THEME_BOOT_SCRIPT = `
(function(){try{
  var k='${KEY}';
  var s=localStorage.getItem(k)||'system';
  var prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark=s==='dark'||(s==='system'&&prefersDark);
  if(dark)document.documentElement.classList.add('dark');
}catch(e){}})();
`;
