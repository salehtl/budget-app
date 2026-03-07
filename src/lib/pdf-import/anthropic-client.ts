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

interface ContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: ContentBlock[];
  stop_reason: string;
}

interface AnthropicErrorBody {
  error?: {
    type?: string;
    message?: string;
  };
}

function parseErrorBody(text: string): AnthropicErrorBody | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function classifyApiError(status: number, body: string): ImportError {
  const parsed = parseErrorBody(body);
  const errorType = parsed?.error?.type ?? "";
  const errorMsg = parsed?.error?.message ?? body;
  const lower = errorMsg.toLowerCase();

  if (status === 401) {
    return new ImportError(
      "invalid_api_key",
      "Invalid API Key",
      "The API key was rejected by Anthropic.",
      "Check that your key is correct in Settings. Keys start with sk-ant-.",
    );
  }

  if (status === 403 || lower.includes("credit") || lower.includes("billing") || lower.includes("balance")) {
    return new ImportError(
      "credits_exhausted",
      "No API Credits",
      "Your Anthropic account has insufficient credits.",
      "Add credits at console.anthropic.com, then try again.",
    );
  }

  if (status === 429) {
    return new ImportError(
      "rate_limited",
      "Rate Limited",
      "Too many requests to the Anthropic API.",
      "Wait a minute, then try again.",
    );
  }

  if (errorType === "overloaded_error" || status === 529) {
    return new ImportError(
      "api_error",
      "API Overloaded",
      "Anthropic's API is temporarily overloaded.",
      "Wait a moment and retry.",
    );
  }

  return new ImportError(
    "api_error",
    "API Error",
    `Anthropic returned an error (${status}): ${errorMsg.slice(0, 150)}`,
    "If this persists, check your proxy URL in Settings.",
  );
}

export async function callClaude(
  config: AnthropicConfig,
  systemPrompt: string,
  imageContents: { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } }[],
): Promise<string> {
  const url = `${config.proxyUrl.replace(/\/$/, "")}/v1/messages`;

  const body = {
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
  };

  let lastError: ImportError | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const err = classifyApiError(response.status, text);

        // Only retry rate limits
        if (response.status === 429) {
          const wait = Math.pow(2, attempt + 1) * 1000;
          await new Promise((r) => setTimeout(r, wait));
          lastError = err;
          continue;
        }

        throw err;
      }

      const data: AnthropicResponse = await response.json();
      const textBlock = data.content.find((b) => b.type === "text");
      if (!textBlock?.text) {
        throw new ImportError(
          "parse_error",
          "Empty Response",
          "The AI returned an empty response.",
          "Try again — this is usually a transient issue.",
        );
      }

      return textBlock.text;
    } catch (e) {
      if (e instanceof ImportError) {
        lastError = e;
        // Don't retry non-retryable errors
        if (e.code !== "rate_limited") throw e;
        continue;
      }
      if (e instanceof TypeError && e.message.includes("fetch")) {
        throw new ImportError(
          "network_error",
          "Connection Failed",
          "Could not reach the API — the request was blocked or the network is down.",
          "Check the proxy URL in Settings, or verify your internet connection.",
        );
      }
      throw new ImportError(
        "api_error",
        "Unexpected Error",
        (e as Error).message || "Something went wrong.",
        "Try again. If this persists, check your Settings.",
      );
    }
  }

  throw lastError ?? new ImportError(
    "rate_limited",
    "Rate Limited",
    "Still rate-limited after 3 retries.",
    "Wait a minute, then try again.",
  );
}
