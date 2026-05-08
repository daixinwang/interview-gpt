"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/app-shell";
import { t } from "@/lib/i18n";
import { storage } from "@/lib/storage";
import { ApiError, fetchState, streamSse, sseUrls } from "@/lib/api-client";

interface PageProps {
  params: { id: string };
}

export default function ReportPage({ params }: PageProps) {
  const router = useRouter();
  const { lang } = useLang();
  const sid = params.id;

  const [report, setReport] = useState<string>("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const s = await fetchState(sid);
        if (cancelled) return;
        if (s.final_report) {
          setReport(s.final_report);
          return;
        }
        // No cached report: stream a fresh one.
        if (startedRef.current) return;
        startedRef.current = true;
        const apiKey = storage.getApiKey();
        if (!apiKey) {
          setError(t(lang, "interview.error.apikey"));
          return;
        }
        setStreaming(true);
        let buf = "";
        await streamSse(sseUrls.finish(sid, lang), apiKey, (ev) => {
          const d = ev.data || {};
          if (ev.event === "delta" || d.type === "delta") {
            buf += d.text;
            setReport(buf);
          } else if (ev.event === "done" || d.type === "done") {
            // server already persisted final_report.
          } else if (ev.event === "error" || d.type === "error") {
            setError(d.message || "report error");
          }
        });
        // Mark session as completed in localStorage history.
        const meta = storage.listSessions().find((x) => x.sessionId === sid);
        if (meta) {
          storage.upsertSession({ ...meta, completed: true });
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          storage.removeSession(sid);
          setError(t(lang, "interview.error.session_expired"));
          router.replace(`/?lang=${lang}`);
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setStreaming(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  const onCopy = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onDownload = () => {
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-report-${sid.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center justify-between pb-3">
          <h1 className="text-lg font-semibold">{t(lang, "report.title")}</h1>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={!report || streaming}
          >
            {t(lang, "report.download.md")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCopy}
            disabled={!report || streaming}
          >
            {copied ? t(lang, "report.copied") : t(lang, "report.copy")}
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <article className="prose prose-sm sm:prose-base mt-6 max-w-none">
          {report ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground">
              {t(lang, "report.generating")}
            </p>
          )}
          {streaming && report && (
            <span className="ml-0.5 animate-pulse">▍</span>
          )}
        </article>
      </div>
    </div>
  );
}
