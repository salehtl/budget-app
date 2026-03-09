import { ImportError, type ImportErrorCode } from "../errors.ts";

interface ErrorMapping {
  status: number;
  code: ImportErrorCode;
  title: string;
  message: string;
  suggestion: string;
}

/**
 * Classify an HTTP error status into an ImportError using provider-specific mappings.
 * Falls back to a generic API error if no mapping matches.
 */
export function classifyHttpError(
  status: number,
  providerName: string,
  mappings: ErrorMapping[],
): ImportError {
  const match = mappings.find((m) => m.status === status);
  if (match) {
    return new ImportError(match.code, match.title, match.message, match.suggestion);
  }
  return new ImportError(
    "api_error",
    "API Error",
    `Something went wrong while contacting the ${providerName} API.`,
    "If this persists, check your settings.",
  );
}

/** OpenAI-compatible SSE text extractor (used by OpenAI and custom providers). */
export function openaiExtractText(data: string): string | null {
  try {
    const parsed = JSON.parse(data);
    return parsed.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

/** Shared user prompt appended to images in all providers. */
export const EXTRACT_PROMPT = "Extract all transactions from these bank statement pages. Output JSON only.";
