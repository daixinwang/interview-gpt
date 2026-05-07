/**
 * One-shot script to expand the seed question bank using Claude.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... pnpm seeds:generate -- frontend 14
 *
 * Args: <jobId> <count>
 *   jobId — must match an entry in data/seeds/jobs.json
 *   count — number of NEW questions to generate (added on top of existing)
 *
 * The script appends to data/seeds/questions/<jobId>.json so existing
 * hand-curated entries are never lost. Question IDs auto-increment.
 */
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface Job {
  id: string;
  title_en: string;
  title_zh: string;
  stack: string[];
  focus_areas: string[];
}

interface Question {
  id: string;
  stage: "opening" | "tech" | "project" | "reverse" | "closing";
  difficulty: "junior" | "mid" | "senior";
  topic: string;
  question: string;
  key_points: string[];
  follow_ups: string[];
}

const REPO_ROOT = resolve(__dirname, "..");
const JOBS_PATH = resolve(REPO_ROOT, "data/seeds/jobs.json");
const QUESTIONS_DIR = resolve(REPO_ROOT, "data/seeds/questions");

function loadJobs(): Job[] {
  return JSON.parse(readFileSync(JOBS_PATH, "utf-8"));
}

function loadExisting(jobId: string): Question[] {
  const path = resolve(QUESTIONS_DIR, `${jobId}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return [];
  }
}

function nextIdSeq(jobId: string, existing: Question[]): number {
  const prefix = jobId.slice(0, 2);
  const maxSeq = existing.reduce((max, q) => {
    const match = q.id.match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return maxSeq + 1;
}

const PROMPT_TEMPLATE = (job: Job, existing: Question[], n: number) => `You generate INTERVIEW QUESTIONS for a senior-level mock-interview product.

Job: ${job.title_en} (${job.title_zh})
Tech stack: ${job.stack.join(", ")}
Focus areas: ${job.focus_areas.join(", ")}

Existing questions (DO NOT duplicate the topics or rephrase these):
${existing.map((q) => `- [${q.topic}/${q.difficulty}] ${q.question}`).join("\n") || "(none)"}

Generate ${n} NEW questions following these rules:
1. Tone: a real, slightly impatient senior interviewer who probes for depth. NOT a polite chatbot.
2. Mix difficulties: roughly 30% junior, 50% mid, 20% senior.
3. Mix stages: 70% "tech" (concept + applied), 30% "project" (system design / case study).
4. Each question MUST come with 3-5 specific key_points the candidate should hit, and 1-3 follow_ups that probe weak/superficial answers.
5. Topics should expand coverage — if existing has heavy "react-rendering", give me less of that and more under-covered focus_areas.
6. Avoid generic prompts ("tell me about yourself", "what's your strength"). Every question must be technical or behavioral with substance.

Return ONLY a JSON array of objects with this EXACT shape:
{
  "stage": "tech" | "project",
  "difficulty": "junior" | "mid" | "senior",
  "topic": "<short-kebab-case>",
  "question": "<the question, conversational>",
  "key_points": ["<point 1>", "<point 2>", ...],
  "follow_ups": ["<probe 1>", ...]
}

Do NOT include "id" — I will assign it. Do NOT wrap in markdown code fences. Output JSON ONLY.`;

async function generate(jobId: string, count: number) {
  const jobs = loadJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    console.error(`Unknown jobId: ${jobId}. Valid: ${jobs.map((j) => j.id).join(", ")}`);
    process.exit(1);
  }

  const existing = loadExisting(jobId);
  console.log(`Loaded ${existing.length} existing questions for ${job.title_en}.`);

  const apiKey = process.env.ANTHROPIC_API_KEY_FOR_SEEDS || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Set ANTHROPIC_API_KEY (or ANTHROPIC_API_KEY_FOR_SEEDS) before running.");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const prompt = PROMPT_TEMPLATE(job, existing, count);

  console.log(`Calling ${model} for ${count} new questions...`);
  const response = await client.messages.create({
    model,
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error("No text content in response");
    process.exit(1);
  }

  const raw = textBlock.text.trim();
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let generated: Omit<Question, "id">[];
  try {
    generated = JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse Claude response as JSON:", err);
    console.error("Raw response preview:", cleaned.slice(0, 500));
    process.exit(1);
  }

  let seq = nextIdSeq(jobId, existing);
  const prefix = jobId.slice(0, 2);
  const withIds: Question[] = generated.map((q) => ({
    id: `${prefix}-${String(seq++).padStart(3, "0")}`,
    ...q,
  }));

  const merged = [...existing, ...withIds];
  const path = resolve(QUESTIONS_DIR, `${jobId}.json`);
  writeFileSync(path, JSON.stringify(merged, null, 2) + "\n", "utf-8");

  console.log(`✓ Wrote ${merged.length} questions (${withIds.length} new) to ${path}`);
}

const [, , jobId, countArg] = process.argv;
if (!jobId || !countArg) {
  console.error("Usage: pnpm seeds:generate -- <jobId> <count>");
  console.error("Example: pnpm seeds:generate -- frontend 14");
  process.exit(1);
}

generate(jobId, parseInt(countArg, 10)).catch((err) => {
  console.error(err);
  process.exit(1);
});
