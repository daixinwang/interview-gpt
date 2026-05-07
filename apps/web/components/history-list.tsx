"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { storage, type SavedSession } from "@/lib/storage";
import { Lang, t } from "@/lib/i18n";

interface Props {
  lang: Lang;
}

export function HistoryList({ lang }: Props) {
  const [sessions, setSessions] = useState<SavedSession[]>([]);

  useEffect(() => {
    setSessions(storage.listSessions());
  }, []);

  const remove = (sid: string) => {
    storage.removeSession(sid);
    setSessions(storage.listSessions());
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{t(lang, "home.history.title")}</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(lang, "home.history.empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.sessionId}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{s.jobTitle}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(s.startedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {s.completed ? (
                  <Link href={`/report/${s.sessionId}?lang=${lang}`}>
                    <Button size="sm" variant="outline">
                      {t(lang, "home.history.report")}
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/interview/${s.sessionId}?lang=${lang}`}>
                    <Button size="sm" variant="outline">
                      {t(lang, "home.history.continue")}
                    </Button>
                  </Link>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(s.sessionId)}
                >
                  {t(lang, "home.history.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
