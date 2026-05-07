/**
 * Curated list of Claude models the user can pick from in the UI.
 * Keep IDs in sync with what the Anthropic API accepts.
 * The backend defaults to `settings.anthropic_model` when this is unset.
 */

export interface ModelOption {
  id: string;
  label: string;
}

export const MODEL_PRESETS: ModelOption[] = [
  { id: "", label: "Default" },
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  { id: "claude-3-5-sonnet-latest", label: "Sonnet 3.5" },
  { id: "claude-3-5-haiku-latest", label: "Haiku 3.5" },
];
