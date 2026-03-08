// Zakat calculation engine — madhab-aware, supports simple + detailed modes

export type Madhab = "hanafi" | "maliki" | "shafii" | "hanbali";
export type StockMethod = "trading" | "investment" | "shortcut";
export type HoldMethod = "investment" | "shortcut";

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
  stockMethod: StockMethod; // simple mode only
  stockMarketValue: number; // simple mode: total value
  stockTradingValue: number; // detailed mode: portion held for trading
  stockHoldValue: number; // detailed mode: portion held long-term
  stockHoldMethod: HoldMethod; // how to value the hold portion
  stockZakatablePercent: number; // 0-100, for investment method
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
  stockMethod: StockMethod;
  stockHoldMethod: HoldMethod;
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

  // Stocks — simple mode uses stockMarketValue + stockMethod,
  // detailed mode splits into trading + hold portions
  let stockTradingZakatable = 0;
  let stockHoldZakatable = 0;

  if (inputs.stockTradingValue > 0 || inputs.stockHoldValue > 0) {
    // Detailed mode split
    stockTradingZakatable = inputs.stockTradingValue;
    if (inputs.stockHoldMethod === "investment") {
      stockHoldZakatable = inputs.stockHoldValue * (inputs.stockZakatablePercent / 100);
    } else {
      stockHoldZakatable = inputs.stockHoldValue * 0.25;
    }
  } else if (inputs.stockMarketValue > 0) {
    // Simple mode — single value + method
    if (inputs.stockMethod === "trading") {
      stockTradingZakatable = inputs.stockMarketValue;
    } else if (inputs.stockMethod === "investment") {
      stockHoldZakatable = inputs.stockMarketValue * (inputs.stockZakatablePercent / 100);
    } else {
      stockHoldZakatable = inputs.stockMarketValue * 0.25;
    }
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
    stockMethod: inputs.stockMethod,
    stockHoldMethod: inputs.stockHoldMethod,
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
  transactionId: string | null;
}

export function defaultInputs(): ZakatInputs {
  return {
    cash: 0,
    goldInvestmentGrams: 0,
    goldJewelryGrams: 0,
    goldPricePerGram: 280, // rough AED per gram default
    stockMethod: "trading",
    stockMarketValue: 0,
    stockTradingValue: 0,
    stockHoldValue: 0,
    stockHoldMethod: "shortcut",
    stockZakatablePercent: 25,
    silverGrams: 0,
    silverPricePerGram: 3.5, // rough AED per gram default
    debts: 0,
    madhab: "hanafi",
  };
}
