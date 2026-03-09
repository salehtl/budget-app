export type ProviderId = "anthropic" | "openai" | "gemini" | "custom";

export interface LLMConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string; // empty = use built-in proxy route
}

export interface LLMProvider {
  stream(
    config: LLMConfig,
    systemPrompt: string,
    images: string[], // base64 PNG data strings
    onText: (chunk: string) => void,
  ): Promise<string>;
}

export interface ModelOption {
  id: string;
  label: string;
  description: string;
}
