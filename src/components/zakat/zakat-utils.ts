// Zakat calculation engine — madhab-aware, supports simple + detailed modes

export type Madhab = "hanafi" | "maliki" | "shafii" | "hanbali";
export type StockMethod = "trading" | "investment" | "shortcut";
export type HoldMethod = "investment" | "shortcut" | "per-share";

export interface HoldPosition {
  id: string;
  label: string; // e.g. "Dubai Islamic Bank", "Emirates NBD"
  method: HoldMethod;
  marketValue: number; // used for investment/shortcut methods
  zakatablePercent: number; // 0-100, for investment method
  shareCount: number; // for per-share method
  zakatPerShare: number; // for per-share method
}

export function createHoldPosition(): HoldPosition {
  return {
    id: crypto.randomUUID(),
    label: "",
    method: "per-share",
    marketValue: 0,
    zakatablePercent: 25,
    shareCount: 0,
    zakatPerShare: 0,
  };
}

export function calcHoldPositionZakatable(pos: HoldPosition): number {
  if (pos.method === "per-share") {
    return pos.shareCount * pos.zakatPerShare;
  } else if (pos.method === "investment") {
    return pos.marketValue * (pos.zakatablePercent / 100);
  } else {
    return pos.marketValue * 0.25;
  }
}

export interface MadhabConfig {
  label: string;
  goldNisabGrams: number;
  silverNisabGrams: number;
  jewelryZakatable: boolean;
  debtReducesZakat: boolean;
  debtNote: string;
  useSilverStandard: boolean;
}

export const MADHAB_CONFIGS: Record<Madhab, MadhabConfig> = {
  hanafi: {
    label: "Hanafi",
    goldNisabGrams: 87.48,
    silverNisabGrams: 612.36,
    jewelryZakatable: true,
    debtReducesZakat: true,
    debtNote: "Debts are deducted from zakatable assets",
    useSilverStandard: true,
  },
  maliki: {
    label: "Maliki",
    goldNisabGrams: 85,
    silverNisabGrams: 595,
    jewelryZakatable: false,
    debtReducesZakat: true,
    debtNote: "Debts reduce zakat on gold and silver only",
    useSilverStandard: false,
  },
  shafii: {
    label: "Shafi'i",
    goldNisabGrams: 84.7,
    silverNisabGrams: 592.9,
    jewelryZakatable: false,
    debtReducesZakat: false,
    debtNote: "Zakat is due even if debt covers entire property",
    useSilverStandard: false,
  },
  hanbali: {
    label: "Hanbali",
    goldNisabGrams: 85,
    silverNisabGrams: 595,
    jewelryZakatable: false,
    debtReducesZakat: true,
    debtNote: "Pay zakat only on remainder after meeting debts",
    useSilverStandard: false,
  },
};

export const ZAKAT_RATE = 0.025;

export interface ZakatInputs {
  // Cash
  cash: number;
  // Gold
  goldInvestmentGrams: number;
  goldJewelryGrams: number;
  goldPricePerGram: number;
  // Stocks
  stockTradingValue: number; // portion held for trading (100% zakatable)
  // Simple mode: single cumulative hold value + method
  stockHoldValue: number;
  stockHoldMethod: HoldMethod;
  stockHoldPercent: number; // 0-100, for investment method in simple mode
  // Detailed mode: granular per-stock positions
  holdPositions: HoldPosition[];
  // Detailed mode extras
  silverGrams: number;
  silverPricePerGram: number;
  debts: number;
  // Config
  madhab: Madhab;
}

export interface ZakatBreakdown {
  cashZakatable: number;
  goldInvestmentValue: number;
  goldJewelryValue: number;
  goldJewelryIncluded: boolean;
  goldTotal: number;
  silverValue: number;
  stocksZakatable: number;
  stockTradingZakatable: number;
  stockHoldZakatable: number;
  holdPositionBreakdowns: { label: string; method: HoldMethod; zakatable: number }[];
  grossZakatable: number;
  debtDeduction: number;
  netZakatable: number;
  nisabThreshold: number;
  nisabMet: boolean;
  zakatDue: number;
  madhab: Madhab;
}

export function calculateZakat(inputs: ZakatInputs): ZakatBreakdown {
  const config = MADHAB_CONFIGS[inputs.madhab];

  // Cash
  const cashZakatable = inputs.cash;

  // Gold
  const goldInvestmentValue = inputs.goldInvestmentGrams * inputs.goldPricePerGram;
  const goldJewelryValue = inputs.goldJewelryGrams * inputs.goldPricePerGram;
  const goldJewelryIncluded = config.jewelryZakatable;
  const goldTotal = goldInvestmentValue + (goldJewelryIncluded ? goldJewelryValue : 0);

  // Silver
  const silverValue = inputs.silverGrams * inputs.silverPricePerGram;

  // Stocks — trading portion (100% zakatable)
  const stockTradingZakatable = inputs.stockTradingValue;

  // Hold — detailed mode uses per-position list, simple mode uses single cumulative value
  let holdPositionBreakdowns: { label: string; method: HoldMethod; zakatable: number }[] = [];
  let stockHoldZakatable = 0;

  if (inputs.holdPositions.length > 0) {
    // Detailed mode: granular per-stock
    holdPositionBreakdowns = inputs.holdPositions.map((pos) => ({
      label: pos.label || "Unnamed",
      method: pos.method,
      zakatable: calcHoldPositionZakatable(pos),
    }));
    stockHoldZakatable = holdPositionBreakdowns.reduce((sum, b) => sum + b.zakatable, 0);
  } else if (inputs.stockHoldValue > 0) {
    // Simple mode: single cumulative hold
    if (inputs.stockHoldMethod === "investment") {
      stockHoldZakatable = inputs.stockHoldValue * (inputs.stockHoldPercent / 100);
    } else if (inputs.stockHoldMethod === "shortcut") {
      stockHoldZakatable = inputs.stockHoldValue * 0.25;
    }
    // per-share not used in simple mode
    holdPositionBreakdowns = [{
      label: "Long-term hold",
      method: inputs.stockHoldMethod,
      zakatable: stockHoldZakatable,
    }];
  }

  const stocksZakatable = stockTradingZakatable + stockHoldZakatable;

  // Gross total
  const grossZakatable = cashZakatable + goldTotal + silverValue + stocksZakatable;

  // Debt deduction
  const debtDeduction = config.debtReducesZakat ? Math.min(inputs.debts, grossZakatable) : 0;

  // Net zakatable
  const netZakatable = Math.max(0, grossZakatable - debtDeduction);

  // Nisab check — use silver standard for Hanafi mixed assets, gold for others
  let nisabThreshold: number;
  if (config.useSilverStandard) {
    nisabThreshold = config.silverNisabGrams * inputs.silverPricePerGram;
    // If silver price is 0, fall back to gold
    if (nisabThreshold === 0) {
      nisabThreshold = config.goldNisabGrams * inputs.goldPricePerGram;
    }
  } else {
    nisabThreshold = config.goldNisabGrams * inputs.goldPricePerGram;
  }

  const nisabMet = netZakatable >= nisabThreshold;
  const zakatDue = nisabMet ? netZakatable * ZAKAT_RATE : 0;

  return {
    cashZakatable,
    goldInvestmentValue,
    goldJewelryValue,
    goldJewelryIncluded,
    goldTotal,
    silverValue,
    stocksZakatable,
    stockTradingZakatable,
    stockHoldZakatable,
    holdPositionBreakdowns,
    grossZakatable,
    debtDeduction,
    netZakatable,
    nisabThreshold,
    nisabMet,
    zakatDue,
    madhab: inputs.madhab,
  };
}

export interface ZakatHistoryEntry {
  id: string;
  calculatedAt: string;
  date: string;
  mode: "simple" | "detailed";
  madhab: Madhab;
  breakdown: ZakatBreakdown;
  inputs?: ZakatInputs;
  transactionId: string | null;
}

export function defaultInputs(): ZakatInputs {
  return {
    cash: 0,
    goldInvestmentGrams: 0,
    goldJewelryGrams: 0,
    goldPricePerGram: 280, // rough AED per gram default
    stockTradingValue: 0,
    stockHoldValue: 0,
    stockHoldMethod: "shortcut",
    stockHoldPercent: 25,
    holdPositions: [],
    silverGrams: 0,
    silverPricePerGram: 3.5, // rough AED per gram default
    debts: 0,
    madhab: "maliki",
  };
}
