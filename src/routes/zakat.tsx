import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { PageHeader } from "../components/layout/PageHeader.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Input } from "../components/ui/Input.tsx";
import { Select } from "../components/ui/Select.tsx";
import { Modal } from "../components/ui/Modal.tsx";
import { useDb } from "../context/DbContext.tsx";
import { useToast } from "../components/ui/Toast.tsx";
import { createTransaction } from "../db/queries/transactions.ts";
import { getCategories, createCategory } from "../db/queries/categories.ts";
import { getSetting, setSetting } from "../db/queries/settings.ts";
import { emitDbEvent } from "../lib/db-events.ts";
import { formatCurrency, formatDate, getToday } from "../lib/format.ts";
import {
  calculateZakat,
  defaultInputs,
  createHoldPosition,
  calcHoldPositionZakatable,
  MADHAB_CONFIGS,
  ZAKAT_RATE,
  type ZakatInputs,
  type ZakatBreakdown,
  type ZakatHistoryEntry,
  type HoldPosition,
  type Madhab,
  type HoldMethod,
} from "../components/zakat/zakat-utils.ts";

export const Route = createFileRoute("/zakat")({
  component: ZakatPage,
});

type Mode = "simple" | "detailed";

const DRAFT_KEY = "zakat-draft";

// Asset category colors
const ASSET_COLORS = {
  cash: "#0f766e",
  gold: "#d97706",
  silver: "#94a3b8",
  stocks: "#4f46e5",
} as const;

// Pre-computed select options (avoid rebuilding on every render)
const MADHAB_OPTIONS = Object.entries(MADHAB_CONFIGS).map(([k, v]) => ({
  value: k,
  label: v.label,
}));

// -- Number formatting for inputs --

const numberFormatter = new Intl.NumberFormat("en-AE", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

function formatInputNumber(value: number): string {
  if (value === 0) return "";
  return numberFormatter.format(value);
}

function parseInputNumber(raw: string): number {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (cleaned === "" || cleaned === ".") return 0;
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function CurrencyInput({
  label,
  value,
  onChange,
  placeholder = "0.00",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [rawText, setRawText] = useState("");

  const displayValue = focused ? rawText : formatInputNumber(value);

  return (
    <Input
      label={label}
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true);
        setRawText(value ? String(value) : "");
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value;
        if (/^[\d,]*\.?\d*$/.test(raw)) {
          setRawText(raw);
          onChange(parseInputNumber(raw));
        }
      }}
    />
  );
}

function ZakatPage() {
  const db = useDb();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("simple");
  const [inputs, setInputs] = useState<ZakatInputs>(defaultInputs());
  const [date, setDate] = useState(getToday());
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ZakatHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const draftLoaded = useRef(false);

  // Collapsible sections — all open by default
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["gold", "stocks", "silver", "debts"])
  );
  const toggleSection = (key: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // -- Draft persistence --
  useEffect(() => {
    const saved = sessionStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.inputs) setInputs(parsed.inputs);
        if (parsed.mode) setMode(parsed.mode);
        if (parsed.date) setDate(parsed.date);
      } catch { /* ignore corrupt draft */ }
    }
    draftLoaded.current = true;
  }, []);

  useEffect(() => {
    if (!draftLoaded.current) return;
    const t = setTimeout(() => {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ inputs, mode, date }));
    }, 400);
    return () => clearTimeout(t);
  }, [inputs, mode, date]);

  useEffect(() => {
    getSetting(db, "zakat_history").then((raw) => {
      if (raw) {
        try { setHistory(JSON.parse(raw)); } catch { setHistory([]); }
      }
    });
  }, [db]);

  function updateField<K extends keyof ZakatInputs>(key: K, value: ZakatInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }

  function addHoldPosition() {
    setInputs((prev) => ({
      ...prev,
      holdPositions: [...prev.holdPositions, createHoldPosition()],
    }));
  }

  function updateHoldPosition(id: string, updates: Partial<HoldPosition>) {
    setInputs((prev) => ({
      ...prev,
      holdPositions: prev.holdPositions.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
  }

  function removeHoldPosition(id: string) {
    setInputs((prev) => ({
      ...prev,
      holdPositions: prev.holdPositions.filter((p) => p.id !== id),
    }));
  }

  // Live calculation (always computed)
  const preview = useMemo(() => {
    const calc = mode === "simple"
      ? { ...inputs, silverGrams: 0, silverPricePerGram: 0, debts: 0 }
      : inputs;
    return calculateZakat(calc);
  }, [inputs, mode]);

  function handleReset() {
    setInputs(defaultInputs());
    setDate(getToday());
    sessionStorage.removeItem(DRAFT_KEY);
  }

  function loadFromHistory(entry: ZakatHistoryEntry) {
    if (entry.inputs) {
      setInputs(entry.inputs);
      setMode(entry.mode);
      setDate(entry.date);
      toast("Loaded calculation inputs");
    } else {
      toast("This entry doesn't have saved inputs", "error");
    }
  }

  async function ensureZakatCategory(): Promise<string> {
    const cats = await getCategories(db);
    const PARENT_ID = "cat-donations";
    const CHILD_ID = "cat-donations-zakat";

    if (!cats.find((c) => c.id === PARENT_ID)) {
      await createCategory(db, {
        id: PARENT_ID,
        name: "Donations",
        color: "#0d9488",
        icon: "heart",
        is_income: false,
        sort_order: 90,
      });
    }

    if (!cats.find((c) => c.id === CHILD_ID)) {
      await createCategory(db, {
        id: CHILD_ID,
        name: "Zakat",
        parent_id: PARENT_ID,
        color: "#0d9488",
        icon: "heart",
        is_income: false,
        sort_order: 0,
      });
      emitDbEvent("categories-changed");
    }

    return CHILD_ID;
  }

  async function handleSave() {
    if (preview.zakatDue === 0) return;
    setSaving(true);
    try {
      const categoryId = await ensureZakatCategory();
      const txnId = crypto.randomUUID();

      await createTransaction(db, {
        id: txnId,
        amount: preview.zakatDue,
        type: "expense",
        category_id: categoryId,
        date,
        payee: "Zakat",
        notes: `Zakat (${MADHAB_CONFIGS[inputs.madhab].label}) — ${ZAKAT_RATE * 100}% of ${formatCurrency(preview.netZakatable)}`,
        status: date > getToday() ? "planned" : "confirmed",
      });
      emitDbEvent("transactions-changed");

      const entry: ZakatHistoryEntry = {
        id: crypto.randomUUID(),
        calculatedAt: new Date().toISOString(),
        date,
        mode,
        madhab: inputs.madhab,
        breakdown: preview,
        inputs: { ...inputs },
        transactionId: txnId,
      };
      const updated = [entry, ...history].slice(0, 20);
      await setSetting(db, "zakat_history", JSON.stringify(updated));
      setHistory(updated);

      toast(`Zakat of ${formatCurrency(preview.zakatDue)} saved as transaction`);
      handleReset();
    } catch (e) {
      toast("Failed to save zakat transaction", "error");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteHistory(entryId: string) {
    const updated = history.filter((h) => h.id !== entryId);
    await setSetting(db, "zakat_history", JSON.stringify(updated));
    setHistory(updated);
    toast("History entry removed");
  }

  const config = MADHAB_CONFIGS[inputs.madhab];

  // Section fill checks
  const cashFilled = inputs.cash > 0;
  const goldFilled = inputs.goldInvestmentGrams > 0 || inputs.goldJewelryGrams > 0;
  const silverFilled = inputs.silverGrams > 0;
  const stocksFilled = inputs.stockTradingValue > 0 || inputs.holdPositions.length > 0
    || (mode === "simple" && inputs.stockHoldValue > 0);
  const debtsFilled = inputs.debts > 0;
  const hasAnyInput = cashFilled || goldFilled || stocksFilled || silverFilled;

  // Section subtotals (from live preview)
  const goldSubtotal = preview.goldTotal;
  const silverSubtotal = preview.silverValue;

  return (
    <div className="pb-32 md:pb-8">
      <PageHeader
        title="Zakat Calculator"
        action={
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setInfoOpen(true)}>
              <InfoIcon className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset
            </Button>
          </div>
        }
      />

      {/* Mode toggle — compact */}
      <div className="px-4 mb-5 max-w-4xl mx-auto">
        <div className="inline-flex bg-surface-alt rounded-lg p-0.5 border border-border">
          <button
            onClick={() => setMode("simple")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${
              mode === "simple"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => setMode("detailed")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${
              mode === "detailed"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            Detailed
          </button>
        </div>
      </div>

      {/* Two-column layout: form + sticky breakdown */}
      <div className="px-4 max-w-4xl mx-auto md:grid md:grid-cols-[1fr_320px] md:gap-6">

        {/* Left column: form inputs */}
        <div className="space-y-4">

          {/* Madhab selector — detailed mode */}
          {mode === "detailed" && (
            <section className="bg-surface rounded-xl border border-border p-4 animate-slide-up">
              <h2 className="text-sm font-bold mb-3">
                School of Thought
                <Tooltip text="The four Sunni schools of jurisprudence differ on nisab thresholds, whether jewelry is zakatable, and whether debts can be deducted." />
              </h2>
              <Select
                value={inputs.madhab}
                onChange={(e) => updateField("madhab", e.target.value as Madhab)}
                options={MADHAB_OPTIONS}
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {config.debtReducesZakat && <MadhabBadge label="Debts deductible" />}
                {!config.debtReducesZakat && <MadhabBadge label="Debts not deductible" muted />}
                {config.jewelryZakatable && <MadhabBadge label="Jewelry zakatable" />}
                {!config.jewelryZakatable && <MadhabBadge label="Jewelry exempt" muted />}
                {config.useSilverStandard && <MadhabBadge label="Silver nisab standard" />}
              </div>
            </section>
          )}

          {/* Cash */}
          <section className="bg-surface rounded-xl border border-border p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <StepNumber n={1} filled={cashFilled} />
              Cash & Savings
              <Tooltip text="Physical currency, bank accounts (checking, savings), money market accounts, and deposits." />
              {cashFilled && (
                <span className="ml-auto text-xs tabular-nums text-text-muted font-normal">
                  {formatCurrency(inputs.cash)}
                </span>
              )}
            </h2>
            <CurrencyInput
              label="Total cash, bank balances, deposits (AED)"
              value={inputs.cash}
              onChange={(v) => updateField("cash", v)}
            />
          </section>

          {/* Gold */}
          <CollapsibleSection
            open={openSections.has("gold")}
            onToggle={() => toggleSection("gold")}
            title={
              <>
                <StepNumber n={2} filled={goldFilled} />
                Gold
                <Tooltip text="Investment gold (bars, coins) is always zakatable. Personal jewelry rules vary by madhab." />
                {goldSubtotal > 0 && (
                  <span className="ml-auto text-xs tabular-nums text-text-muted font-normal">
                    {formatCurrency(goldSubtotal)}
                  </span>
                )}
              </>
            }
          >
            <div className="space-y-3">
              <div>
                <CurrencyInput
                  label="Gold price per gram (AED)"
                  value={inputs.goldPricePerGram}
                  onChange={(v) => updateField("goldPricePerGram", v)}
                  placeholder="280"
                />
                <p className="text-xs text-text-light mt-1">
                  Check current 24K gold price in AED. Used for nisab threshold and gold valuation.
                </p>
              </div>
              <div>
                <CurrencyInput
                  label="Investment gold — bars, coins (grams)"
                  value={inputs.goldInvestmentGrams}
                  onChange={(v) => updateField("goldInvestmentGrams", v)}
                  placeholder="0"
                />
                {inputs.goldInvestmentGrams > 0 && inputs.goldPricePerGram > 0 && (
                  <p className="text-xs text-text-muted mt-1">
                    = {formatCurrency(inputs.goldInvestmentGrams * inputs.goldPricePerGram)}
                  </p>
                )}
              </div>
              {(mode === "detailed" || config.jewelryZakatable) && (
                <div>
                  <CurrencyInput
                    label={
                      `Personal jewelry (grams)` +
                      (mode === "detailed" && !config.jewelryZakatable ? " — exempt" : "")
                    }
                    value={inputs.goldJewelryGrams}
                    onChange={(v) => updateField("goldJewelryGrams", v)}
                    placeholder="0"
                  />
                  {inputs.goldJewelryGrams > 0 && inputs.goldPricePerGram > 0 && (
                    <p className={`text-xs mt-1 ${config.jewelryZakatable ? "text-text-muted" : "text-warning"}`}>
                      = {formatCurrency(inputs.goldJewelryGrams * inputs.goldPricePerGram)}
                      {!config.jewelryZakatable && " (not included — personal use jewelry is exempt)"}
                    </p>
                  )}
                  {mode === "simple" && config.jewelryZakatable && (
                    <p className="text-xs text-text-muted mt-1">
                      Hanafi school: all gold jewelry is zakatable regardless of personal use.
                    </p>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Silver — detailed only */}
          {mode === "detailed" && (
            <CollapsibleSection
              open={openSections.has("silver")}
              onToggle={() => toggleSection("silver")}
              title={
                <>
                  <StepNumber n={3} filled={silverFilled} />
                  Silver
                  <Tooltip text="Silver jewelry and bullion. Used for nisab calculation under the Hanafi silver standard." />
                  {silverSubtotal > 0 && (
                    <span className="ml-auto text-xs tabular-nums text-text-muted font-normal">
                      {formatCurrency(silverSubtotal)}
                    </span>
                  )}
                </>
              }
            >
              <div className="space-y-3">
                <CurrencyInput
                  label="Silver price per gram (AED)"
                  value={inputs.silverPricePerGram}
                  onChange={(v) => updateField("silverPricePerGram", v)}
                  placeholder="3.50"
                />
                <div>
                  <CurrencyInput
                    label="Silver weight (grams)"
                    value={inputs.silverGrams}
                    onChange={(v) => updateField("silverGrams", v)}
                    placeholder="0"
                  />
                  {inputs.silverGrams > 0 && inputs.silverPricePerGram > 0 && (
                    <p className="text-xs text-text-muted mt-1">
                      = {formatCurrency(inputs.silverGrams * inputs.silverPricePerGram)}
                    </p>
                  )}
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Stocks */}
          <CollapsibleSection
            open={openSections.has("stocks")}
            onToggle={() => toggleSection("stocks")}
            title={
              <>
                <StepNumber n={mode === "detailed" ? 4 : 3} filled={stocksFilled} />
                Stocks & Investments
                <Tooltip text="Zakat on stocks depends on your intention: trading (full value) vs long-term investment (proportional zakatable assets)." />
                {preview.stocksZakatable > 0 && (
                  <span className="ml-auto text-xs tabular-nums text-text-muted font-normal">
                    {formatCurrency(preview.stocksZakatable)}
                  </span>
                )}
              </>
            }
          >
            <div className="space-y-3">
              <CurrencyInput
                label="Trading stocks — bought to sell for profit (AED)"
                value={inputs.stockTradingValue}
                onChange={(v) => updateField("stockTradingValue", v)}
              />
              {inputs.stockTradingValue > 0 && (
                <p className="text-xs text-text-muted mt-1">
                  Full market value is zakatable: {formatCurrency(inputs.stockTradingValue)}
                </p>
              )}

              {mode === "simple" ? (
                <div className="border-t border-border/50 pt-3 space-y-3">
                  <CurrencyInput
                    label="Long-term hold stocks — total market value (AED)"
                    value={inputs.stockHoldValue}
                    onChange={(v) => updateField("stockHoldValue", v)}
                  />
                  {inputs.stockHoldValue > 0 && (
                    <>
                      <Select
                        label="Hold stock zakat method"
                        value={inputs.stockHoldMethod}
                        onChange={(e) => updateField("stockHoldMethod", e.target.value as HoldMethod)}
                        options={[
                          { value: "shortcut", label: "25% shortcut — assume 25% is zakatable" },
                          { value: "investment", label: "Investment — zakatable assets %" },
                        ]}
                      />
                      {inputs.stockHoldMethod === "investment" && (
                        <Input
                          label="Zakatable assets as % of market cap"
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={inputs.stockHoldPercent || ""}
                          onChange={(e) => {
                            const n = e.target.value === "" ? 0 : parseFloat(e.target.value);
                            if (!isNaN(n)) updateField("stockHoldPercent", n);
                          }}
                          placeholder="25"
                        />
                      )}
                      <p className="text-xs text-text-muted">
                        Zakatable portion: {formatCurrency(
                          inputs.stockHoldMethod === "investment"
                            ? inputs.stockHoldValue * (inputs.stockHoldPercent / 100)
                            : inputs.stockHoldValue * 0.25
                        )}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="border-t border-border/50 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-muted">
                      Long-term hold stocks
                      <Tooltip text="Add each stock or fund you hold long-term. Each can use a different zakat method — per-share (when the company publishes it), investment %, or 25% shortcut." />
                    </span>
                    <Button variant="ghost" size="sm" onClick={addHoldPosition}>
                      + Add stock
                    </Button>
                  </div>

                  {inputs.holdPositions.length === 0 && (
                    <p className="text-xs text-text-light py-2">
                      No long-term hold stocks added. Click "Add stock" if you have stocks held for investment.
                    </p>
                  )}

                  <div className="space-y-3">
                    {inputs.holdPositions.map((pos, idx) => (
                      <HoldPositionCard
                        key={pos.id}
                        position={pos}
                        index={idx}
                        onUpdate={(updates) => updateHoldPosition(pos.id, updates)}
                        onRemove={() => removeHoldPosition(pos.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Debts — detailed only, when madhab allows */}
          {mode === "detailed" && config.debtReducesZakat && (
            <CollapsibleSection
              open={openSections.has("debts")}
              onToggle={() => toggleSection("debts")}
              title={
                <>
                  <StepNumber n={5} filled={debtsFilled} />
                  Debts & Liabilities
                  <Tooltip text={config.debtNote + ". Include loans, credit card balances, and other outstanding obligations."} />
                  {inputs.debts > 0 && (
                    <span className="ml-auto text-xs tabular-nums text-danger font-normal">
                      -{formatCurrency(inputs.debts)}
                    </span>
                  )}
                </>
              }
            >
              <CurrencyInput
                label="Total outstanding debts (AED)"
                value={inputs.debts}
                onChange={(v) => updateField("debts", v)}
              />
            </CollapsibleSection>
          )}

          {/* History */}
          {history.length > 0 && (
            <section className="bg-surface rounded-xl border border-border">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
              >
                <h2 className="text-sm font-bold">
                  Calculation History
                  <span className="text-text-muted font-normal ml-1.5">({history.length})</span>
                </h2>
                <ChevronIcon className={`w-4 h-4 text-text-muted transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </button>

              {historyOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {history.map((entry) => (
                    <div key={entry.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {formatCurrency(entry.breakdown.zakatDue)}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-surface-alt text-text-muted">
                            {MADHAB_CONFIGS[entry.madhab].label}
                          </span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-surface-alt text-text-muted capitalize">
                            {entry.mode}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          Calculated {formatDate(entry.calculatedAt.split("T")[0]!)} · Payment {formatDate(entry.date)}
                        </p>
                        <p className="text-xs text-text-light mt-0.5">
                          Zakatable: {formatCurrency(entry.breakdown.netZakatable)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {entry.inputs && (
                          <button
                            onClick={() => loadFromHistory(entry)}
                            className="text-text-light hover:text-accent p-1 cursor-pointer"
                            title="Load inputs"
                          >
                            <LoadIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteHistory(entry.id)}
                          className="text-text-light hover:text-danger p-1 cursor-pointer"
                          title="Remove"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Disclaimer */}
          <div className="text-xs text-text-light leading-relaxed py-2">
            This calculator is for estimation purposes only and does not constitute
            religious or financial advice. Zakat obligations vary by individual
            circumstances. For specific rulings, consult a qualified Islamic scholar
            or your local zakat authority.
          </div>
        </div>

        {/* Right column: sticky breakdown panel (desktop) */}
        <div className="hidden md:block">
          <div className="sticky top-4 space-y-3">
            <BreakdownPanel
              preview={preview}
              config={config}
              date={date}
              onDateChange={setDate}
              onSave={handleSave}
              saving={saving}
              hasAnyInput={hasAnyInput}
              mode={mode}
            />
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      {hasAnyInput && (
        <MobileBottomBar
          preview={preview}
          config={config}
          date={date}
          onDateChange={setDate}
          onSave={handleSave}
          saving={saving}
          expanded={mobileExpanded}
          onToggleExpand={() => setMobileExpanded(!mobileExpanded)}
        />
      )}

      {/* Info Modal */}
      <ZakatInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </div>
  );
}

// -- Asset Composition Bar --

function AssetBar({ preview }: { preview: ZakatBreakdown }) {
  const total = preview.grossZakatable;
  if (total === 0) return null;

  const segments = [
    { label: "Cash", value: preview.cashZakatable, color: ASSET_COLORS.cash },
    { label: "Gold", value: preview.goldTotal, color: ASSET_COLORS.gold },
    { label: "Silver", value: preview.silverValue, color: ASSET_COLORS.silver },
    { label: "Stocks", value: preview.stocksZakatable, color: ASSET_COLORS.stocks },
  ].filter(s => s.value > 0);

  return (
    <div>
      <div className="h-2 rounded-full overflow-hidden flex bg-surface-alt">
        {segments.map(s => (
          <div
            key={s.label}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            className="h-full transition-all duration-300"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {segments.map(s => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
            <span className="tabular-nums">{Math.round((s.value / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// -- Shared breakdown line items --

function BreakdownLineItems({
  preview,
  config,
  compact,
}: {
  preview: ZakatBreakdown;
  config: (typeof MADHAB_CONFIGS)[Madhab];
  compact?: boolean;
}) {
  return (
    <div className={`space-y-1.5 text-sm`}>
      {preview.cashZakatable > 0 && (
        <BreakdownRow label={compact ? "Cash" : "Cash & savings"} value={preview.cashZakatable} />
      )}
      {compact ? (
        preview.goldTotal > 0 && <BreakdownRow label="Gold" value={preview.goldTotal} />
      ) : (
        <>
          {preview.goldInvestmentValue > 0 && (
            <BreakdownRow label="Gold (investment)" value={preview.goldInvestmentValue} />
          )}
          {preview.goldJewelryValue > 0 && (
            <BreakdownRow
              label={`Jewelry${!preview.goldJewelryIncluded ? " — exempt" : ""}`}
              value={preview.goldJewelryIncluded ? preview.goldJewelryValue : 0}
              muted={!preview.goldJewelryIncluded}
              strikethrough={!preview.goldJewelryIncluded}
            />
          )}
        </>
      )}
      {preview.silverValue > 0 && (
        <BreakdownRow label="Silver" value={preview.silverValue} />
      )}
      {compact ? (
        preview.stocksZakatable > 0 && <BreakdownRow label="Stocks" value={preview.stocksZakatable} />
      ) : (
        <>
          {preview.stockTradingZakatable > 0 && (
            <BreakdownRow label="Stocks (trading)" value={preview.stockTradingZakatable} />
          )}
          {preview.holdPositionBreakdowns.map((b, i) =>
            b.zakatable > 0 ? (
              <BreakdownRow
                key={i}
                label={`${b.label} (${b.method === "per-share" ? "per share" : b.method})`}
                value={b.zakatable}
              />
            ) : null
          )}
        </>
      )}

      <div className={`border-t border-border ${compact ? "my-1.5" : "my-2"}`} />
      {!compact && (
        <>
          <BreakdownRow label="Gross zakatable" value={preview.grossZakatable} bold />
          {preview.debtDeduction > 0 && (
            <BreakdownRow label="Less: debts" value={-preview.debtDeduction} />
          )}
        </>
      )}
      {compact && preview.debtDeduction > 0 && (
        <BreakdownRow label="Debts" value={-preview.debtDeduction} />
      )}
      <BreakdownRow label="Net zakatable" value={preview.netZakatable} bold />

      {!compact && <div className="border-t border-border my-2" />}
      <BreakdownRow
        label={`Nisab (${config.useSilverStandard ? "silver" : "gold"})`}
        value={preview.nisabThreshold}
        muted
      />
    </div>
  );
}

// -- Breakdown Panel (desktop sidebar) --

function BreakdownPanel({
  preview,
  config,
  date,
  onDateChange,
  onSave,
  saving,
  hasAnyInput,
  mode,
}: {
  preview: ZakatBreakdown;
  config: (typeof MADHAB_CONFIGS)[Madhab];
  date: string;
  onDateChange: (d: string) => void;
  onSave: () => void;
  saving: boolean;
  hasAnyInput: boolean;
  mode: Mode;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-4">
      <h2 className="text-sm font-bold flex items-center justify-between">
        Breakdown
        <span className="text-xs font-normal text-text-muted capitalize">{mode}</span>
      </h2>

      {!hasAnyInput ? (
        <p className="text-xs text-text-light py-4 text-center">
          Enter your assets to see a live breakdown.
        </p>
      ) : (
        <>
          {/* Asset composition bar */}
          <AssetBar preview={preview} />

          <BreakdownLineItems preview={preview} config={config} />

          {/* Result */}
          {preview.nisabMet ? (
            <div className="bg-accent/5 rounded-lg p-4">
              <div className="text-center">
                <span className="text-xs text-text-muted block">Zakat due (2.5%)</span>
                <AnimatedAmount value={preview.zakatDue} className="text-2xl font-bold text-accent mt-1" />
              </div>
              <div className="mt-4 space-y-2">
                <Input
                  label="Payment date"
                  type="date"
                  value={date}
                  onChange={(e) => onDateChange(e.target.value)}
                />
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : `Save as transaction`}
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-alt rounded-lg p-3 text-center">
              <p className="text-xs text-text-muted">
                Below nisab ({formatCurrency(preview.nisabThreshold)})
              </p>
              <p className="text-sm font-medium mt-0.5">No zakat due</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// -- Mobile Bottom Bar --

function MobileBottomBar({
  preview,
  config,
  date,
  onDateChange,
  onSave,
  saving,
  expanded,
  onToggleExpand,
}: {
  preview: ZakatBreakdown;
  config: (typeof MADHAB_CONFIGS)[Madhab];
  date: string;
  onDateChange: (d: string) => void;
  onSave: () => void;
  saving: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div className="md:hidden fixed bottom-14 left-0 right-0 z-30">
      {/* Expanded breakdown */}
      {expanded && (
        <div className="bg-surface border-t border-border px-4 pt-4 pb-3 animate-slide-up">
          <AssetBar preview={preview} />

          <div className="mt-3">
            <BreakdownLineItems preview={preview} config={config} compact />
          </div>

          {preview.nisabMet && (
            <div className="mt-3">
              <Input
                label="Payment date"
                type="date"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Compact bar */}
      <div className="bg-surface/95 backdrop-blur-sm border-t border-border px-4 py-2.5">
        <div className="flex items-center justify-between">
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-2 cursor-pointer min-w-0"
          >
            <ChevronIcon
              className={`w-4 h-4 text-text-muted transition-transform shrink-0 ${expanded ? "" : "rotate-180"}`}
            />
            <div className="min-w-0">
              <span className="text-xs text-text-muted block">
                {preview.nisabMet ? "Zakat due (2.5%)" : "Below nisab"}
              </span>
              <AnimatedAmount
                value={preview.nisabMet ? preview.zakatDue : preview.netZakatable}
                className={`text-lg font-bold ${preview.nisabMet ? "text-accent" : "text-text-muted"}`}
              />
            </div>
          </button>
          {preview.nisabMet && preview.zakatDue > 0 && (
            <Button variant="primary" size="sm" onClick={onSave} disabled={saving}>
              {saving ? "..." : "Save"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// -- Animated Amount --

function AnimatedAmount({ value, className }: { value: number; className?: string }) {
  const prevRef = useRef(value);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 300);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span className={`tabular-nums transition-transform duration-300 inline-block ${pulse ? "scale-105" : "scale-100"} ${className ?? ""}`}>
      {formatCurrency(value)}
    </span>
  );
}

// -- Info Modal --

function ZakatInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="About Zakat" size="wide">
      <div className="space-y-5 text-sm">
        <div>
          <h3 className="font-bold mb-1">What is Zakat?</h3>
          <p className="text-text-muted leading-relaxed">
            Zakat is one of the five pillars of Islam — a mandatory annual payment
            of 2.5% on qualifying wealth that purifies your assets and supports
            those in need.
          </p>
        </div>

        <div>
          <h3 className="font-bold mb-1">When is it due?</h3>
          <p className="text-text-muted leading-relaxed">
            Zakat becomes obligatory when your total zakatable wealth exceeds the
            <strong> nisab</strong> (minimum threshold) and a full
            <strong> lunar year (hawl)</strong> has passed since it first exceeded that threshold.
          </p>
        </div>

        <div>
          <h3 className="font-bold mb-2">Nisab Thresholds by School</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 pr-3 font-medium text-text-muted">School</th>
                  <th className="text-right py-1.5 px-3 font-medium text-text-muted">Gold</th>
                  <th className="text-right py-1.5 pl-3 font-medium text-text-muted">Silver</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(MADHAB_CONFIGS).map(([, cfg]) => (
                  <tr key={cfg.label} className="border-b border-border/50">
                    <td className="py-1.5 pr-3 font-medium">{cfg.label}</td>
                    <td className="text-right py-1.5 px-3 tabular-nums">{cfg.goldNisabGrams}g</td>
                    <td className="text-right py-1.5 pl-3 tabular-nums">{cfg.silverNisabGrams}g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="font-bold mb-2">Key Differences Between Schools</h3>
          <div className="space-y-2">
            <InfoRow
              title="Personal jewelry"
              desc="Hanafi: zakatable. Maliki, Shafi'i, Hanbali: exempt if for personal use."
            />
            <InfoRow
              title="Debt deduction"
              desc="Hanafi & Hanbali: debts reduce zakatable assets. Shafi'i: no deduction. Maliki: only on gold/silver."
            />
            <InfoRow
              title="Nisab standard"
              desc="Hanafi uses the silver standard (lower threshold, more people pay). Others use gold."
            />
          </div>
        </div>

        <div>
          <h3 className="font-bold mb-2">Stock Zakat Methods</h3>
          <div className="space-y-2">
            <InfoRow
              title="Trading"
              desc="If you buy stocks to sell for profit, pay 2.5% on the full market value."
            />
            <InfoRow
              title="Per-share"
              desc="Some companies (e.g. Dubai Islamic Bank) publish a zakatable amount per share annually. Multiply by your share count — most accurate method when available."
            />
            <InfoRow
              title="Investment"
              desc="For long-term holdings, pay 2.5% on your proportionate share of the company's zakatable assets (cash + receivables + inventory)."
            />
            <InfoRow
              title="25% shortcut"
              desc="When company financials aren't available, scholars recommend assuming 25% of share value is zakatable. Effective rate: 0.625%."
            />
          </div>
        </div>

        <div>
          <h3 className="font-bold mb-1">Simple vs Detailed Mode</h3>
          <p className="text-text-muted leading-relaxed">
            <strong>Simple</strong> uses Maliki defaults — ideal for a quick estimate.{" "}
            <strong>Detailed</strong> lets you select your madhab, configure per-stock
            methods, add silver, and deduct debts where applicable.
          </p>
        </div>

        <div className="bg-surface-alt rounded-lg p-3 text-xs text-text-muted leading-relaxed">
          <strong>Disclaimer:</strong> This tool is for estimation purposes only.
          For specific rulings on your situation, consult a qualified Islamic
          scholar or your local zakat authority. May Allah accept your zakat.
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-surface-alt rounded-lg px-3 py-2">
      <span className="font-medium">{title}:</span>{" "}
      <span className="text-text-muted">{desc}</span>
    </div>
  );
}

// -- Hold Position Card --

function HoldPositionCard({
  position,
  index,
  onUpdate,
  onRemove,
}: {
  position: HoldPosition;
  index: number;
  onUpdate: (updates: Partial<HoldPosition>) => void;
  onRemove: () => void;
}) {
  const zakatable = calcHoldPositionZakatable(position);

  return (
    <div className="bg-surface-alt rounded-lg p-3 space-y-2.5 relative">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Input
            label={`Stock ${index + 1} name`}
            type="text"
            value={position.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="e.g. Dubai Islamic Bank"
          />
        </div>
        <button
          onClick={onRemove}
          className="text-text-light hover:text-danger p-1 mt-6 shrink-0 cursor-pointer"
          title="Remove"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      <Select
        label="Zakat method"
        value={position.method}
        onChange={(e) => onUpdate({ method: e.target.value as HoldMethod })}
        options={[
          { value: "per-share", label: "Per-share — company provides zakatable amount" },
          { value: "investment", label: "Investment — zakatable assets %" },
          { value: "shortcut", label: "25% shortcut" },
        ]}
      />

      {position.method === "per-share" && (
        <>
          <CurrencyInput
            label="Number of shares"
            value={position.shareCount}
            onChange={(v) => onUpdate({ shareCount: Math.floor(v) })}
            placeholder="0"
          />
          <CurrencyInput
            label="Zakatable amount per share (AED)"
            value={position.zakatPerShare}
            onChange={(v) => onUpdate({ zakatPerShare: v })}
            placeholder="0.00"
          />
        </>
      )}

      {(position.method === "investment" || position.method === "shortcut") && (
        <CurrencyInput
          label="Market value (AED)"
          value={position.marketValue}
          onChange={(v) => onUpdate({ marketValue: v })}
        />
      )}

      {position.method === "investment" && (
        <Input
          label="Zakatable assets as % of market cap"
          type="number"
          min="0"
          max="100"
          step="any"
          value={position.zakatablePercent || ""}
          onChange={(e) => {
            const n = e.target.value === "" ? 0 : parseFloat(e.target.value);
            if (!isNaN(n)) onUpdate({ zakatablePercent: n });
          }}
          placeholder="25"
        />
      )}

      {zakatable > 0 && (
        <p className="text-xs text-text-muted">
          Zakatable: {formatCurrency(zakatable)}
        </p>
      )}
    </div>
  );
}

// -- Collapsible Section --

function CollapsibleSection({
  open,
  onToggle,
  title,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface rounded-xl border border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-4 text-left cursor-pointer"
      >
        <h2 className="text-sm font-bold flex items-center gap-2 flex-1 min-w-0">
          {title}
        </h2>
        <ChevronIcon
          className={`w-4 h-4 text-text-muted transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

// -- Tooltip --

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex ml-1 text-text-light hover:text-text-muted cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow(!show); }}
      role="note"
      aria-label="More info"
    >
      <InfoIcon className="w-3.5 h-3.5" />
      {show && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 sm:w-64 bg-text text-surface text-xs rounded-lg px-3 py-2 leading-relaxed z-50 shadow-lg pointer-events-none">
          {text}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-text rotate-45 -mt-1" />
        </div>
      )}
    </span>
  );
}

// -- Madhab Badge --

function MadhabBadge({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${
      muted
        ? "bg-surface-alt text-text-light"
        : "bg-accent/10 text-accent"
    }`}>
      {label}
    </span>
  );
}

// -- Sub-components --

function StepNumber({ n, filled }: { n: number; filled?: boolean }) {
  return (
    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors duration-200 ${
      filled
        ? "bg-accent text-white"
        : "bg-accent/10 text-accent"
    }`}>
      {filled ? (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : n}
    </span>
  );
}

function BreakdownRow({
  label,
  value,
  bold,
  muted,
  strikethrough,
}: {
  label: string;
  value: number;
  bold?: boolean;
  muted?: boolean;
  strikethrough?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span
        className={`${bold ? "font-medium" : ""} ${muted ? "text-text-muted" : ""} ${strikethrough ? "line-through" : ""}`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? "font-semibold" : ""} ${muted ? "text-text-muted" : ""} ${strikethrough ? "line-through text-text-muted" : ""}`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

// -- Icons --

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function LoadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}
