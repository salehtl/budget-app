import type { ImportErrorCode } from "./anthropic-client.ts";
import type { ParseProgress } from "./parse-statement.ts";

export interface FileProgress {
  fileIndex: number;
  totalFiles: number;
}

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  payee: string;
  amount: number;
  type: "income" | "expense";
  category: string | null; // matched category name or null
  category_id: string | null; // resolved category ID
  notes: string;
  selected: boolean;
  duplicate?: boolean; // true if a matching transaction exists in the DB
}

export type ImportState =
  | { step: "idle" }
  | { step: "processing"; progress: ParseProgress; fileProgress?: FileProgress }
  | { step: "streaming"; transactions: ParsedTransaction[]; progress: ParseProgress; fileProgress?: FileProgress }
  | { step: "reviewing"; transactions: ParsedTransaction[] }
  | { step: "importing"; transactions: ParsedTransaction[] }
  | { step: "done"; count: number }
  | { step: "error"; code: ImportErrorCode; title: string; message: string; suggestion: string };
