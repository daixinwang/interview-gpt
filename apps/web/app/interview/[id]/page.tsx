"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { ChatBubble } from "@/components/chat-bubble";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/app-shell";
import { t } from "@/lib/i18n";
import { storage } from "@/lib/storage";
import {
  fetchState,
  postAnswer,
  streamSse,
  sseUrls,
  ApiError,
  type RoundDTO,
} from "@/lib/api-client";

interface PageProps {
  params: { id: string };
}

interface UiRound extends RoundDTO {
  // Local-only: tracks streaming state for the latest interviewer turn.
  streaming?: boolean;
  // Local-only: true while the reference answer is still being streamed.
  referenceStreaming?: boolean;
}

export default function InterviewPage({ params }: PageProps) {
  const router = useRouter();
  const { lang } = useLang();
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startedRef = useRef(false);

  // Auto-grow textarea height to fit content (GPT-style pill input).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [answerText]);

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
        if (err instanceof ApiError && err.status === 404) {
          // Backend lost / never had this session (in-memory store after a
          // restart, or TTL expired). Clean up the dead localStorage entry
          // and bounce back to home so the user isn't stuck on a red banner.
          storage.removeSession(sid);
          setError(t(lang, "interview.error.session_expired"));
          router.replace(`/?lang=${lang}`);
          return;
        }
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
    let referenceBuffer = "";
    let referenceIdx = -1;
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
        } else if (ev.event === "reference_start" || d.type === "reference_start") {
          referenceBuffer = "";
          referenceIdx = d.round_index;
          setRounds((prev) =>
            prev.map((r, i) =>
              i === referenceIdx
                ? {
                    ...r,
                    reference_answer: "",
                    referenceStreaming: true,
                  }
                : r,
            ),
          );
          setThinking(false);
          scrollToBottom();
        } else if (ev.event === "reference_delta" || d.type === "reference_delta") {
          referenceBuffer += d.text;
          setRounds((prev) =>
            prev.map((r, i) =>
              i === referenceIdx
                ? { ...r, reference_answer: referenceBuffer }
                : r,
            ),
          );
          scrollToBottom();
        } else if (ev.event === "reference_done" || d.type === "reference_done") {
          setRounds((prev) =>
            prev.map((r, i) =>
              i === referenceIdx
                ? { ...r, referenceStreaming: false }
                : r,
            ),
          );
          // Reset for the next question that's about to stream.
          setThinking(true);
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
                skipped: false,
                reference_answer: null,
                streaming: true,
              } as UiRound,
            ];
            placeholderIdx = next.length - 1;
            return next;
          });
          setThinking(false);
          // Reset question buffer for this new bubble.
          buffer = "";
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

  const onSkip = async () => {
    if (thinking || evaluating) return;
    setError(null);

    // Optimistically mark the latest unanswered round as skipped.
    setRounds((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].answer === null) {
          copy[i] = { ...copy[i], answer: "(skipped)", skipped: true };
          break;
        }
      }
      return copy;
    });
    scrollToBottom();

    try {
      await postAnswer(sid, "", true);
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
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-4">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-6">
        {rounds.map((r, i) => {
          // Only the latest interviewer turn that's awaiting an answer gets
          // an inline skip action; older bubbles are read-only.
          const isLatestAwaiting =
            i === rounds.length - 1 && r.answer === null && !r.streaming;
          return (
          <div key={i} className="space-y-3">
            <ChatBubble
              role="interviewer"
              text={r.question || (r.streaming ? "" : "…")}
              meta={{ stage: r.stage, isFollowup: r.is_followup }}
              streaming={r.streaming}
              onSkip={isLatestAwaiting ? onSkip : undefined}
              lang={lang}
            />
            {r.answer && (
              <ChatBubble
                role="candidate"
                text={r.skipped ? t(lang, "interview.skipped.label") : r.answer}
                meta={{ score: r.score, skipped: r.skipped }}
                reference={
                  r.skipped && (r.reference_answer !== null || r.referenceStreaming)
                    ? {
                        text: r.reference_answer || "",
                        streaming: r.referenceStreaming,
                      }
                    : undefined
                }
                lang={lang}
              />
            )}
          </div>
          );
        })}
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
        <div className="pt-4">
          <div className="mb-2 text-sm text-muted-foreground">
            {t(lang, "interview.report_ready")}
          </div>
          <Button onClick={onGenerateReport} size="lg" className="w-full">
            {t(lang, "interview.finish")}
          </Button>
        </div>
      ) : (
        <div className="pt-4">
          <div
            className={`flex items-end gap-1.5 rounded-3xl border border-border bg-background px-3 py-1.5 shadow-sm transition-opacity ${
              canSend ? "" : "opacity-60"
            }`}
          >
            <textarea
              ref={textareaRef}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              onKeyDown={onKey}
              placeholder={t(lang, "interview.placeholder")}
              rows={1}
              disabled={!canSend}
              className="max-h-48 min-h-[2.25rem] flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={onSendAnswer}
              disabled={!canSend || !answerText.trim()}
              aria-label={t(lang, "interview.send")}
              title={t(lang, "interview.send")}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
