import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
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
  MADHAB_CONFIGS,
  ZAKAT_RATE,
  type ZakatInputs,
  type ZakatBreakdown,
  type ZakatHistoryEntry,
  type Madhab,
  type StockMethod,
  type HoldMethod,
} from "../components/zakat/zakat-utils.ts";

export const Route = createFileRoute("/zakat")({
  component: ZakatPage,
});

type Mode = "simple" | "detailed";

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
  // Strip everything except digits and decimal point
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
        // Allow only digits, commas, and one decimal point
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
  const [result, setResult] = useState<ZakatBreakdown | null>(null);
  const [date, setDate] = useState(getToday());
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ZakatHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  // Collapsible sections — open by default
  const [goldOpen, setGoldOpen] = useState(true);
  const [stocksOpen, setStocksOpen] = useState(true);
  const [silverOpen, setSilverOpen] = useState(true);
  const [debtsOpen, setDebtsOpen] = useState(true);

  const loadHistory = useCallback(async () => {
    const raw = await getSetting(db, "zakat_history");
    if (raw) {
      try {
        setHistory(JSON.parse(raw));
      } catch {
        setHistory([]);
      }
    }
  }, [db]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  function updateField<K extends keyof ZakatInputs>(key: K, value: ZakatInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  function numVal(key: keyof ZakatInputs, raw: string) {
    const n = raw === "" ? 0 : parseFloat(raw);
    if (!isNaN(n)) updateField(key, n as ZakatInputs[typeof key]);
  }

  // Live preview calculation (runs on every input change)
  const preview = useMemo(() => {
    const calc = mode === "simple"
      ? { ...inputs, silverGrams: 0, silverPricePerGram: 0, debts: 0, madhab: "maliki" as Madhab }
      : inputs;
    return calculateZakat(calc);
  }, [inputs, mode]);

  function handleCalculate() {
    const calc = mode === "simple"
      ? { ...inputs, silverGrams: 0, silverPricePerGram: 0, debts: 0, madhab: "maliki" as Madhab }
      : inputs;
    setResult(calculateZakat(calc));
  }

  function handleReset() {
    setInputs(defaultInputs());
    setResult(null);
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
    if (!result || result.zakatDue === 0) return;
    setSaving(true);
    try {
      const categoryId = await ensureZakatCategory();
      const txnId = crypto.randomUUID();

      await createTransaction(db, {
        id: txnId,
        amount: result.zakatDue,
        type: "expense",
        category_id: categoryId,
        date,
        payee: "Zakat",
        notes: `Zakat (${MADHAB_CONFIGS[inputs.madhab].label}) — ${ZAKAT_RATE * 100}% of ${formatCurrency(result.netZakatable)}`,
        status: date > getToday() ? "planned" : "confirmed",
      });
      emitDbEvent("transactions-changed");

      const entry: ZakatHistoryEntry = {
        id: crypto.randomUUID(),
        calculatedAt: new Date().toISOString(),
        date,
        mode,
        madhab: inputs.madhab,
        breakdown: result,
        transactionId: txnId,
      };
      const updated = [entry, ...history].slice(0, 20);
      await setSetting(db, "zakat_history", JSON.stringify(updated));
      setHistory(updated);

      toast(`Zakat of ${formatCurrency(result.zakatDue)} saved as transaction`);
      setResult(null);
      setInputs(defaultInputs());
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

  // Section subtotals for live preview
  const goldSubtotal = inputs.goldInvestmentGrams * inputs.goldPricePerGram
    + (config.jewelryZakatable ? inputs.goldJewelryGrams * inputs.goldPricePerGram : 0);
  const silverSubtotal = inputs.silverGrams * inputs.silverPricePerGram;
  const hasAnyInput = inputs.cash > 0 || inputs.goldInvestmentGrams > 0
    || inputs.goldJewelryGrams > 0 || inputs.stockMarketValue > 0
    || inputs.stockTradingValue > 0 || inputs.stockHoldValue > 0
    || inputs.silverGrams > 0;

  // Nisab progress for live indicator
  const nisabProgress = preview.nisabThreshold > 0
    ? Math.min(1, preview.netZakatable / preview.nisabThreshold)
    : 0;

  return (
    <div className="pb-28 md:pb-8">
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

      {/* Mode toggle */}
      <div className="px-4 mb-5 max-w-2xl mx-auto">
        <div className="inline-flex bg-surface-alt rounded-lg p-0.5 border border-border">
          <button
            onClick={() => { setMode("simple"); setResult(null); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${
              mode === "simple"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => { setMode("detailed"); setResult(null); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer ${
              mode === "detailed"
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text"
            }`}
          >
            Detailed
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2">
          {mode === "simple"
            ? "Quick calculation for cash, gold, and stocks using Maliki defaults."
            : "Full control — choose your madhab, split trading vs hold stocks, deduct debts."}
        </p>
      </div>

      <div className="px-4 space-y-4 max-w-2xl mx-auto">

        {/* Live nisab indicator — shows once user starts entering values */}
        {hasAnyInput && !result && (
          <div className="bg-surface rounded-xl border border-border p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-muted">
                Nisab progress
                <Tooltip text="The minimum wealth threshold before zakat becomes obligatory. Based on the value of 85g of gold (or 612g silver for Hanafi)." />
              </span>
              <span className="text-xs tabular-nums text-text-muted">
                {formatCurrency(preview.netZakatable)} / {formatCurrency(preview.nisabThreshold)}
              </span>
            </div>
            <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  nisabProgress >= 1 ? "bg-accent" : "bg-border"
                }`}
                style={{ width: `${nisabProgress * 100}%` }}
              />
            </div>
            {nisabProgress >= 1 && (
              <p className="text-xs text-accent mt-1.5 font-medium">
                Above nisab — estimated zakat: {formatCurrency(preview.zakatDue)}
              </p>
            )}
          </div>
        )}

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
              options={Object.entries(MADHAB_CONFIGS).map(([k, v]) => ({
                value: k,
                label: v.label,
              }))}
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {config.debtReducesZakat && (
                <MadhabBadge label="Debts deductible" />
              )}
              {!config.debtReducesZakat && (
                <MadhabBadge label="Debts not deductible" muted />
              )}
              {config.jewelryZakatable && (
                <MadhabBadge label="Jewelry zakatable" />
              )}
              {!config.jewelryZakatable && (
                <MadhabBadge label="Jewelry exempt" muted />
              )}
              {config.useSilverStandard && (
                <MadhabBadge label="Silver nisab standard" />
              )}
            </div>
          </section>
        )}

        {/* Cash */}
        <section className="bg-surface rounded-xl border border-border p-4">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
            <StepNumber n={1} />
            Cash & Savings
            <Tooltip text="Physical currency, bank accounts (checking, savings), money market accounts, and deposits." />
            {inputs.cash > 0 && (
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
          open={goldOpen}
          onToggle={() => setGoldOpen(!goldOpen)}
          title={
            <>
              <StepNumber n={2} />
              Gold
              <Tooltip text="Investment gold (bars, coins) is always zakatable. Personal jewelry rules vary by madhab." />
              {goldSubtotal > 0 && (
                <span className="ml-auto text-xs tabular-nums text-text-muted font-normal">
                  {formatCurrency(goldSubtotal)}
                </span>
              )}
            </>
          }
          subtitle={!goldOpen && goldSubtotal > 0 ? formatCurrency(goldSubtotal) : undefined}
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
                Check current 24K gold price in AED. This value is used for both nisab threshold and gold valuation.
              </p>
            </div>
            <div>
              <Input
                label="Investment gold — bars, coins (grams)"
                type="number"
                min="0"
                step="any"
                value={inputs.goldInvestmentGrams || ""}
                onChange={(e) => numVal("goldInvestmentGrams", e.target.value)}
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
                <Input
                  label={
                    `Personal jewelry (grams)` +
                    (mode === "detailed" && !config.jewelryZakatable ? " — exempt" : "")
                  }
                  type="number"
                  min="0"
                  step="any"
                  value={inputs.goldJewelryGrams || ""}
                  onChange={(e) => numVal("goldJewelryGrams", e.target.value)}
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
            open={silverOpen}
            onToggle={() => setSilverOpen(!silverOpen)}
            title={
              <>
                <StepNumber n={3} />
                Silver
                <Tooltip text="Silver jewelry and bullion. Used for nisab calculation under the Hanafi silver standard." />
                {silverSubtotal > 0 && (
                  <span className="ml-auto text-xs tabular-nums text-text-muted font-normal">
                    {formatCurrency(silverSubtotal)}
                  </span>
                )}
              </>
            }
            subtitle={!silverOpen && silverSubtotal > 0 ? formatCurrency(silverSubtotal) : undefined}
          >
            <div className="space-y-3">
              <CurrencyInput
                label="Silver price per gram (AED)"
                value={inputs.silverPricePerGram}
                onChange={(v) => updateField("silverPricePerGram", v)}
                placeholder="3.50"
              />
              <div>
                <Input
                  label="Silver weight (grams)"
                  type="number"
                  min="0"
                  step="any"
                  value={inputs.silverGrams || ""}
                  onChange={(e) => numVal("silverGrams", e.target.value)}
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
          open={stocksOpen}
          onToggle={() => setStocksOpen(!stocksOpen)}
          title={
            <>
              <StepNumber n={mode === "detailed" ? 4 : 3} />
              Stocks & Investments
              <Tooltip text="Zakat on stocks depends on your intention: trading (full value) vs long-term investment (proportional zakatable assets)." />
              {inputs.stockMarketValue > 0 && (
                <span className="ml-auto text-xs tabular-nums text-text-muted font-normal">
                  {formatCurrency(preview.stocksZakatable)}
                </span>
              )}
            </>
          }
          subtitle={!stocksOpen && inputs.stockMarketValue > 0 ? formatCurrency(preview.stocksZakatable) : undefined}
        >
          <div className="space-y-3">
            {mode === "simple" ? (
              <>
                <CurrencyInput
                  label="Total market value of shares (AED)"
                  value={inputs.stockMarketValue}
                  onChange={(v) => updateField("stockMarketValue", v)}
                />
                {inputs.stockMarketValue > 0 && (
                  <p className="text-xs text-text-muted">
                    Simple mode uses the trading method — full market value is zakatable at 2.5%.
                  </p>
                )}
              </>
            ) : (
              <>
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

                <div className="border-t border-border/50 pt-3">
                  <CurrencyInput
                    label="Long-term hold stocks — not for resale (AED)"
                    value={inputs.stockHoldValue}
                    onChange={(v) => updateField("stockHoldValue", v)}
                  />
                </div>

                {inputs.stockHoldValue > 0 && (
                  <>
                    <div>
                      <Select
                        label="Hold stock zakat method"
                        value={inputs.stockHoldMethod}
                        onChange={(e) => updateField("stockHoldMethod", e.target.value as HoldMethod)}
                        options={[
                          { value: "investment", label: "Investment — on zakatable assets portion" },
                          { value: "shortcut", label: "25% shortcut — assume 25% is zakatable" },
                        ]}
                      />
                      <Tooltip
                        text={
                          inputs.stockHoldMethod === "investment"
                            ? "For long-term holdings. Find zakatable assets (cash + receivables + inventory) in the company's annual report, divide by market cap."
                            : "Scholars recommend this when you can't access company financials. Effective rate: 0.625%."
                        }
                        block
                      />
                    </div>
                    {inputs.stockHoldMethod === "investment" && (
                      <div>
                        <Input
                          label="Zakatable assets as % of market cap"
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={inputs.stockZakatablePercent || ""}
                          onChange={(e) => numVal("stockZakatablePercent", e.target.value)}
                          placeholder="25"
                        />
                        {inputs.stockHoldValue > 0 && (
                          <p className="text-xs text-text-muted mt-1">
                            Zakatable portion: {formatCurrency(inputs.stockHoldValue * (inputs.stockZakatablePercent / 100))}
                          </p>
                        )}
                      </div>
                    )}
                    {inputs.stockHoldMethod === "shortcut" && (
                      <p className="text-xs text-text-muted">
                        Zakatable portion: {formatCurrency(inputs.stockHoldValue * 0.25)}
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* Debts — detailed only, when madhab allows */}
        {mode === "detailed" && config.debtReducesZakat && (
          <CollapsibleSection
            open={debtsOpen}
            onToggle={() => setDebtsOpen(!debtsOpen)}
            title={
              <>
                <StepNumber n={5} />
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

        {/* Date + Calculate */}
        <section className="bg-surface rounded-xl border border-border p-4">
          <h2 className="text-sm font-bold mb-3">
            Payment Date
            <Tooltip text="The date the zakat payment will be recorded as a transaction. Defaults to today." />
          </h2>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </section>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleCalculate}
        >
          Calculate Zakat
        </Button>

        {/* Results */}
        {result && (
          <section className="bg-surface rounded-xl border-2 border-accent/30 p-5 animate-slide-up">
            <h2 className="text-sm font-bold mb-4 text-accent">Zakat Summary</h2>

            <div className="space-y-2 text-sm">
              <BreakdownRow label="Cash & savings" value={result.cashZakatable} />
              {result.goldInvestmentValue > 0 && (
                <BreakdownRow label="Gold (investment)" value={result.goldInvestmentValue} />
              )}
              {result.goldJewelryValue > 0 && (
                <BreakdownRow
                  label={`Gold (jewelry)${!result.goldJewelryIncluded ? " — exempt" : ""}`}
                  value={result.goldJewelryIncluded ? result.goldJewelryValue : 0}
                  muted={!result.goldJewelryIncluded}
                  strikethrough={!result.goldJewelryIncluded}
                />
              )}
              {result.silverValue > 0 && (
                <BreakdownRow label="Silver" value={result.silverValue} />
              )}
              {result.stockTradingZakatable > 0 && (
                <BreakdownRow
                  label="Stocks (trading)"
                  value={result.stockTradingZakatable}
                />
              )}
              {result.stockHoldZakatable > 0 && (
                <BreakdownRow
                  label={`Stocks (hold — ${result.stockHoldMethod})`}
                  value={result.stockHoldZakatable}
                />
              )}
              {result.stocksZakatable > 0 && result.stockTradingZakatable === 0 && result.stockHoldZakatable === 0 && (
                <BreakdownRow
                  label={`Stocks (${result.stockMethod})`}
                  value={result.stocksZakatable}
                />
              )}

              <div className="border-t border-border my-2" />
              <BreakdownRow label="Gross zakatable" value={result.grossZakatable} bold />
              {result.debtDeduction > 0 && (
                <BreakdownRow label="Less: debts" value={-result.debtDeduction} />
              )}
              <BreakdownRow label="Net zakatable" value={result.netZakatable} bold />

              <div className="border-t border-border my-2" />
              <BreakdownRow
                label={`Nisab threshold (${config.useSilverStandard ? "silver" : "gold"} standard)`}
                value={result.nisabThreshold}
                muted
              />

              {result.nisabMet ? (
                <div className="bg-accent/5 rounded-lg p-4 mt-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-text-muted">
                      Zakat due (2.5%)
                    </span>
                    <span className="text-2xl font-bold text-accent">
                      {formatCurrency(result.zakatDue)}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : `Save as transaction on ${fmtDateShort(date)}`}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-alt rounded-lg p-4 mt-3 text-center">
                  <p className="text-sm text-text-muted">
                    Your wealth ({formatCurrency(result.netZakatable)}) is below the nisab
                    threshold ({formatCurrency(result.nisabThreshold)}).
                  </p>
                  <p className="text-sm font-medium mt-1">No zakat is due.</p>
                </div>
              )}
            </div>
          </section>
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
                    <button
                      onClick={() => handleDeleteHistory(entry.id)}
                      className="text-text-light hover:text-danger p-1 shrink-0 cursor-pointer"
                      title="Remove"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
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
          or your local zakat authority. Calculations follow standard interpretations
          of each school of thought — actual rulings may differ based on your
          scholar's guidance.
        </div>
      </div>

      {/* Info Modal */}
      <ZakatInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </div>
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
            <strong>Simple</strong> uses Maliki defaults with the trading method for stocks —
            ideal for a quick estimate. <strong>Detailed</strong> lets you select your madhab,
            split stocks between trading and long-term hold, add silver, and deduct debts where applicable.
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

// -- Collapsible Section --

function CollapsibleSection({
  open,
  onToggle,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: React.ReactNode;
  subtitle?: string;
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
      {!open && subtitle && (
        <div className="px-4 pb-3 -mt-2">
          <span className="text-xs text-text-muted">{subtitle}</span>
        </div>
      )}
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

// -- Tooltip --

function Tooltip({ text, block }: { text: string; block?: boolean }) {
  const [show, setShow] = useState(false);

  if (block) {
    return (
      <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{text}</p>
    );
  }

  return (
    <span
      className="relative inline-flex ml-1 text-text-light hover:text-text-muted cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow(!show); }}
      role="note"
      aria-label="More info"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
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

function StepNumber({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs shrink-0">
      {n}
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

function fmtDateShort(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-AE", {
    month: "short",
    day: "numeric",
  });
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
