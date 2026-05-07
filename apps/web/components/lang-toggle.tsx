"use client";

import { Button } from "@/components/ui/button";
import { Lang } from "@/lib/i18n";

interface Props {
  lang: Lang;
  onChange: (l: Lang) => void;
}

export function LangToggle({ lang, onChange }: Props) {
  const next: Lang = lang === "zh" ? "en" : "zh";
  const label = lang === "zh" ? "EN" : "中";
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onChange(next)}
      aria-label="toggle language"
    >
      {label}
    </Button>
  );
}
