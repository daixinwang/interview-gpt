/**
 * Curated catalog of LLM presets surfaced in the UI.
 *
 * The backend speaks the OpenAI Chat Completions protocol, so anything
 * with an OpenAI-compatible endpoint works — we group common providers
 * here and expose their default `base_url` so the user can pick a
 * provider with one click instead of hunting for the URL.
 *
 * The dropdown items are flattened in the form; the provider list is
 * also surfaced as quick-fill buttons for the Base URL field.
 */

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  models: ModelOption[];
}

export interface ModelOption {
  id: string;
  label: string;
}

export const PROVIDERS: ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
      { id: "o4-mini", label: "o4-mini" },
    ],
  },
  {
    id: "anthropic",
    // Anthropic exposes an OpenAI-compatible shim at /v1/openai (not /v1,
    // which is the native Messages API and rejects /chat/completions).
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1/openai",
    models: [
      { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", label: "DeepSeek-V3 (chat)" },
      { id: "deepseek-reasoner", label: "DeepSeek-R1 (reasoner)" },
    ],
  },
  {
    id: "qwen",
    label: "通义千问 / Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { id: "qwen-max", label: "Qwen Max" },
      { id: "qwen-plus", label: "Qwen Plus" },
      { id: "qwen-turbo", label: "Qwen Turbo" },
      { id: "qwen2.5-72b-instruct", label: "Qwen2.5 72B" },
    ],
  },
  {
    id: "doubao",
    label: "豆包 / Doubao",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    models: [
      { id: "doubao-1-5-pro-32k-250115", label: "Doubao 1.5 Pro" },
      { id: "doubao-1-5-lite-32k-250115", label: "Doubao 1.5 Lite" },
    ],
  },
  {
    id: "zhipu",
    label: "智谱 / GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: [
      { id: "glm-4-plus", label: "GLM-4 Plus" },
      { id: "glm-4-air", label: "GLM-4 Air" },
      { id: "glm-4-flash", label: "GLM-4 Flash (free)" },
    ],
  },
  {
    id: "moonshot",
    label: "Kimi / Moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    models: [
      { id: "moonshot-v1-8k", label: "Moonshot v1 8k" },
      { id: "moonshot-v1-32k", label: "Moonshot v1 32k" },
      { id: "moonshot-v1-128k", label: "Moonshot v1 128k" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
      { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash (free)" },
      { id: "deepseek/deepseek-chat", label: "DeepSeek V3" },
      { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    ],
  },
  {
    id: "zenmux",
    // ZenMux is an aggregator (similar to OpenRouter): one key, many models.
    // Model slugs are `<provider>/<name>` and can be copied from zenmux.ai's
    // model detail page. The list below is just a starter set — users can
    // type any slug into the model field.
    label: "ZenMux",
    baseUrl: "https://zenmux.ai/api/v1",
    models: [
      { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
      { id: "openai/gpt-5", label: "GPT-5" },
      { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "deepseek/deepseek-chat", label: "DeepSeek V3" },
      { id: "qwen/qwen3-max", label: "Qwen3 Max" },
    ],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    models: [
      { id: "llama3.1", label: "Llama 3.1" },
      { id: "qwen2.5", label: "Qwen 2.5" },
      { id: "deepseek-r1", label: "DeepSeek R1" },
    ],
  },
];

/** Flat list for the model dropdown — `[provider] model label`. */
export interface FlatModel {
  providerId: string;
  providerLabel: string;
  baseUrl: string;
  modelId: string;
  modelLabel: string;
}

export const FLAT_MODELS: FlatModel[] = PROVIDERS.flatMap((p) =>
  p.models.map((m) => ({
    providerId: p.id,
    providerLabel: p.label,
    baseUrl: p.baseUrl,
    modelId: m.id,
    modelLabel: m.label,
  })),
);
