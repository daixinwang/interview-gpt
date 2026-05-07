"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { JOBS, jobLabel } from "@/lib/jobs";
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
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setApiKey(storage.getApiKey());
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!apiKey.trim()) {
      setError(t(lang, "interview.error.apikey"));
      return;
    }
    if (!jd.trim() || !resume.trim()) return;

    storage.setApiKey(apiKey.trim());
    setSubmitting(true);
    try {
      const job = JOBS.find((j) => j.id === jobId)!;
      const { session_id } = await startInterview({
        jobId: job.id,
        jobTitle: jobLabel(job, lang),
        jd: jd.trim(),
        resume: resume.trim(),
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
        <Label htmlFor="resume">{t(lang, "home.section.resume")}</Label>
        <Textarea
          id="resume"
          rows={5}
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          placeholder={t(lang, "home.placeholder.resume")}
          required
        />
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
