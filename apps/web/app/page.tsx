"use client";

import { useEffect, useState } from "react";
import { JobInputForm } from "@/components/job-input-form";
import { HistoryList } from "@/components/history-list";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Lang, t } from "@/lib/i18n";
import { storage } from "@/lib/storage";

export default function Home() {
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    setLang(storage.getLanguage());
  }, []);

  const onLangChange = (l: Lang) => {
    setLang(l);
    storage.setLanguage(l);
  };

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            {t(lang, "app.title")}
          </h1>
          <p className="text-base text-muted-foreground">
            {t(lang, "app.tagline")}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <ThemeToggle />
          <LangToggle lang={lang} onChange={onLangChange} />
        </div>
      </div>

      <div className="mt-10">
        <JobInputForm lang={lang} />
      </div>

      <div className="mt-12 border-t border-border pt-8">
        <HistoryList lang={lang} />
      </div>
    </main>
  );
}
