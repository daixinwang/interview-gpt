"use client";

import { cn } from "@/lib/utils";
import { Lang } from "@/lib/i18n";

interface Props {
  lang: Lang;
  onChange: (l: Lang) => void;
}

const opts: { value: Lang; label: string }[] = [
  { value: "zh", label: "中" },
  { value: "en", label: "EN" },
];

export function LangToggle({ lang, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="language"
      className="inline-flex items-center rounded-md border border-border bg-background p-0.5"
    >
      {opts.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={lang === o.value}
          aria-label={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-7 min-w-[2rem] items-center justify-center rounded px-2 text-xs font-medium transition-colors",
            lang === o.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
