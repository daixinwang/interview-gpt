"use client";

/**
 * SettingsMenu — dropdown anchored to the "InterviewGPT" title in the top
 * bar. Holds the BYOK API key plus advanced LLM settings (provider, model,
 * base URL). Pulled out of the main form because they rarely change once
 * configured, and because the form should stay focused on per-interview
 * inputs (job / JD / resume).
 *
 * Each control writes directly to localStorage on change; the form reads
 * the latest values at submit time. No prop drilling, no shared context.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROVIDERS } from "@/lib/models";
import { Lang, t } from "@/lib/i18n";
import { storage } from "@/lib/storage";

interface Props {
  lang: Lang;
  /** Click target — typically the "InterviewGPT" title text. */
  triggerLabel: string;
}

export function SettingsMenu({ lang, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [providerId, setProviderId] = useState<string>(PROVIDERS[0].id);
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);

  // Hydrate from storage on first mount.
  useEffect(() => {
    setApiKey(storage.getApiKey());
    const savedModel = storage.getModel();
    const savedBase = storage.getBaseUrl();
    if (savedBase) {
      const match = PROVIDERS.find((p) => p.baseUrl === savedBase);
      if (match) setProviderId(match.id);
    }
    setModel(savedModel || PROVIDERS[0].models[0].id);
    setBaseUrl(savedBase || PROVIDERS[0].baseUrl);
  }, []);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const provider =
    PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[0];

  const onApiKeyChange = (value: string) => {
    setApiKey(value);
    storage.setApiKey(value.trim());
  };

  const onProviderChange = (id: string) => {
    setProviderId(id);
    const next = PROVIDERS.find((p) => p.id === id);
    if (!next) return;
    setBaseUrl(next.baseUrl);
    setModel(next.models[0].id);
    storage.setBaseUrl(next.baseUrl);
    storage.setModel(next.models[0].id);
  };

  const onModelChange = (value: string) => {
    setModel(value);
    storage.setModel(value);
  };

  const onBaseUrlChange = (value: string) => {
    setBaseUrl(value);
    storage.setBaseUrl(value.trim());
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-base font-semibold tracking-tight transition-colors hover:bg-accent"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {triggerLabel}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[22rem] rounded-md border border-border bg-background p-4 text-foreground shadow-lg">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-apikey">
                {t(lang, "home.section.apikey")}
              </Label>
              <Input
                id="settings-apikey"
                type="password"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder={t(lang, "home.placeholder.apikey")}
                autoComplete="off"
              />
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t(lang, "home.apikey.help")}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>{t(lang, "home.section.provider")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {PROVIDERS.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => onProviderChange(p.id)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
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

            <div className="space-y-1.5">
              <Label htmlFor="settings-model">
                {t(lang, "home.section.model")}
              </Label>
              <select
                id="settings-model"
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

            <div className="space-y-1.5">
              <Label htmlFor="settings-baseurl">
                {t(lang, "home.section.baseurl")}
              </Label>
              <Input
                id="settings-baseurl"
                type="url"
                value={baseUrl}
                onChange={(e) => onBaseUrlChange(e.target.value)}
                placeholder={t(lang, "home.placeholder.baseurl")}
                autoComplete="off"
              />
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t(lang, "home.baseurl.help")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
