"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyTheme, getTheme, setTheme, type ThemeMode } from "@/lib/theme";

const modes: { mode: ThemeMode; Icon: typeof Sun; label: string }[] = [
  { mode: "light", Icon: Sun, label: "Light" },
  { mode: "dark", Icon: Moon, label: "Dark" },
  { mode: "system", Icon: Monitor, label: "System" },
];

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const m = getTheme();
    setMode(m);
    applyTheme(m);
    // React to system changes when mode is "system".
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const change = (m: ThemeMode) => {
    setMode(m);
    setTheme(m);
  };

  return (
    <div
      role="radiogroup"
      aria-label="theme"
      className="inline-flex items-center rounded-md border border-border bg-background p-0.5"
    >
      {modes.map(({ mode: m, Icon, label }) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          aria-label={label}
          title={label}
          onClick={() => change(m)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded transition-colors",
            mode === m
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
