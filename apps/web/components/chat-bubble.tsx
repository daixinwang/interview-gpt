import { cn } from "@/lib/utils";
import { Lang, t } from "@/lib/i18n";

interface Props {
  role: "interviewer" | "candidate";
  text: string;
  meta?: {
    stage?: string;
    isFollowup?: boolean;
    score?: number | null;
  };
  streaming?: boolean;
  lang: Lang;
}

export function ChatBubble({ role, text, meta, streaming, lang }: Props) {
  const isInt = role === "interviewer";
  const stageLabel =
    meta?.stage && t(lang, `interview.stage.${meta.stage}`) !== `interview.stage.${meta.stage}`
      ? t(lang, `interview.stage.${meta.stage}`)
      : meta?.stage;

  return (
    <div
      className={cn(
        "flex w-full",
        isInt ? "justify-start" : "justify-end",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isInt
            ? "bg-muted text-foreground"
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
          {text}
          {streaming && <span className="ml-0.5 animate-pulse">▍</span>}
        </div>
        {!isInt && typeof meta?.score === "number" && (
          <div className="mt-2 text-[11px] opacity-80">
            {t(lang, "interview.score")}: {meta.score}/10
          </div>
        )}
      </div>
    </div>
  );
}
