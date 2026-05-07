/**
 * localStorage helpers for the BYOK API key and session history.
 * All values are scoped under `igpt:` to keep the dev console tidy.
 */

const KEY_API = "igpt:anthropic-key";
const KEY_SESSIONS = "igpt:sessions";
const KEY_LANGUAGE = "igpt:lang";

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
