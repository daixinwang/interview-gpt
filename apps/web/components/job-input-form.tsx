"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { JOBS, jobLabel } from "@/lib/jobs";
import { PROVIDERS } from "@/lib/models";
import { Lang, t } from "@/lib/i18n";
import { storage } from "@/lib/storage";
import { startInterview } from "@/lib/api-client";

interface Props {
  lang: Lang;
}

export function JobInputForm({ lang }: Props) {
  const router = useRouter();
  const [jobId, setJobId] = useState("frontend");
  const [jd, setJd] = useState("");
  const [resume, setResume] = useState("");
  const [resumeFile, setResumeFile] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [providerId, setProviderId] = useState<string>(PROVIDERS[0].id);
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const provider =
    PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[0];
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApiKey(storage.getApiKey());
    const savedModel = storage.getModel();
    const savedBase = storage.getBaseUrl();
    setModel(savedModel);
    setBaseUrl(savedBase);
    // Try to infer the provider from the saved base URL so the dropdown
    // lands on the user's actual provider rather than the default.
    if (savedBase) {
      const match = PROVIDERS.find((p) => p.baseUrl === savedBase);
      if (match) setProviderId(match.id);
    }
    // First-time visitors get the OpenAI default base URL pre-filled —
    // less friction for the most common case.
    if (!savedBase) setBaseUrl(PROVIDERS[0].baseUrl);
    if (!savedModel) setModel(PROVIDERS[0].models[0].id);
  }, []);

  const onProviderChange = (id: string) => {
    setProviderId(id);
    const next = PROVIDERS.find((p) => p.id === id);
    if (!next) return;
    setBaseUrl(next.baseUrl);
    // Snap the model to the provider's first option to keep things consistent.
    setModel(next.models[0].id);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setResume(text);
      setResumeFile(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      // Reset input so re-uploading the same file still fires onChange.
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!apiKey.trim()) {
      setError(t(lang, "interview.error.apikey"));
      return;
    }
    if (!jd.trim() || !resume.trim()) return;

    storage.setApiKey(apiKey.trim());
    storage.setModel(model.trim());
    storage.setBaseUrl(baseUrl.trim());
    setSubmitting(true);
    try {
      const job = JOBS.find((j) => j.id === jobId)!;
      const { session_id } = await startInterview({
        jobId: job.id,
        jobTitle: jobLabel(job, lang),
        jd: jd.trim(),
        resume: resume.trim(),
        model: model.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
      });
      storage.upsertSession({
        sessionId: session_id,
        jobTitle: jobLabel(job, lang),
        jobId: job.id,
        startedAt: Date.now(),
        completed: false,
      });
      router.push(`/interview/${session_id}?lang=${lang}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label>{t(lang, "home.section.job")}</Label>
        <div className="flex flex-wrap gap-2">
          {JOBS.map((j) => (
            <button
              type="button"
              key={j.id}
              onClick={() => setJobId(j.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                jobId === j.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              {jobLabel(j, lang)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="jd">{t(lang, "home.section.jd")}</Label>
        <Textarea
          id="jd"
          rows={6}
          value={jd}
          onChange={(e) => setJd(e.target.value)}
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
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Upload className="h-3.5 w-3.5" />
              {t(lang, "home.resume.upload")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={onFile}
            />
          </div>
        </div>
        <Textarea
          id="resume"
          rows={5}
          value={resume}
          onChange={(e) => {
            setResume(e.target.value);
            // If user manually edits, drop the file label.
            if (resumeFile) setResumeFile(null);
          }}
          placeholder={t(lang, "home.placeholder.resume")}
          required
        />
        <p className="text-xs text-muted-foreground">
          {t(lang, "home.resume.upload.hint")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="apikey">{t(lang, "home.section.apikey")}</Label>
        <Input
          id="apikey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t(lang, "home.placeholder.apikey")}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          {t(lang, "home.apikey.help")}
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {advancedOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {t(lang, "home.advanced.toggle")}
        </button>

        {advancedOpen && (
          <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
            <div className="space-y-2">
              <Label>{t(lang, "home.section.provider")}</Label>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => onProviderChange(p.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      providerId === p.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="model">{t(lang, "home.section.model")}</Label>
                <select
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {provider.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                  {/* Allow saved-but-unlisted custom IDs to remain selected. */}
                  {model && !provider.models.some((m) => m.id === model) && (
                    <option value={model}>{model}</option>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseurl">
                  {t(lang, "home.section.baseurl")}
                </Label>
                <Input
                  id="baseurl"
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={t(lang, "home.placeholder.baseurl")}
                  autoComplete="off"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(lang, "home.baseurl.help")}
            </p>
          </div>
        )}
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
