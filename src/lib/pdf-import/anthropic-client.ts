import Anthropic from "@anthropic-ai/sdk";

export interface AnthropicConfig {
  apiKey: string;
  proxyUrl: string;
}

export type ImportErrorCode =
  | "no_api_key"
  | "invalid_api_key"
  | "credits_exhausted"
  | "rate_limited"
  | "network_error"
  | "pdf_error"
  | "parse_error"
  | "no_transactions"
  | "api_error";

export class ImportError extends Error {
  code: ImportErrorCode;
  title: string;
  suggestion: string;

  constructor(code: ImportErrorCode, title: string, message: string, suggestion: string) {
    super(message);
    this.code = code;
    this.title = title;
    this.suggestion = suggestion;
  }
}

function classifyApiError(err: unknown): ImportError {
  if (err instanceof Anthropic.AuthenticationError) {
    return new ImportError(
      "invalid_api_key",
      "Invalid API Key",
      "The API key was rejected by Anthropic.",
      "Check that your key is correct in Settings. Keys start with sk-ant-.",
    );
  }

  if (err instanceof Anthropic.PermissionDeniedError) {
    const msg = err.message.toLowerCase();
    if (msg.includes("credit") || msg.includes("billing") || msg.includes("balance")) {
      return new ImportError(
        "credits_exhausted",
        "No API Credits",
        "Your Anthropic account has insufficient credits.",
        "Add credits at console.anthropic.com, then try again.",
      );
    }
    return new ImportError(
      "network_error",
      "Access Forbidden",
      "The server rejected the request. Your account may not have permission for this action.",
      "Check your proxy URL in Settings. If using a proxy, make sure it allows requests to the Anthropic API.",
    );
  }

  if (err instanceof Anthropic.RateLimitError) {
    return new ImportError(
      "rate_limited",
      "Rate Limited",
      "Too many requests to the Anthropic API.",
      "Wait a minute, then try again.",
    );
  }

  if (err instanceof Anthropic.InternalServerError && err.status === 529) {
    return new ImportError(
      "api_error",
      "API Overloaded",
      "Anthropic's API is temporarily overloaded.",
      "Wait a moment and retry.",
    );
  }

  if (err instanceof Anthropic.APIConnectionError) {
    return new ImportError(
      "network_error",
      "Connection Failed",
      "Could not reach the API. The request may have been blocked or the network is down.",
      "Check the proxy URL in Settings, or verify your internet connection.",
    );
  }

  if (err instanceof Anthropic.APIError) {
    return new ImportError(
      "api_error",
      "API Error",
      "Something went wrong while contacting the API.",
      "If this persists, check your proxy URL in Settings.",
    );
  }

  return new ImportError(
    "api_error",
    "Unexpected Error",
    "Something went wrong.",
    "Try again. If this persists, check your Settings.",
  );
}

export async function callClaude(
  config: AnthropicConfig,
  systemPrompt: string,
  imageContents: { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } }[],
): Promise<string> {
  // Route through local proxy by default (avoids CORS/COEP issues).
  // Custom proxy URL overrides the default.
  const baseURL = config.proxyUrl
    ? config.proxyUrl.replace(/\/$/, "")
    : `${window.location.origin}/api/anthropic`;

  const client = new Anthropic({
    apiKey: config.apiKey,
    dangerouslyAllowBrowser: true,
    baseURL,
  });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            ...imageContents,
            { type: "text", text: "Extract all transactions from these bank statement pages. Output JSON only." },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new ImportError(
        "parse_error",
        "Empty Response",
        "The AI returned an empty response.",
        "Try again — this is usually a transient issue.",
      );
    }

    return textBlock.text;
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw classifyApiError(e);
  }
}
