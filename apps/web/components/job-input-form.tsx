"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { JOBS, jobLabel } from "@/lib/jobs";
import { Lang, t } from "@/lib/i18n";
import { storage } from "@/lib/storage";
import { startInterview } from "@/lib/api-client";
import { extractPdfText } from "@/lib/pdf";

interface Props {
  lang: Lang;
}

export function JobInputForm({ lang }: Props) {
  const router = useRouter();

  // Job selection. `jobId` is one of the preset ids (frontend / backend / …)
  // OR the literal "custom"; in the latter case `selectedCustomTitle` picks
  // which entry of `customJobs` is active. Splitting these lets the chip
  // row render presets + multiple custom entries side-by-side without
  // overloading a single string id.
  const [jobId, setJobId] = useState<string>("frontend");
  const [customJobs, setCustomJobs] = useState<string[]>([]);
  const [selectedCustomTitle, setSelectedCustomTitle] = useState<string>("");
  // Preset ids the user has dismissed; persisted so deletions stick across
  // reloads. Always derived against `JOBS` at render time.
  const [hiddenPresets, setHiddenPresets] = useState<string[]>([]);
  // Inline-input state for the "+ Add" affordance.
  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const draftInputRef = useRef<HTMLInputElement>(null);

  const [jd, setJd] = useState("");
  const [resume, setResume] = useState("");
  const [resumeFile, setResumeFile] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // One-shot hydrate from localStorage. Persistence below is wired into
  // each onChange handler directly (rather than via [state] effects) so the
  // write path is obvious and HMR can't desync the two halves.
  // (API key / provider / model / base URL are owned by SettingsMenu and
  // read straight from storage at submit time — no local state needed.)
  useEffect(() => {
    // Custom-job migration: previous schema stored a single title; fold it
    // into the new array if the array is empty, then drop the legacy key.
    let savedCustom = storage.getCustomJobs();
    const legacy = storage.getLegacyCustomJobTitle();
    if (legacy && !savedCustom.includes(legacy)) {
      savedCustom = [legacy, ...savedCustom];
      storage.setCustomJobs(savedCustom);
    }
    if (legacy) storage.clearLegacyCustomJobTitle();
    setCustomJobs(savedCustom);

    const savedHidden = storage.getHiddenPresetJobs();
    setHiddenPresets(savedHidden);
    const visiblePresets = JOBS.filter((j) => !savedHidden.includes(j.id));

    const savedJobId = storage.getJobId();
    const savedSelected = storage.getSelectedCustomJobTitle();
    if (savedJobId === "custom" && savedSelected && savedCustom.includes(savedSelected)) {
      setJobId("custom");
      setSelectedCustomTitle(savedSelected);
    } else if (savedJobId && visiblePresets.some((j) => j.id === savedJobId)) {
      setJobId(savedJobId);
    } else if (visiblePresets.length > 0) {
      // Saved id was hidden / missing — fall back to the first visible preset.
      setJobId(visiblePresets[0].id);
    } else if (savedCustom.length > 0) {
      setJobId("custom");
      setSelectedCustomTitle(savedCustom[0]);
    } else {
      setJobId("");
    }

    setJd(storage.getJd());
    setResume(storage.getResume());
  }, []);

  // --- Job chip handlers ---------------------------------------------------

  const pickPreset = (id: string) => {
    setJobId(id);
    setSelectedCustomTitle("");
    storage.setJobId(id);
    storage.setSelectedCustomJobTitle("");
  };

  const pickCustom = (title: string) => {
    setJobId("custom");
    setSelectedCustomTitle(title);
    storage.setJobId("custom");
    storage.setSelectedCustomJobTitle(title);
  };

  // Pick the next valid selection after a chip removal. Prefers any remaining
  // visible preset, then the first surviving custom title, else clears.
  const fallbackSelection = (
    nextHidden: string[],
    nextCustom: string[],
  ): { id: string; custom: string } => {
    const firstPreset = JOBS.find((j) => !nextHidden.includes(j.id));
    if (firstPreset) return { id: firstPreset.id, custom: "" };
    if (nextCustom.length > 0) return { id: "custom", custom: nextCustom[0] };
    return { id: "", custom: "" };
  };

  const removeCustom = (title: string) => {
    const next = customJobs.filter((t) => t !== title);
    setCustomJobs(next);
    storage.setCustomJobs(next);
    if (jobId === "custom" && selectedCustomTitle === title) {
      const { id, custom } = fallbackSelection(hiddenPresets, next);
      setJobId(id);
      setSelectedCustomTitle(custom);
      storage.setJobId(id);
      storage.setSelectedCustomJobTitle(custom);
    }
  };

  const removePreset = (id: string) => {
    const nextHidden = [...hiddenPresets, id];
    setHiddenPresets(nextHidden);
    storage.setHiddenPresetJobs(nextHidden);
    if (jobId === id) {
      const { id: nextId, custom } = fallbackSelection(nextHidden, customJobs);
      setJobId(nextId);
      setSelectedCustomTitle(custom);
      storage.setJobId(nextId);
      storage.setSelectedCustomJobTitle(custom);
    }
  };

  const startAdding = () => {
    setError(null);
    setDraftTitle("");
    setAdding(true);
    // Defer focus until the input has rendered.
    requestAnimationFrame(() => draftInputRef.current?.focus());
  };

  const commitAdding = () => {
    const title = draftTitle.trim();
    if (!title) {
      setAdding(false);
      return;
    }
    if (customJobs.includes(title)) {
      setError(t(lang, "home.error.job.duplicate"));
      // Auto-select the existing entry so the click still feels useful.
      pickCustom(title);
      setAdding(false);
      return;
    }
    const next = [...customJobs, title];
    setCustomJobs(next);
    storage.setCustomJobs(next);
    pickCustom(title);
    setAdding(false);
  };

  const cancelAdding = () => {
    setAdding(false);
    setDraftTitle("");
  };

  // --- Resume / JD persistence --------------------------------------------

  const onJdChange = (value: string) => {
    setJd(value);
    storage.setJd(value);
  };

  const onResumeChange = (value: string) => {
    setResume(value);
    storage.setResume(value);
    if (resumeFile) setResumeFile(null);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsing(true);
    try {
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      const text = isPdf ? await extractPdfText(file) : await file.text();
      if (!text.trim()) {
        throw new Error(
          "Could not extract any text from this file (it may be a scanned image PDF).",
        );
      }
      setResume(text);
      storage.setResume(text);
      setResumeFile(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    // API key / model / base URL live in the SettingsMenu now; pull whatever
    // the user last saved at submit time.
    const apiKey = storage.getApiKey();
    const model = storage.getModel();
    const baseUrl = storage.getBaseUrl();
    if (!apiKey.trim()) {
      setError(t(lang, "interview.error.apikey"));
      return;
    }
    if (!jd.trim() || !resume.trim()) return;
    const isCustom = jobId === "custom";
    if (isCustom && !selectedCustomTitle.trim()) {
      setError(t(lang, "home.error.job.custom"));
      return;
    }

    setSubmitting(true);
    try {
      const job = JOBS.find((j) => j.id === jobId);
      const resolvedId = isCustom ? "custom" : job!.id;
      const resolvedTitle = isCustom
        ? selectedCustomTitle.trim()
        : jobLabel(job!, lang);
      const { session_id } = await startInterview({
        jobId: resolvedId,
        jobTitle: resolvedTitle,
        jd: jd.trim(),
        resume: resume.trim(),
        model: model.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
      });
      storage.upsertSession({
        sessionId: session_id,
        jobTitle: resolvedTitle,
        jobId: resolvedId,
        startedAt: Date.now(),
        completed: false,
      });
      router.push(`/interview/${session_id}?lang=${lang}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  // Shared chip class so preset / custom / add buttons stay visually consistent.
  const chipClass = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm transition-colors ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background hover:bg-accent"
    }`;

  // Deletable chip wrapper. The × sits to the *right* of the chip (not inside)
  // so the chip itself keeps symmetric padding; we only reserve space when
  // hovered to keep the row tidy at rest.
  const DeletableChip = ({
    label,
    active,
    onPick,
    onRemove,
  }: {
    label: string;
    active: boolean;
    onPick: () => void;
    onRemove: () => void;
  }) => (
    <span className="group inline-flex items-center">
      <button type="button" onClick={onPick} className={chipClass(active)}>
        {label}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={t(lang, "home.aria.job.remove")}
        className="ml-0 inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-muted-foreground opacity-0 transition-all hover:bg-destructive hover:text-destructive-foreground group-hover:ml-1.5 group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label>{t(lang, "home.section.job")}</Label>
        <div className="flex flex-wrap items-center gap-2">
          {JOBS.filter((j) => !hiddenPresets.includes(j.id)).map((j) => (
            <DeletableChip
              key={j.id}
              label={jobLabel(j, lang)}
              active={jobId === j.id}
              onPick={() => pickPreset(j.id)}
              onRemove={() => removePreset(j.id)}
            />
          ))}
          {customJobs.map((title) => (
            <DeletableChip
              key={title}
              label={title}
              active={jobId === "custom" && selectedCustomTitle === title}
              onPick={() => pickCustom(title)}
              onRemove={() => removeCustom(title)}
            />
          ))}
          {adding ? (
            <Input
              ref={draftInputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAdding();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelAdding();
                }
              }}
              onBlur={commitAdding}
              placeholder={t(lang, "home.placeholder.job.custom")}
              className="h-8 w-64 rounded-full px-4 text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={startAdding}
              className={chipClass(false)}
            >
              {t(lang, "home.section.job.add")}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="jd">{t(lang, "home.section.jd")}</Label>
        <Textarea
          id="jd"
          rows={6}
          value={jd}
          onChange={(e) => onJdChange(e.target.value)}
          placeholder={t(lang, "home.placeholder.jd")}
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="resume">{t(lang, "home.section.resume")}</Label>
          <div className="flex items-center gap-2">
            {resumeFile && (
              <span className="text-xs text-muted-foreground">
                {t(lang, "home.resume.uploaded")}: {resumeFile}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" />
              {parsing
                ? t(lang, "home.resume.parsing")
                : t(lang, "home.resume.upload")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
              className="hidden"
              onChange={onFile}
            />
          </div>
        </div>
        <Textarea
          id="resume"
          rows={5}
          value={resume}
          onChange={(e) => onResumeChange(e.target.value)}
          placeholder={t(lang, "home.placeholder.resume")}
          required
        />
        <p className="text-xs text-muted-foreground">
          {t(lang, "home.resume.upload.hint")}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "…" : t(lang, "home.cta.start")}
      </Button>
    </form>
  );
}
