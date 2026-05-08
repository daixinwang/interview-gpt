"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { storage, type SavedSession } from "@/lib/storage";
import { Lang, t } from "@/lib/i18n";

interface Props {
  lang: Lang;
}

/**
 * Compact session sidebar (ChatGPT-style). Each row navigates to the
 * appropriate page (`/interview/...` while in-progress, `/report/...` once
 * completed) with a hover-revealed trash button on the right.
 *
 * Lives entirely in localStorage — no server round-trip on mount.
 */
export function HistoryList({ lang }: Props) {
  const [sessions, setSessions] = useState<SavedSession[]>([]);

  useEffect(() => {
    setSessions(storage.listSessions());
  }, []);

  const remove = (sid: string) => {
    storage.removeSession(sid);
    setSessions(storage.listSessions());
  };

  // Date formatter: short, locale-aware. Switch to time-of-day for entries
  // started today so the row stays informative without bloating.
  const formatStarted = (ts: number): string => {
    const d = new Date(ts);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2 pt-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t(lang, "home.history.title")}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {sessions.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            {t(lang, "home.history.empty")}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {sessions.map((s) => {
              const href = s.completed
                ? `/report/${s.sessionId}?lang=${lang}`
                : `/interview/${s.sessionId}?lang=${lang}`;
              return (
                <li key={s.sessionId} className="group relative">
                  <Link
                    href={href}
                    className="block rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    <div className="pr-7">
                      <div className="flex items-center gap-1.5">
                        {!s.completed && (
                          <span
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                            aria-label={t(lang, "home.history.continue")}
                          />
                        )}
                        <span className="truncate text-sm font-medium">
                          {s.jobTitle}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatStarted(s.startedAt)}
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      remove(s.sessionId);
                    }}
                    aria-label={t(lang, "home.history.delete")}
                    className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
