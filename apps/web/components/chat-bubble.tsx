"use client";

import { useState } from "react";
import { Check, Copy, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lang, t } from "@/lib/i18n";

interface Props {
  role: "interviewer" | "candidate";
  text: string;
  meta?: {
    stage?: string;
    isFollowup?: boolean;
    score?: number | null;
    skipped?: boolean;
  };
  streaming?: boolean;
  /** Optional reference answer rendered below a candidate "skipped" bubble. */
  reference?: {
    text: string;
    streaming?: boolean;
  };
  /**
   * When provided, an extra "skip" action is shown in the hover row.
   * Only the latest interviewer question (one awaiting an answer) should
   * receive this — the parent decides which bubble qualifies.
   */
  onSkip?: () => void;
  lang: Lang;
}

export function ChatBubble({
  role,
  text,
  meta,
  streaming,
  reference,
  onSkip,
  lang,
}: Props) {
  const isInt = role === "interviewer";
  const stageLabel =
    meta?.stage && t(lang, `interview.stage.${meta.stage}`) !== `interview.stage.${meta.stage}`
      ? t(lang, `interview.stage.${meta.stage}`)
      : meta?.stage;
  const isSkipped = !isInt && !!meta?.skipped;
  const displayText = isSkipped ? t(lang, "interview.skipped.label") : text;

  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!displayText) return;
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in non-secure contexts; ignore silently.
    }
  };

  // Hide the action row while a bubble is still streaming (text isn't final
  // yet) or for the "skipped" candidate placeholder (no useful text to copy).
  const showActions = !streaming && !isSkipped && !!displayText;

  return (
    <div
      className={cn(
        "group flex w-full flex-col gap-1.5",
        isInt ? "items-start" : "items-end",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isInt
            ? "bg-muted text-foreground"
            : isSkipped
              ? "bg-muted text-muted-foreground italic"
              : "bg-primary text-primary-foreground",
        )}
      >
        {isInt && (meta?.stage || meta?.isFollowup) && (
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-70">
            {stageLabel && <span>{stageLabel}</span>}
            {meta.isFollowup && (
              <span className="rounded bg-foreground/10 px-1.5 py-0.5">
                {t(lang, "interview.followup")}
              </span>
            )}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">
          {displayText}
          {streaming && <span className="ml-0.5 animate-pulse">▍</span>}
        </div>
        {!isInt && !isSkipped && typeof meta?.score === "number" && (
          <div className="mt-2 text-[11px] opacity-80">
            {t(lang, "interview.score")}: {meta.score}/10
          </div>
        )}
      </div>

      {showActions && (
        <div
          className={cn(
            "flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100",
            isInt ? "self-start" : "self-end",
          )}
        >
          <span className="group/tip relative">
            <button
              type="button"
              onClick={onCopy}
              aria-label={copied ? t(lang, "interview.copied") : t(lang, "interview.copy")}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <span className={cn(
              "pointer-events-none absolute top-full z-20 mt-1 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] text-background opacity-0 shadow-md transition-opacity group-hover/tip:opacity-100",
              isInt ? "left-0" : "right-0",
            )}>
              {copied ? t(lang, "interview.copied") : t(lang, "interview.copy")}
            </span>
          </span>
          {onSkip && (
            <span className="group/tip relative">
              <button
                type="button"
                onClick={onSkip}
                aria-label={t(lang, "interview.skip.aria")}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
              <span className={cn(
              "pointer-events-none absolute top-full z-20 mt-1 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] text-background opacity-0 shadow-md transition-opacity group-hover/tip:opacity-100",
              isInt ? "left-0" : "right-0",
            )}>
                {t(lang, "interview.skip")}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Reference answer (only relevant on candidate side after a skip). */}
      {!isInt && reference && (
        <div className="max-w-[85%] rounded-2xl border-l-2 border-muted-foreground/40 bg-muted/40 px-4 py-3 text-sm leading-relaxed">
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>📖 {t(lang, "interview.reference.label")}</span>
          </div>
          <div className="whitespace-pre-wrap break-words text-foreground/90">
            {reference.text ||
              (reference.streaming
                ? t(lang, "interview.reference.streaming")
                : "")}
            {reference.streaming && (
              <span className="ml-0.5 animate-pulse">▍</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
