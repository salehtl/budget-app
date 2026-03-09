import type { ProviderId, LLMProvider, ModelOption } from "../llm-provider.ts";
import { anthropicProvider, ANTHROPIC_MODELS, ANTHROPIC_DEFAULT_MODEL } from "./anthropic.ts";
import { openaiProvider, OPENAI_MODELS, OPENAI_DEFAULT_MODEL } from "./openai.ts";
import { geminiProvider, GEMINI_MODELS, GEMINI_DEFAULT_MODEL } from "./gemini.ts";
import { customProvider } from "./custom.ts";

const providers: Record<ProviderId, LLMProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  custom: customProvider,
};

export const DEFAULT_PROVIDER: ProviderId = "anthropic";

export function getProvider(id: ProviderId): LLMProvider {
  return providers[id];
}

export const PROVIDER_MODELS: Record<ProviderId, ModelOption[]> = {
  anthropic: ANTHROPIC_MODELS,
  openai: OPENAI_MODELS,
  gemini: GEMINI_MODELS,
  custom: [],
};

export const PROVIDER_DEFAULTS: Record<ProviderId, string> = {
  anthropic: ANTHROPIC_DEFAULT_MODEL,
  openai: OPENAI_DEFAULT_MODEL,
  gemini: GEMINI_DEFAULT_MODEL,
  custom: "",
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Google Gemini",
  custom: "Custom (OpenAI-compatible)",
};

export const PROVIDER_KEY_PLACEHOLDERS: Record<ProviderId, string> = {
  anthropic: "sk-ant-...",
  openai: "sk-...",
  gemini: "AIza...",
  custom: "Optional",
};

export { ANTHROPIC_MODELS, ANTHROPIC_DEFAULT_MODEL } from "./anthropic.ts";
export { OPENAI_MODELS, OPENAI_DEFAULT_MODEL } from "./openai.ts";
export { GEMINI_MODELS, GEMINI_DEFAULT_MODEL } from "./gemini.ts";
