import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Modal } from "../ui/Modal.tsx";
import { Button } from "../ui/Button.tsx";
import { CategoryCombo } from "../ui/CategoryCombo.tsx";
import { useToast } from "../ui/Toast.tsx";
import { useDb } from "../../context/DbContext.tsx";
import { getSetting } from "../../db/queries/settings.ts";
import { parseStatement } from "../../lib/pdf-import/parse-statement.ts";
import { bulkInsertTransactions } from "../../lib/pdf-import/bulk-insert.ts";
import { ImportError } from "../../lib/pdf-import/anthropic-client.ts";
import { formatCurrency } from "../../lib/format.ts";
import type { Category } from "../../types/database.ts";
import type { ParsedTransaction, ImportState } from "../../lib/pdf-import/types.ts";
import type { ParseProgress } from "../../lib/pdf-import/parse-statement.ts";

interface PdfImportModalProps {
  open: boolean;
  onClose: () => void;
  file: File;
  categories: Category[];
}

export function PdfImportModal({ open, onClose, file, categories }: PdfImportModalProps) {
  const db = useDb();
  const { toast } = useToast();
  const [state, setState] = useState<ImportState>({ step: "idle" });
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!open || state.step !== "idle") return;

    const runId = ++runIdRef.current;
    const isCurrent = () => runId === runIdRef.current;

    async function run() {
      try {
        const apiKey = await getSetting(db, "anthropic_api_key");
        if (!isCurrent()) return;
        if (!apiKey) {
          setState({
            step: "error",
            code: "no_api_key",
            title: "API Key Required",
            message: "You need an Anthropic API key to import PDFs.",
            suggestion: "Add your API key in Settings under AI Integration.",
          });
          return;
        }

        const proxyUrl =
          (await getSetting(db, "anthropic_proxy_url")) || "";

        setState({
          step: "processing",
          progress: { message: "Starting...", phase: "rendering", fileName: file.name },
        });

        const transactions = await parseStatement(
          file,
          categories,
          { apiKey, proxyUrl },
          (progress) => {
            if (isCurrent()) setState({ step: "processing", progress });
          },
        );

        if (isCurrent()) {
          setState({ step: "reviewing", transactions });
        }
      } catch (e) {
        if (!isCurrent()) return;
        if (e instanceof ImportError) {
          setState({
            step: "error",
            code: e.code,
            title: e.title,
            message: e.message,
            suggestion: e.suggestion,
          });
        } else {
          setState({
            step: "error",
            code: "api_error",
            title: "Unexpected Error",
            message: (e as Error).message || "Something went wrong.",
            suggestion: "Try again. If this persists, check your Settings.",
          });
        }
      }
    }

    run();
  }, [open, state.step, db, file, categories]);

  function handleClose() {
    setState({ step: "idle" });
    onClose();
  }

  const title =
    state.step === "processing"
      ? "Importing Statement"
      : state.step === "reviewing" || state.step === "importing"
        ? "Review Transactions"
        : state.step === "done"
          ? "Import Complete"
          : state.step === "error"
            ? state.title
            : "Import PDF";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size={state.step === "reviewing" || state.step === "importing" ? "wide" : "default"}
    >
      {state.step === "processing" && (
        <ProcessingView progress={state.progress} />
      )}
      {(state.step === "reviewing" || state.step === "importing") && (
        <ReviewView
          transactions={state.transactions}
          categories={categories}
          importing={state.step === "importing"}
          onImport={async (txns) => {
            setState({ step: "importing", transactions: txns });
            try {
              const count = await bulkInsertTransactions(db, txns);
              setState({ step: "done", count });
            } catch (e: any) {
              toast(`Import failed: ${e.message}`, "error");
              setState({ step: "reviewing", transactions: txns });
            }
          }}
          onCancel={handleClose}
          fileName={file.name}
        />
      )}
      {state.step === "done" && (
        <DoneView count={state.count} onClose={handleClose} />
      )}
      {state.step === "error" && (
        <ErrorView
          code={state.code}
          title={state.title}
          message={state.message}
          suggestion={state.suggestion}
          onRetry={() => setState({ step: "idle" })}
          onClose={handleClose}
        />
      )}
    </Modal>
  );
}

// --- Processing ---

const PHASE_META: Record<ParseProgress["phase"], { label: string; icon: JSX.Element }> = {
  rendering: {
    label: "Reading PDF",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  analyzing: {
    label: "Analyzing",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  done: {
    label: "Done",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
};

const PHASES: ParseProgress["phase"][] = ["rendering", "analyzing", "done"];

function ProcessingView({ progress }: { progress: ParseProgress }) {
  const currentIdx = PHASES.indexOf(progress.phase);

  return (
    <div className="py-6">
      {/* Phase steps */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {PHASES.map((phase, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          const meta = PHASE_META[phase];
          return (
            <div key={phase} className="flex items-center">
              {i > 0 && (
                <div className={`w-16 h-px transition-colors duration-500 ${isDone ? "bg-accent" : "bg-border"}`} />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isDone
                      ? "bg-accent text-white"
                      : isCurrent
                        ? "bg-accent/10 text-accent ring-2 ring-accent/30"
                        : "bg-surface-alt text-text-light border border-border"
                  }`}
                >
                  {isDone ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    meta.icon
                  )}
                </div>
                <span className={`text-[10px] font-medium transition-colors duration-300 ${
                  isCurrent ? "text-accent" : isDone ? "text-text-muted" : "text-text-light"
                }`}>
                  {meta.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Spinner + message */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-[3px] border-border" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-accent animate-spin" />
        </div>

        <p className="text-sm text-text-muted text-center">{progress.message}</p>

        {progress.fileName && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-alt rounded-md">
            <svg className="w-3 h-3 text-text-light shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-[11px] text-text-light truncate max-w-[200px]">{progress.fileName}</span>
            {progress.pageCount != null && (
              <span className="text-[11px] text-text-light">
                · {progress.pageCount} pg{progress.pageCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {progress.totalBatches != null && progress.totalBatches > 1 && (
          <div className="w-36 mt-1">
            <div className="flex justify-between text-[10px] text-text-light mb-1">
              <span>Batch {progress.batch ?? 1} of {progress.totalBatches}</span>
              <span>{Math.round(((progress.batch ?? 1) / progress.totalBatches) * 100)}%</span>
            </div>
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
                style={{ width: `${((progress.batch ?? 1) / progress.totalBatches) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Done ---

function DoneView({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-4 animate-slide-up">
      <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
        <svg className="w-7 h-7 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-base font-bold mb-1">
          {count} transaction{count !== 1 ? "s" : ""} imported
        </p>
        <p className="text-xs text-text-muted">
          They'll appear in the cashflow view for their respective months.
        </p>
      </div>
      <Button onClick={onClose} className="mt-1">Done</Button>
    </div>
  );
}

// --- Error ---

const ERROR_CONFIG: Record<string, {
  icon: JSX.Element;
  color: string;
  retryable: boolean;
  settingsLink: boolean;
}> = {
  no_api_key: {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
    color: "warning",
    retryable: false,
    settingsLink: true,
  },
  invalid_api_key: {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
    color: "danger",
    retryable: false,
    settingsLink: true,
  },
  credits_exhausted: {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    color: "warning",
    retryable: false,
    settingsLink: false,
  },
  rate_limited: {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    color: "warning",
    retryable: true,
    settingsLink: false,
  },
  network_error: {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
    color: "danger",
    retryable: true,
    settingsLink: true,
  },
  pdf_error: {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
    color: "text-muted",
    retryable: false,
    settingsLink: false,
  },
  no_transactions: {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
    color: "text-muted",
    retryable: true,
    settingsLink: false,
  },
  parse_error: {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    color: "warning",
    retryable: true,
    settingsLink: false,
  },
  api_error: {
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    color: "danger",
    retryable: true,
    settingsLink: false,
  },
};

const COLOR_CLASSES: Record<string, { bg: string; text: string }> = {
  warning: { bg: "bg-warning/8", text: "text-warning" },
  danger: { bg: "bg-danger/8", text: "text-danger" },
  "text-muted": { bg: "bg-text-muted/8", text: "text-text-muted" },
};

function ErrorView({
  code,
  title,
  message,
  suggestion,
  onRetry,
  onClose,
}: {
  code: string;
  title: string;
  message: string;
  suggestion: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const config = ERROR_CONFIG[code] ?? ERROR_CONFIG["api_error"]!;
  const colors = COLOR_CLASSES[config.color] ?? COLOR_CLASSES["danger"]!;

  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3 animate-slide-up">
      {/* Icon */}
      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
        {config.icon}
      </div>

      {/* Message */}
      <div className="text-center max-w-xs">
        <p className="text-sm font-bold mb-1.5">{title}</p>
        <p className="text-xs text-text-muted leading-relaxed">{message}</p>
      </div>

      {/* Suggestion box */}
      <div className="flex items-start gap-2 bg-surface-alt rounded-lg px-3 py-2.5 max-w-xs w-full">
        <svg className="w-3.5 h-3.5 text-text-light shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p className="text-[11px] text-text-muted leading-relaxed">{suggestion}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
        {config.settingsLink && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onClose();
              navigate({ to: "/settings" });
            }}
          >
            Open Settings
          </Button>
        )}
        {config.retryable && (
          <Button size="sm" onClick={onRetry}>Retry</Button>
        )}
      </div>
    </div>
  );
}

// --- Review table ---

function ReviewView({
  transactions: initial,
  categories,
  importing,
  onImport,
  onCancel,
  fileName,
}: {
  transactions: ParsedTransaction[];
  categories: Category[];
  importing: boolean;
  onImport: (txns: ParsedTransaction[]) => void;
  onCancel: () => void;
  fileName: string;
}) {
  const [rows, setRows] = useState<ParsedTransaction[]>(initial);

  const selectedCount = rows.filter((r) => r.selected).length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;

  const { totals, uncategorizedCount } = useMemo(() => {
    let income = 0, expense = 0, uncategorized = 0;
    for (const r of rows) {
      if (!r.selected) continue;
      if (r.type === "income") income += r.amount;
      else expense += r.amount;
      if (!r.category_id) uncategorized++;
    }
    return { totals: { income, expense }, uncategorizedCount: uncategorized };
  }, [rows]);

  function updateRow(index: number, updates: Partial<ParsedTransaction>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...updates } : r)),
    );
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleAll() {
    const newVal = !allSelected;
    setRows((prev) => prev.map((r) => ({ ...r, selected: newVal })));
  }

  return (
    <div className="animate-slide-up">
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5 text-xs text-text-muted">
          <span className="font-bold text-text">{rows.length} transactions</span>
          <span className="text-border">·</span>
          <span className="truncate max-w-[180px]">{fileName}</span>
        </div>
        {uncategorizedCount > 0 && (
          <span className="text-[11px] text-warning bg-warning/8 px-2 py-0.5 rounded-full font-medium">
            {uncategorizedCount} uncategorized
          </span>
        )}
      </div>

      {/* Table */}
      <div className="max-h-[55vh] overflow-y-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-surface-alt sticky top-0 z-10 border-b border-border">
            <tr className="text-left text-[11px] text-text-muted uppercase tracking-wide">
              <th className="p-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded"
                  disabled={importing}
                />
              </th>
              <th className="p-2 font-medium">Date</th>
              <th className="p-2 font-medium">Payee</th>
              <th className="p-2 text-right font-medium">Amount</th>
              <th className="p-2 w-20 font-medium">Type</th>
              <th className="p-2 w-36 font-medium">Category</th>
              <th className="p-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="text-text-light">
                    <svg className="w-8 h-8 mx-auto mb-2 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p className="text-xs">All transactions removed</p>
                  </div>
                </td>
              </tr>
            )}
            {rows.map((row, i) => (
              <ReviewRow
                key={i}
                row={row}
                index={i}
                categories={categories}
                onUpdate={updateRow}
                onRemove={removeRow}
                disabled={importing}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-text-muted">
            <strong className="text-text">{selectedCount}</strong> selected
          </span>
          {totals.income > 0 && (
            <span className="text-success font-medium">+{formatCurrency(totals.income)}</span>
          )}
          {totals.expense > 0 && (
            <span className="text-danger font-medium">-{formatCurrency(totals.expense)}</span>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={importing}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onImport(rows)}
            disabled={selectedCount === 0 || importing}
          >
            {importing ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Importing...
              </span>
            ) : (
              `Import ${selectedCount} Transaction${selectedCount !== 1 ? "s" : ""}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({
  row,
  index,
  categories,
  onUpdate,
  onRemove,
  disabled,
}: {
  row: ParsedTransaction;
  index: number;
  categories: Category[];
  onUpdate: (index: number, updates: Partial<ParsedTransaction>) => void;
  onRemove: (index: number) => void;
  disabled: boolean;
}) {
  const isUncategorized = row.selected && !row.category_id;

  return (
    <tr
      className={`transition-colors ${
        row.selected ? "" : "opacity-35"
      } ${
        isUncategorized ? "bg-warning/[0.03]" : index % 2 === 1 ? "bg-surface-alt/30" : ""
      } hover:bg-surface-alt/50`}
    >
      <td className="p-2">
        <input
          type="checkbox"
          checked={row.selected}
          onChange={(e) => onUpdate(index, { selected: e.target.checked })}
          className="rounded"
          disabled={disabled}
        />
      </td>
      <td className="p-2">
        <input
          type="date"
          value={row.date}
          onChange={(e) => onUpdate(index, { date: e.target.value })}
          className="bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none text-xs w-28"
          disabled={disabled}
        />
      </td>
      <td className="p-2">
        <input
          type="text"
          value={row.payee}
          onChange={(e) => onUpdate(index, { payee: e.target.value })}
          className="bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none text-xs w-full"
          disabled={disabled}
        />
      </td>
      <td className="p-2 text-right">
        <input
          type="number"
          value={row.amount}
          onChange={(e) =>
            onUpdate(index, { amount: Math.abs(Number(e.target.value) || 0) })
          }
          className="bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none text-xs w-20 text-right tabular-nums"
          step="0.01"
          min="0"
          disabled={disabled}
        />
      </td>
      <td className="p-2">
        <button
          type="button"
          onClick={() =>
            onUpdate(index, {
              type: row.type === "income" ? "expense" : "income",
            })
          }
          disabled={disabled}
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
            row.type === "income"
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          }`}
        >
          {row.type === "income" ? "Income" : "Expense"}
        </button>
      </td>
      <td className="p-2">
        <CategoryCombo
          value={row.category_id ?? ""}
          onChange={(id) => onUpdate(index, { category_id: id || null })}
          categories={categories.filter((c) =>
            row.type === "income" ? c.is_income : !c.is_income,
          )}
          variant="edit"
          disabled={disabled}
        />
      </td>
      <td className="p-2">
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={disabled}
          className="text-text-light hover:text-danger transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded hover:bg-danger/5"
          title="Remove"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
