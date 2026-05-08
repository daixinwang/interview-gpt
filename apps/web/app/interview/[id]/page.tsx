"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatBubble } from "@/components/chat-bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LangToggle } from "@/components/lang-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { Lang, t } from "@/lib/i18n";
import { storage } from "@/lib/storage";
import {
  fetchState,
  postAnswer,
  streamSse,
  sseUrls,
  type RoundDTO,
} from "@/lib/api-client";

interface PageProps {
  params: { id: string };
}

interface UiRound extends RoundDTO {
  // Local-only: tracks streaming state for the latest interviewer turn.
  streaming?: boolean;
}

export default function InterviewPage({ params }: PageProps) {
  const router = useRouter();
  const search = useSearchParams();
  const [lang, setLang] = useState<Lang>(
    (search.get("lang") as Lang) || storage.getLanguage(),
  );
  const sid = params.id;

  const [rounds, setRounds] = useState<UiRound[]>([]);
  const [stage, setStage] = useState<string>("opening");
  const [completed, setCompleted] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const apiKey = typeof window !== "undefined" ? storage.getApiKey() : "";

  const persistSessionMeta = useCallback(
    (jobTitle: string, jobId: string, done: boolean) => {
      const existing = storage
        .listSessions()
        .find((s) => s.sessionId === sid);
      storage.upsertSession({
        sessionId: sid,
        jobTitle,
        jobId,
        startedAt: existing?.startedAt || Date.now(),
        completed: done,
      });
    },
    [sid],
  );

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  // Hydrate state on first mount and decide whether to start streaming.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const s = await fetchState(sid);
        if (cancelled) return;
        setRounds(s.rounds);
        setStage(s.stage);
        setCompleted(s.completed);
        persistSessionMeta(s.job_title, s.job_id, s.completed);

        // Decide if we should pull the next turn:
        // - no rounds yet (fresh session) → ask
        // - last round has an answer but no score → next turn (will evaluate + ask)
        // - last round has no answer → wait for user input
        const last = s.rounds[s.rounds.length - 1];
        const needsTurn =
          !s.completed &&
          (s.rounds.length === 0 ||
            (last && last.answer !== null && last.score === null));
        if (needsTurn && !startedRef.current && apiKey) {
          startedRef.current = true;
          await runTurn();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  const runTurn = async () => {
    if (!apiKey) {
      setError(t(lang, "interview.error.apikey"));
      return;
    }
    setError(null);
    setThinking(true);

    let buffer = "";
    let placeholderIdx = -1;
    let stageMeta: { stage: string; isFollowup: boolean } | null = null;
    let eventsReceived = 0;

    try {
      await streamSse(sseUrls.stream(sid), apiKey, (ev) => {
        const d = ev.data || {};
        eventsReceived += 1;
        // Surface raw frames in DevTools — helps users diagnose silent SSE issues
        // (e.g., wrong base_url or model returning empty deltas).
        // eslint-disable-next-line no-console
        console.debug("[interview SSE]", ev.event, ev.data);
        if (ev.event === "evaluating" || d.type === "evaluating") {
          setEvaluating(true);
        } else if (ev.event === "evaluated" || d.type === "evaluated") {
          setEvaluating(false);
          // Refresh score on the matching round.
          setRounds((prev) =>
            prev.map((r, i) =>
              i === d.round_index ? { ...r, score: d.score } : r,
            ),
          );
        } else if (ev.event === "stage" || d.type === "stage") {
          stageMeta = { stage: d.stage, isFollowup: !!d.is_followup };
          setStage(d.stage);
          // Insert placeholder bubble for the streaming question.
          setRounds((prev) => {
            const next = [
              ...prev,
              {
                question: "",
                question_id: null,
                topic: null,
                stage: d.stage,
                expected_dimensions: [],
                is_followup: !!d.is_followup,
                answer: null,
                score: null,
                strengths: [],
                weaknesses: [],
                should_followup: false,
                followup_hint: null,
                streaming: true,
              } as UiRound,
            ];
            placeholderIdx = next.length - 1;
            return next;
          });
          setThinking(false);
        } else if (ev.event === "delta" || d.type === "delta") {
          buffer += d.text;
          setRounds((prev) =>
            prev.map((r, i) =>
              i === placeholderIdx ? { ...r, question: buffer } : r,
            ),
          );
          scrollToBottom();
        } else if (ev.event === "round_committed" || d.type === "round_committed") {
          setRounds((prev) =>
            prev.map((r, i) =>
              i === placeholderIdx ? { ...r, streaming: false } : r,
            ),
          );
        } else if (ev.event === "report_ready" || d.type === "report_ready") {
          setReportReady(true);
          setThinking(false);
        } else if (ev.event === "done" || d.type === "done") {
          setCompleted(true);
        } else if (ev.event === "error" || d.type === "error") {
          setError(d.message || "stream error");
        }
      });
      if (eventsReceived === 0) {
        // Backend closed the stream without sending any frames — usually means
        // the request was rejected before reaching our generator (proxy, CORS,
        // or sse-starlette short-circuit). Surface it instead of silently
        // freezing the UI.
        setError(t(lang, "interview.error.empty_stream"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setThinking(false);
      setEvaluating(false);
    }
  };

  const onSendAnswer = async () => {
    const txt = answerText.trim();
    if (!txt || thinking || evaluating) return;
    setError(null);

    // Optimistically write into the latest unanswered round.
    setRounds((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].answer === null) {
          copy[i] = { ...copy[i], answer: txt };
          break;
        }
      }
      return copy;
    });
    setAnswerText("");
    scrollToBottom();

    try {
      await postAnswer(sid, txt);
      await runTurn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onGenerateReport = () => {
    persistSessionMeta(
      storage.listSessions().find((s) => s.sessionId === sid)?.jobTitle ||
        "Interview",
      storage.listSessions().find((s) => s.sessionId === sid)?.jobId ||
        "frontend",
      false,
    );
    router.push(`/report/${sid}?lang=${lang}`);
  };

  const onLangChange = (l: Lang) => {
    setLang(l);
    storage.setLanguage(l);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSendAnswer();
    }
  };

  const lastRound = rounds[rounds.length - 1];
  const awaitingAnswer = !!lastRound && lastRound.answer === null && !lastRound.streaming;
  const canSend = awaitingAnswer && !thinking && !evaluating;

  return (
    <main className="mx-auto flex h-screen max-w-3xl flex-col px-4 py-6">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <button
          onClick={() => router.push("/")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t(lang, "report.back")}
        </button>
        <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {t(lang, `interview.stage.${stage}`)}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LangToggle lang={lang} onChange={onLangChange} />
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-6">
        {rounds.map((r, i) => (
          <div key={i} className="space-y-3">
            <ChatBubble
              role="interviewer"
              text={r.question || (r.streaming ? "" : "…")}
              meta={{ stage: r.stage, isFollowup: r.is_followup }}
              streaming={r.streaming}
              lang={lang}
            />
            {r.answer && (
              <ChatBubble
                role="candidate"
                text={r.answer}
                meta={{ score: r.score }}
                lang={lang}
              />
            )}
          </div>
        ))}
        {thinking && !lastRound?.streaming && (
          <div className="text-sm text-muted-foreground">
            {t(lang, "interview.thinking")}
          </div>
        )}
        {evaluating && (
          <div className="text-sm text-muted-foreground">
            {t(lang, "interview.evaluating")}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {reportReady || completed ? (
        <div className="border-t border-border pt-4">
          <div className="mb-2 text-sm text-muted-foreground">
            {t(lang, "interview.report_ready")}
          </div>
          <Button onClick={onGenerateReport} size="lg" className="w-full">
            {t(lang, "interview.finish")}
          </Button>
        </div>
      ) : (
        <div className="border-t border-border pt-4">
          <Textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            onKeyDown={onKey}
            placeholder={t(lang, "interview.placeholder")}
            rows={3}
            disabled={!canSend}
          />
          <div className="mt-2 flex justify-end">
            <Button
              onClick={onSendAnswer}
              disabled={!canSend || !answerText.trim()}
            >
              {t(lang, "interview.send")}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
