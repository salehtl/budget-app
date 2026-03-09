import { ImportError } from "../errors.ts";

/**
 * Read an SSE stream, extracting text content via a provider-specific extractor.
 * Returns the full accumulated text.
 */
export async function readSSEStream(
  response: Response,
  extractText: (data: string) => string | null,
  onText: (chunk: string) => void,
): Promise<string> {
  if (!response.body) {
    throw new ImportError("api_error", "Empty Response", "No response body received.", "Try again.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  let buffer = "";
  let done = false;

  try {
    while (!done) {
      const result = await reader.read();
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!; // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") { done = true; break; }

        const text = extractText(data);
        if (text) {
          accumulated += text;
          onText(text);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return accumulated;
}
