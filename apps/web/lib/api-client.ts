/**
 * Thin wrapper around the FastAPI backend.
 *
 * SSE note: we cannot use the browser's native EventSource because it does
 * not support custom headers, and the backend requires `X-API-Key`.
 * Instead we use fetch + ReadableStream and parse SSE frames by hand.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface StartArgs {
  jobId: string;
  jobTitle: string;
  jd: string;
  resume: string;
  model?: string;
  baseUrl?: string;
}

export interface RoundDTO {
  question: string;
  question_id: string | null;
  topic: string | null;
  stage: string;
  expected_dimensions: string[];
  is_followup: boolean;
  answer: string | null;
  score: number | null;
  strengths: string[];
  weaknesses: string[];
  should_followup: boolean;
  followup_hint: string | null;
  skipped: boolean;
  reference_answer: string | null;
}

export interface InterviewStateDTO {
  session_id: string;
  job_id: string;
  job_title: string;
  jd: string;
  resume: string;
  model: string;
  stage: string;
  rounds: RoundDTO[];
  stage_budget: Record<string, number>;
  completed: boolean;
  final_report: string | null;
}

export interface SseEvent {
  event: string;
  data: any;
}

export async function startInterview(
  args: StartArgs,
): Promise<{ session_id: string }> {
  const r = await fetch(`${API_URL}/api/interview/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: args.jobId,
      job_title: args.jobTitle,
      jd: args.jd,
      resume: args.resume,
      model: args.model,
      base_url: args.baseUrl,
    }),
  });
  if (!r.ok) throw new Error(`start failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function postAnswer(
  sessionId: string,
  answer: string,
  skipped = false,
): Promise<{ ok: boolean; round_index: number; skipped: boolean }> {
  const r = await fetch(`${API_URL}/api/interview/answer/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer: skipped ? "" : answer, skipped }),
  });
  if (!r.ok) throw new Error(`answer failed: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function fetchState(
  sessionId: string,
): Promise<InterviewStateDTO> {
  const r = await fetch(`${API_URL}/api/interview/state/${sessionId}`);
  if (!r.ok) throw new Error(`state failed: ${r.status}`);
  return r.json();
}

/** Open an SSE connection. Calls `onEvent` for each frame. Returns a
 *  promise that resolves on the stream's natural close. */
export async function streamSse(
  url: string,
  apiKey: string,
  onEvent: (ev: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch(url, {
    method: url.includes("/finish/") ? "POST" : "GET",
    headers: {
      Accept: "text/event-stream",
      "X-API-Key": apiKey,
    },
    signal,
  });
  if (!r.ok || !r.body) {
    const txt = await r.text().catch(() => "");
    throw new Error(`SSE failed: ${r.status} ${txt}`);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // SSE frames are separated by a blank line, but the line ending depends on
  // the server: sse-starlette uses CRLF (`\r\n\r\n`), classic implementations
  // use LF (`\n\n`). We normalise to LF so downstream parsing only needs to
  // handle one shape.
  const flushFrames = () => {
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const parsed = parseFrame(frame);
      if (parsed) onEvent(parsed);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    flushFrames();
  }
  // Drain any trailing frame that didn't end with a blank line before close.
  if (buffer.trim()) {
    const parsed = parseFrame(buffer);
    if (parsed) onEvent(parsed);
  }
}

function parseFrame(frame: string): SseEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  let data: any = raw;
  try {
    data = JSON.parse(raw);
  } catch {
    /* keep as string */
  }
  return { event, data };
}

export const sseUrls = {
  stream: (sid: string) => `${API_URL}/api/interview/stream/${sid}`,
  finish: (sid: string) => `${API_URL}/api/interview/finish/${sid}`,
};
