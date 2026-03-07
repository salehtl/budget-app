import type { Category } from "../../types/database.ts";
import type { ParsedTransaction } from "./types.ts";
import type { PageImage } from "./pdf-to-images.ts";
import { pdfToImages } from "./pdf-to-images.ts";
import { callClaude, ImportError, type AnthropicConfig } from "./anthropic-client.ts";

const PAGES_PER_BATCH = 10;

export interface ParseProgress {
  message: string;
  phase: "rendering" | "analyzing" | "done";
  pageCount?: number;
  fileName?: string;
  batch?: number;
  totalBatches?: number;
}

function buildSystemPrompt(categories: Category[]): string {
  const expense = categories
    .filter((c) => !c.is_income && !c.parent_id)
    .map((c) => c.name);
  const income = categories
    .filter((c) => c.is_income && !c.parent_id)
    .map((c) => c.name);

  return `You are a bank statement parser. Extract every transaction from these statement images.

Output a JSON array where each object has:
- date: YYYY-MM-DD
- payee: cleaned merchant name (no reference numbers, card numbers, or bank codes)
- amount: positive number (no currency symbol)
- type: "income" or "expense" (determine from credit/debit columns or +/- signs)
- category: best match from the list below, or null if unsure
- notes: reference numbers or extra info (optional, empty string if none)

Expense categories: ${expense.join(", ")}
Income categories: ${income.join(", ")}

Rules:
- Output ONLY a JSON array, no markdown fences, no explanation
- Ignore running balances, totals, and summary rows
- Currency is AED
- Each transaction should appear exactly once
- Clean up payee names: remove card numbers, POS terminal IDs, and transaction codes
- For dates, use the transaction date (not posting date) when both are shown`;
}

function extractJSON(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Find JSON array bounds
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // Fall through
      }
    }
    throw new ImportError(
      "parse_error",
      "Unreadable Response",
      "The AI response could not be parsed as valid JSON.",
      "Try again — the AI occasionally produces malformed output.",
    );
  }
}

function deduplicate(transactions: ParsedTransaction[]): ParsedTransaction[] {
  const seen = new Set<string>();
  return transactions.filter((t) => {
    const key = `${t.date}|${t.amount}|${t.payee.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveCategoryIds(
  transactions: ParsedTransaction[],
  categories: Category[],
): ParsedTransaction[] {
  const byName = new Map<string, string>();
  for (const c of categories) {
    byName.set(c.name.toLowerCase(), c.id);
  }

  return transactions.map((t) => ({
    ...t,
    category_id: t.category ? (byName.get(t.category.toLowerCase()) ?? null) : null,
  }));
}

export async function parseStatement(
  file: File,
  categories: Category[],
  config: AnthropicConfig,
  onProgress?: (progress: ParseProgress) => void,
): Promise<ParsedTransaction[]> {
  // Step 1: Render PDF to images
  onProgress?.({ message: "Loading PDF...", phase: "rendering", fileName: file.name });

  let images: PageImage[];
  try {
    images = await pdfToImages(file, (msg) => {
      onProgress?.({ message: msg, phase: "rendering", fileName: file.name });
    });
  } catch (e) {
    if (e instanceof ImportError) throw e;
    const msg = (e as Error).message ?? "";
    throw new ImportError(
      "pdf_error",
      "PDF Error",
      msg.includes("password") ? "This PDF is password-protected." : `Failed to read PDF: ${msg.slice(0, 100)}`,
      msg.includes("password")
        ? "Remove the password protection and try again."
        : "Make sure the file is a valid PDF document.",
    );
  }

  if (images.length === 0) {
    throw new ImportError(
      "pdf_error",
      "Empty PDF",
      "The PDF has no pages.",
      "Check that you uploaded the correct file.",
    );
  }

  onProgress?.({
    message: `Rendered ${images.length} page${images.length !== 1 ? "s" : ""}`,
    phase: "rendering",
    pageCount: images.length,
    fileName: file.name,
  });

  // Step 2: Batch pages and call Claude
  const systemPrompt = buildSystemPrompt(categories);
  const allTransactions: ParsedTransaction[] = [];

  const batches: PageImage[][] = [];
  for (let i = 0; i < images.length; i += PAGES_PER_BATCH) {
    batches.push(images.slice(i, i + PAGES_PER_BATCH));
  }

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]!;
    onProgress?.({
      message: batches.length > 1
        ? `Analyzing pages (batch ${b + 1} of ${batches.length})...`
        : "Analyzing statement...",
      phase: "analyzing",
      pageCount: images.length,
      fileName: file.name,
      batch: b + 1,
      totalBatches: batches.length,
    });

    const imageContents = batch.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: img.base64,
      },
    }));

    const responseText = await callClaude(config, systemPrompt, imageContents);
    const parsed = extractJSON(responseText);

    if (!Array.isArray(parsed)) {
      throw new ImportError(
        "parse_error",
        "Unexpected Response",
        "The AI did not return a list of transactions.",
        "Try again — the AI occasionally misinterprets the format.",
      );
    }

    for (const item of parsed) {
      allTransactions.push({
        date: String(item.date ?? ""),
        payee: String(item.payee ?? ""),
        amount: Math.abs(Number(item.amount) || 0),
        type: item.type === "income" ? "income" : "expense",
        category: item.category ? String(item.category) : null,
        category_id: null,
        notes: String(item.notes ?? ""),
        selected: true,
      });
    }
  }

  // Step 3: Deduplicate and resolve category IDs
  const unique = deduplicate(allTransactions);
  const resolved = resolveCategoryIds(unique, categories);

  if (resolved.length === 0) {
    throw new ImportError(
      "no_transactions",
      "No Transactions Found",
      "The AI could not find any transactions in this PDF.",
      "Make sure this is a bank or credit card statement. Scanned images without clear text may not work.",
    );
  }

  onProgress?.({
    message: `Found ${resolved.length} transactions`,
    phase: "done",
    pageCount: images.length,
    fileName: file.name,
  });

  return resolved;
}
