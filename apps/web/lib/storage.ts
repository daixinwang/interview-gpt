/**
 * localStorage helpers for the BYOK API key and session history.
 * All values are scoped under `igpt:` to keep the dev console tidy.
 */

const KEY_API = "igpt:anthropic-key";
const KEY_SESSIONS = "igpt:sessions";
const KEY_LANGUAGE = "igpt:lang";
const KEY_BASE_URL = "igpt:base-url";
const KEY_MODEL = "igpt:model";
const KEY_JOB_ID = "igpt:job-id";
// Legacy single-value field: kept for one-shot migration into KEY_JOBS_CUSTOM.
const KEY_JOB_CUSTOM = "igpt:job-custom-title";
// Selected custom title when jobId === "custom" (which entry in the saved list).
const KEY_JOB_CUSTOM_SELECTED = "igpt:job-custom-selected";
// User's saved custom job titles, JSON array. Lets the candidate keep a few
// custom roles around as chips alongside the built-in presets.
const KEY_JOBS_CUSTOM = "igpt:jobs-custom";
// Preset job ids the user has dismissed from the chip row, JSON array. Lets
// us "delete" built-in presets without ever shipping a destructive constant
// edit; presets re-appear if the user clears localStorage.
const KEY_JOBS_HIDDEN_PRESETS = "igpt:jobs-hidden-presets";
const KEY_JD = "igpt:jd";
const KEY_RESUME = "igpt:resume";

export interface SavedSession {
  sessionId: string;
  jobTitle: string;
  jobId: string;
  startedAt: number;
  completed: boolean;
}

export const storage = {
  getApiKey(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(KEY_API) || "";
  },
  setApiKey(value: string) {
    if (typeof window === "undefined") return;
    if (!value) window.localStorage.removeItem(KEY_API);
    else window.localStorage.setItem(KEY_API, value);
  },
  clearApiKey() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEY_API);
  },

  getLanguage(): "zh" | "en" {
    if (typeof window === "undefined") return "zh";
    return (window.localStorage.getItem(KEY_LANGUAGE) as "zh" | "en") || "zh";
  },
  setLanguage(value: "zh" | "en") {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY_LANGUAGE, value);
  },

  getBaseUrl(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(KEY_BASE_URL) || "";
  },
  setBaseUrl(value: string) {
    if (typeof window === "undefined") return;
    if (!value) window.localStorage.removeItem(KEY_BASE_URL);
    else window.localStorage.setItem(KEY_BASE_URL, value);
  },

  getModel(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(KEY_MODEL) || "";
  },
  setModel(value: string) {
    if (typeof window === "undefined") return;
    if (!value) window.localStorage.removeItem(KEY_MODEL);
    else window.localStorage.setItem(KEY_MODEL, value);
  },

  // JD / resume / chosen job role are persisted because they don't change
  // run-to-run: most users iterate on the same target role for weeks.
  // Stored locally only — never sent anywhere except as the regular start
  // payload to our own backend.
  getJobId(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(KEY_JOB_ID) || "";
  },
  setJobId(value: string) {
    if (typeof window === "undefined") return;
    if (!value) window.localStorage.removeItem(KEY_JOB_ID);
    else window.localStorage.setItem(KEY_JOB_ID, value);
  },
  // Legacy single-value field — only read for migration. Writes always go
  // through setCustomJobs / setSelectedCustomJobTitle.
  getLegacyCustomJobTitle(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(KEY_JOB_CUSTOM) || "";
  },
  clearLegacyCustomJobTitle() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(KEY_JOB_CUSTOM);
  },
  getCustomJobs(): string[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(KEY_JOBS_CUSTOM);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      // Defensive: drop anything that isn't a non-empty string.
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string" && !!x.trim())
        : [];
    } catch {
      return [];
    }
  },
  setCustomJobs(list: string[]) {
    if (typeof window === "undefined") return;
    const cleaned = Array.from(
      new Set(list.map((s) => s.trim()).filter(Boolean)),
    );
    if (cleaned.length === 0) window.localStorage.removeItem(KEY_JOBS_CUSTOM);
    else window.localStorage.setItem(KEY_JOBS_CUSTOM, JSON.stringify(cleaned));
  },
  getHiddenPresetJobs(): string[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(KEY_JOBS_HIDDEN_PRESETS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === "string" && !!x.trim())
        : [];
    } catch {
      return [];
    }
  },
  setHiddenPresetJobs(list: string[]) {
    if (typeof window === "undefined") return;
    const cleaned = Array.from(
      new Set(list.map((s) => s.trim()).filter(Boolean)),
    );
    if (cleaned.length === 0)
      window.localStorage.removeItem(KEY_JOBS_HIDDEN_PRESETS);
    else
      window.localStorage.setItem(
        KEY_JOBS_HIDDEN_PRESETS,
        JSON.stringify(cleaned),
      );
  },
  getSelectedCustomJobTitle(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(KEY_JOB_CUSTOM_SELECTED) || "";
  },
  setSelectedCustomJobTitle(value: string) {
    if (typeof window === "undefined") return;
    if (!value) window.localStorage.removeItem(KEY_JOB_CUSTOM_SELECTED);
    else window.localStorage.setItem(KEY_JOB_CUSTOM_SELECTED, value);
  },
  getJd(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(KEY_JD) || "";
  },
  setJd(value: string) {
    if (typeof window === "undefined") return;
    if (!value) window.localStorage.removeItem(KEY_JD);
    else window.localStorage.setItem(KEY_JD, value);
  },
  getResume(): string {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(KEY_RESUME) || "";
  },
  setResume(value: string) {
    if (typeof window === "undefined") return;
    if (!value) window.localStorage.removeItem(KEY_RESUME);
    else window.localStorage.setItem(KEY_RESUME, value);
  },

  listSessions(): SavedSession[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(KEY_SESSIONS) || "[]");
    } catch {
      return [];
    }
  },
  upsertSession(s: SavedSession) {
    const list = storage.listSessions();
    const idx = list.findIndex((x) => x.sessionId === s.sessionId);
    if (idx >= 0) list[idx] = s;
    else list.unshift(s);
    window.localStorage.setItem(KEY_SESSIONS, JSON.stringify(list.slice(0, 20)));
  },
  removeSession(sessionId: string) {
    const list = storage.listSessions().filter((x) => x.sessionId !== sessionId);
    window.localStorage.setItem(KEY_SESSIONS, JSON.stringify(list));
  },
};
