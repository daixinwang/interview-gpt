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
  lang: Lang;
}

export function ChatBubble({ role, text, meta, streaming, reference, lang }: Props) {
  const isInt = role === "interviewer";
  const stageLabel =
    meta?.stage && t(lang, `interview.stage.${meta.stage}`) !== `interview.stage.${meta.stage}`
      ? t(lang, `interview.stage.${meta.stage}`)
      : meta?.stage;
  const isSkipped = !isInt && !!meta?.skipped;
  const displayText = isSkipped ? t(lang, "interview.skipped.label") : text;

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2",
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
