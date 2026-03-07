import type { ImportErrorCode } from "./anthropic-client.ts";
import type { ParseProgress } from "./parse-statement.ts";

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  payee: string;
  amount: number;
  type: "income" | "expense";
  category: string | null; // matched category name or null
  category_id: string | null; // resolved category ID
  notes: string;
  selected: boolean;
}

export type ImportState =
  | { step: "idle" }
  | { step: "processing"; progress: ParseProgress }
  | { step: "reviewing"; transactions: ParsedTransaction[] }
  | { step: "importing"; transactions: ParsedTransaction[] }
  | { step: "done"; count: number }
  | { step: "error"; code: ImportErrorCode; title: string; message: string; suggestion: string };
