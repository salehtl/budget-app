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
  duplicate?: boolean; // true if a matching transaction exists in the DB
  sourceFile?: string; // original filename for multi-file grouping
}

export interface ImportFile {
  file: File;
  pageCount?: number;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  transactionCount: number;
}

export type ImportState =
  | { step: "idle" }
  | { step: "file-queue"; files: ImportFile[] }
  | { step: "processing"; progress: ParseProgress; files: ImportFile[] }
  | { step: "streaming"; transactions: ParsedTransaction[]; progress: ParseProgress; files: ImportFile[] }
  | { step: "reviewing"; transactions: ParsedTransaction[]; files: ImportFile[] }
  | { step: "importing"; transactions: ParsedTransaction[] }
  | { step: "done"; count: number; fileCount: number }
  | { step: "error"; code: ImportErrorCode; title: string; message: string; suggestion: string };
