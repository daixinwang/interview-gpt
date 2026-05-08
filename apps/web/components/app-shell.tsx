"use client";

/**
 * AppShell — root client wrapper providing the persistent sidebar + top bar
 * across every page (home / interview / report). Mirrors the ChatGPT layout:
 * sidebar with "+ New interview" + history list on the left, slim top bar
 * with the product name (clickable home link) + theme/lang toggles on the
 * right.
 *
 * Also owns the `lang` state for the entire app, exposed via `useLang()`.
 * Pages don't need their own header chrome anymore.
 */
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { HistoryList } from "./history-list";
import { LangToggle } from "./lang-toggle";
import { ThemeToggle } from "./theme-toggle";
import { SettingsMenu } from "./settings-menu";
import { Lang, t } from "@/lib/i18n";
import { storage } from "@/lib/storage";

interface LangCtxValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangCtxValue | null>(null);

export function useLang(): LangCtxValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useLang must be used inside <AppShell>");
  }
  return ctx;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // Initial render uses "zh" on both server and client to avoid hydration
  // mismatch; the effect below switches to the user's actual preference
  // (URL param wins so shareable `?lang=en` links survive across browsers).
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("lang");
    const fromStorage = storage.getLanguage();
    const next: Lang =
      fromUrl === "en" || fromUrl === "zh" ? fromUrl : fromStorage;
    setLangState(next);
    if (fromUrl) storage.setLanguage(next);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    storage.setLanguage(l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-muted/30 md:flex">
          <div className="p-3">
            <Link
              href={`/?lang=${lang}`}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              {t(lang, "home.history.new")}
            </Link>
          </div>
          <div className="min-h-0 flex-1">
            <HistoryList lang={lang} />
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between px-6">
            <SettingsMenu lang={lang} triggerLabel={t(lang, "app.title")} />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LangToggle lang={lang} onChange={setLang} />
            </div>
          </header>
          <div className="min-h-0 flex-1">{children}</div>
        </main>
      </div>
    </LangContext.Provider>
  );
}
