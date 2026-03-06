export const DEFAULT_CATEGORIES = [
  // Expense categories
  { id: "cat-housing", name: "Housing", color: "#6366f1", icon: "home", sort_order: 1, is_income: 0 },
  { id: "cat-housing-rent", name: "Rent", color: "#6366f1", icon: "home", sort_order: 1, is_income: 0, parent_id: "cat-housing" },
  { id: "cat-housing-utilities", name: "Utilities", color: "#6366f1", icon: "zap", sort_order: 2, is_income: 0, parent_id: "cat-housing" },
  { id: "cat-housing-maintenance", name: "Maintenance", color: "#6366f1", icon: "wrench", sort_order: 3, is_income: 0, parent_id: "cat-housing" },

  { id: "cat-transport", name: "Transportation", color: "#f59e0b", icon: "car", sort_order: 2, is_income: 0 },
  { id: "cat-transport-fuel", name: "Fuel", color: "#f59e0b", icon: "fuel", sort_order: 1, is_income: 0, parent_id: "cat-transport" },
  { id: "cat-transport-public", name: "Public Transport", color: "#f59e0b", icon: "bus", sort_order: 2, is_income: 0, parent_id: "cat-transport" },

  { id: "cat-food", name: "Food", color: "#ef4444", icon: "utensils", sort_order: 3, is_income: 0 },
  { id: "cat-food-groceries", name: "Groceries", color: "#ef4444", icon: "shopping-cart", sort_order: 1, is_income: 0, parent_id: "cat-food" },
  { id: "cat-food-dining", name: "Dining Out", color: "#ef4444", icon: "utensils", sort_order: 2, is_income: 0, parent_id: "cat-food" },
  { id: "cat-food-coffee", name: "Coffee", color: "#ef4444", icon: "coffee", sort_order: 3, is_income: 0, parent_id: "cat-food" },

  { id: "cat-health", name: "Healthcare", color: "#ec4899", icon: "heart", sort_order: 4, is_income: 0 },
  { id: "cat-health-medical", name: "Medical", color: "#ec4899", icon: "stethoscope", sort_order: 1, is_income: 0, parent_id: "cat-health" },
  { id: "cat-health-pharmacy", name: "Pharmacy", color: "#ec4899", icon: "pill", sort_order: 2, is_income: 0, parent_id: "cat-health" },

  { id: "cat-entertainment", name: "Entertainment", color: "#8b5cf6", icon: "film", sort_order: 5, is_income: 0 },
  { id: "cat-entertainment-subs", name: "Subscriptions", color: "#8b5cf6", icon: "tv", sort_order: 1, is_income: 0, parent_id: "cat-entertainment" },
  { id: "cat-entertainment-hobbies", name: "Hobbies", color: "#8b5cf6", icon: "gamepad", sort_order: 2, is_income: 0, parent_id: "cat-entertainment" },

  { id: "cat-shopping", name: "Shopping", color: "#14b8a6", icon: "bag", sort_order: 6, is_income: 0 },
  { id: "cat-shopping-clothing", name: "Clothing", color: "#14b8a6", icon: "shirt", sort_order: 1, is_income: 0, parent_id: "cat-shopping" },
  { id: "cat-shopping-electronics", name: "Electronics", color: "#14b8a6", icon: "laptop", sort_order: 2, is_income: 0, parent_id: "cat-shopping" },

  { id: "cat-education", name: "Education", color: "#0ea5e9", icon: "book", sort_order: 7, is_income: 0 },

  { id: "cat-personal", name: "Personal", color: "#f97316", icon: "user", sort_order: 8, is_income: 0 },
  { id: "cat-personal-gifts", name: "Gifts", color: "#f97316", icon: "gift", sort_order: 1, is_income: 0, parent_id: "cat-personal" },
  { id: "cat-personal-selfcare", name: "Self-Care", color: "#f97316", icon: "spa", sort_order: 2, is_income: 0, parent_id: "cat-personal" },

  { id: "cat-financial", name: "Financial", color: "#64748b", icon: "landmark", sort_order: 9, is_income: 0 },
  { id: "cat-financial-fees", name: "Bank Fees", color: "#64748b", icon: "credit-card", sort_order: 1, is_income: 0, parent_id: "cat-financial" },
  { id: "cat-financial-insurance", name: "Insurance", color: "#64748b", icon: "shield", sort_order: 2, is_income: 0, parent_id: "cat-financial" },

  { id: "cat-other", name: "Other", color: "#94a3b8", icon: "more-horizontal", sort_order: 10, is_income: 0 },

  // Income categories
  { id: "cat-income-salary", name: "Salary", color: "#16a34a", icon: "briefcase", sort_order: 1, is_income: 1 },
  { id: "cat-income-freelance", name: "Freelance", color: "#16a34a", icon: "laptop", sort_order: 2, is_income: 1 },
  { id: "cat-income-investments", name: "Investments", color: "#16a34a", icon: "trending-up", sort_order: 3, is_income: 1 },
  { id: "cat-income-other", name: "Other Income", color: "#16a34a", icon: "plus-circle", sort_order: 4, is_income: 1 },
];

export function getSeedSQL(): string {
  const statements = DEFAULT_CATEGORIES.map((cat) => {
    const parentId = (cat as { parent_id?: string }).parent_id ?? null;
    return `INSERT OR IGNORE INTO categories (id, name, parent_id, color, icon, sort_order, is_income, is_system)
      VALUES ('${cat.id}', '${cat.name}', ${parentId ? `'${parentId}'` : "NULL"}, '${cat.color}', '${cat.icon}', ${cat.sort_order}, ${cat.is_income}, 1);`;
  });
  return statements.join("\n");
}

// Cashflow seed data mirroring the user's Excel cashflow spreadsheet (Jan-25 to Sep-25)
interface CashflowSeedItem {
  id: string;
  label: string;
  type: "income" | "expense";
  amount: number;
  group_name: string;
  month: string | null;
  sort_order: number;
}

const CASHFLOW_SEED: CashflowSeedItem[] = [
  // ── EXPENSES ──────────────────────────────────────────────

  // MBRHE Loan — Apr-26, May-26
  { id: "cf-mbrhe-2026-04", label: "MBRHE Loan", type: "expense", amount: 5199, group_name: "Loans", month: "2026-04", sort_order: 1 },
  { id: "cf-mbrhe-2026-05", label: "MBRHE Loan", type: "expense", amount: 5199, group_name: "Loans", month: "2026-05", sort_order: 1 },

  // Living Expenses — Aug-25 to Dec-25 @ 5,000
  ...months("08", "12").map((m) => ({
    id: `cf-living-2025-${m}`,
    label: "Living Expenses",
    type: "expense" as const,
    amount: 5000,
    group_name: "Personal",
    month: `2025-${m}`,
    sort_order: 2,
  })),

  // Lamia Allowance — Jan-25 to Dec-25 @ 5,000
  ...months("01", "12").map((m) => ({
    id: `cf-lamia-2025-${m}`,
    label: "Lamia Allowance",
    type: "expense" as const,
    amount: 5000,
    group_name: "Personal",
    month: `2025-${m}`,
    sort_order: 3,
  })),

  // DIB Credit Card — variable per month
  { id: "cf-dib-2024-10", label: "DIB Credit Card", type: "expense", amount: 0, group_name: "Credit Cards", month: "2024-10", sort_order: 4 },
  { id: "cf-dib-2024-11", label: "DIB Credit Card", type: "expense", amount: 14815, group_name: "Credit Cards", month: "2024-11", sort_order: 4 },
  { id: "cf-dib-2024-12", label: "DIB Credit Card", type: "expense", amount: 19472, group_name: "Credit Cards", month: "2024-12", sort_order: 4 },
  { id: "cf-dib-2025-01", label: "DIB Credit Card", type: "expense", amount: 19510, group_name: "Credit Cards", month: "2025-01", sort_order: 4 },
  { id: "cf-dib-2025-02", label: "DIB Credit Card", type: "expense", amount: 132239.47, group_name: "Credit Cards", month: "2025-02", sort_order: 4 },
  { id: "cf-dib-2025-03", label: "DIB Credit Card", type: "expense", amount: 62863, group_name: "Credit Cards", month: "2025-03", sort_order: 4 },
  { id: "cf-dib-2025-04", label: "DIB Credit Card", type: "expense", amount: 187371, group_name: "Credit Cards", month: "2025-04", sort_order: 4 },
  { id: "cf-dib-2025-05", label: "DIB Credit Card", type: "expense", amount: 83411, group_name: "Credit Cards", month: "2025-05", sort_order: 4 },
  { id: "cf-dib-2025-06", label: "DIB Credit Card", type: "expense", amount: 75019, group_name: "Credit Cards", month: "2025-06", sort_order: 4 },
  { id: "cf-dib-2025-07", label: "DIB Credit Card", type: "expense", amount: 51523, group_name: "Credit Cards", month: "2025-07", sort_order: 4 },
  { id: "cf-dib-2025-08", label: "DIB Credit Card", type: "expense", amount: 84719, group_name: "Credit Cards", month: "2025-08", sort_order: 4 },
  { id: "cf-dib-2025-09", label: "DIB Credit Card", type: "expense", amount: 75617, group_name: "Credit Cards", month: "2025-09", sort_order: 4 },
  { id: "cf-dib-2025-10", label: "DIB Credit Card", type: "expense", amount: 63700, group_name: "Credit Cards", month: "2025-10", sort_order: 4 },
  { id: "cf-dib-2025-11", label: "DIB Credit Card", type: "expense", amount: 155783.33, group_name: "Credit Cards", month: "2025-11", sort_order: 4 },
  { id: "cf-dib-2025-12", label: "DIB Credit Card", type: "expense", amount: 89792, group_name: "Credit Cards", month: "2025-12", sort_order: 4 },
  { id: "cf-dib-2026-01", label: "DIB Credit Card", type: "expense", amount: 59294.59, group_name: "Credit Cards", month: "2026-01", sort_order: 4 },
  { id: "cf-dib-2026-02", label: "DIB Credit Card", type: "expense", amount: 75000, group_name: "Credit Cards", month: "2026-02", sort_order: 4 },

  // Worker Salaries — Jun-25 to Oct-25 @ 1,500; Nov-25, Dec-25 @ 1,200
  ...months("06", "10").map((m) => ({
    id: `cf-workers-2025-${m}`,
    label: "Worker Salaries",
    type: "expense" as const,
    amount: 1500,
    group_name: "Salaries",
    month: `2025-${m}`,
    sort_order: 5,
  })),
  { id: "cf-workers-2025-11", label: "Worker Salaries", type: "expense", amount: 1200, group_name: "Salaries", month: "2025-11", sort_order: 5 },
  { id: "cf-workers-2025-12", label: "Worker Salaries", type: "expense", amount: 1200, group_name: "Salaries", month: "2025-12", sort_order: 5 },

  // Mohammad Jamal Supervision — May-24 to Nov-25 @ 1,000; Dec-25 @ 10,000
  ...["2024-05","2024-06","2024-07","2024-08","2024-09","2024-10","2024-11","2024-12",
    "2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11"].map((m) => ({
    id: `cf-mjamal-${m}`,
    label: "Mohammad Jamal Supervision",
    type: "expense" as const,
    amount: 1000,
    group_name: "Salaries",
    month: m,
    sort_order: 6,
  })),
  { id: "cf-mjamal-2025-12", label: "Mohammad Jamal Supervision", type: "expense", amount: 10000, group_name: "Salaries", month: "2025-12", sort_order: 6 },

  // Khalid Petty Cash — Jul-25 to Dec-25 @ 1,000
  ...months("07", "12").map((m) => ({
    id: `cf-khalid-2025-${m}`,
    label: "Khalid Petty Cash",
    type: "expense" as const,
    amount: 1000,
    group_name: "Operations",
    month: `2025-${m}`,
    sort_order: 7,
  })),

  // Zakat — Apr-26
  { id: "cf-zakat-2026-04", label: "Zakat", type: "expense", amount: 25000, group_name: "Religious", month: "2026-04", sort_order: 8 },

  // ── INCOME ────────────────────────────────────────────────

  // Salary — May-23 to Sep-24 @ 18,780.30 (Mar-24 @ 22,280.30, Sep-24 @ 62,523.03)
  ...["2023-05","2023-06","2023-07","2023-08","2023-09","2023-10","2023-11","2023-12",
    "2024-01","2024-02"].map((m) => ({
    id: `cf-salary-${m}`,
    label: "Salary",
    type: "income" as const,
    amount: 18780.3,
    group_name: "Employment",
    month: m,
    sort_order: 1,
  })),
  { id: "cf-salary-2024-03", label: "Salary", type: "income", amount: 22280.3, group_name: "Employment", month: "2024-03", sort_order: 1 },
  { id: "cf-salary-2024-04", label: "Salary", type: "income", amount: 18780.3, group_name: "Employment", month: "2024-04", sort_order: 1 },
  ...["2024-05","2024-06","2024-07"].map((m) => ({
    id: `cf-salary-${m}`,
    label: "Salary",
    type: "income" as const,
    amount: 18780.3,
    group_name: "Employment",
    month: m,
    sort_order: 1,
  })),
  { id: "cf-salary-2024-08", label: "Salary", type: "income", amount: 62523.03, group_name: "Employment", month: "2024-08", sort_order: 1 },
  // Oct-24 onward @ 33,761.21
  ...["2024-09","2024-10","2024-11","2024-12",
    "2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12",
    "2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08","2026-09"].map((m) => ({
    id: `cf-salary-${m}`,
    label: "Salary",
    type: "income" as const,
    amount: 33761.21,
    group_name: "Employment",
    month: m,
    sort_order: 1,
  })),

  // Dividends — scattered
  { id: "cf-dividends-2024-03", label: "Dividends", type: "income", amount: 44979.75, group_name: "Investments", month: "2024-03", sort_order: 2 },
  { id: "cf-dividends-2024-04", label: "Dividends", type: "income", amount: 138193, group_name: "Investments", month: "2024-04", sort_order: 2 },
  { id: "cf-dividends-2024-05", label: "Dividends", type: "income", amount: 2500, group_name: "Investments", month: "2024-05", sort_order: 2 },
  { id: "cf-dividends-2024-10", label: "Dividends", type: "income", amount: 4672, group_name: "Investments", month: "2024-10", sort_order: 2 },
  { id: "cf-dividends-2025-03", label: "Dividends", type: "income", amount: 44979, group_name: "Investments", month: "2025-03", sort_order: 2 },
  { id: "cf-dividends-2025-04", label: "Dividends", type: "income", amount: 166901, group_name: "Investments", month: "2025-04", sort_order: 2 },

  // Allowance From Father — May-23 to Aug-24 @ 5,000; Sep-24 onward @ 8,000
  ...["2023-05","2023-06","2023-07","2023-08","2023-09","2023-10","2023-11","2023-12",
    "2024-01","2024-02","2024-03","2024-04","2024-05","2024-06","2024-07","2024-08"].map((m) => ({
    id: `cf-allowance-${m}`,
    label: "Allowance From Father",
    type: "income" as const,
    amount: 5000,
    group_name: "Family",
    month: m,
    sort_order: 3,
  })),
  ...["2024-09","2024-10","2024-11","2024-12",
    "2025-01","2025-02","2025-03","2025-04","2025-05","2025-06","2025-07","2025-08","2025-09","2025-10","2025-11","2025-12",
    "2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08","2026-09"].map((m) => ({
    id: `cf-allowance-${m}`,
    label: "Allowance From Father",
    type: "income" as const,
    amount: 8000,
    group_name: "Family",
    month: m,
    sort_order: 3,
  })),
];

function months(start: string, end: string): string[] {
  const result: string[] = [];
  for (let i = parseInt(start); i <= parseInt(end); i++) {
    result.push(String(i).padStart(2, "0"));
  }
  return result;
}

export function getCashflowSeedSQL(): string {
  return CASHFLOW_SEED.map(
    (item) =>
      `INSERT OR IGNORE INTO cashflow_items (id, label, type, amount, group_name, month, sort_order)
       VALUES ('${item.id}', '${item.label}', '${item.type}', ${item.amount}, '${item.group_name}', ${item.month ? `'${item.month}'` : "NULL"}, ${item.sort_order});`
  ).join("\n");
}
